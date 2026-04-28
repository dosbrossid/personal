import 'server-only'

import { formatInTimeZone } from 'date-fns-tz'
import type { CalendarDisplayEvent, PublicHoliday } from '@/core/types'

const NAGER_BASE_URL = 'https://date.nager.at/api/v3/publicholidays'
const INDONESIA_COUNTRY_CODE = 'ID'

interface NagerHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  global: boolean
  types?: string[]
}

interface HolidaysQueryClient {
  from(table: 'public_holidays'): {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        gte: (column: string, value: string) => {
          lte: (column: string, value: string) => {
            order: (
              column: string,
              options: { ascending: boolean }
            ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
          }
        }
      }
    }
    upsert: (
      values: Array<Record<string, unknown>>,
      options: { onConflict: string; ignoreDuplicates?: boolean }
    ) => Promise<{ error: { message: string } | null }>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeHolidayTypes(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function buildHolidayRows(holidays: NagerHoliday[]) {
  return holidays
    .filter((holiday) => holiday.global !== false)
    .map((holiday) => ({
      country_code: INDONESIA_COUNTRY_CODE,
      holiday_date: holiday.date,
      local_name: holiday.localName || holiday.name,
      name: holiday.name || holiday.localName,
      is_global: holiday.global !== false,
      holiday_types: holiday.types ?? [],
      source: 'nager-date',
      source_url: `${NAGER_BASE_URL}/${new Date(holiday.date).getUTCFullYear()}/${INDONESIA_COUNTRY_CODE}`,
    }))
}

export async function fetchIndonesiaPublicHolidays(year: number) {
  const response = await fetch(`${NAGER_BASE_URL}/${year}/${INDONESIA_COUNTRY_CODE}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Gagal memuat hari libur nasional (${response.status})`)
  }

  const payload = (await response.json().catch(() => [])) as unknown
  if (!Array.isArray(payload)) {
    throw new Error('Format hari libur nasional tidak valid')
  }

  return payload
    .filter((item): item is NagerHoliday => isRecord(item) && typeof item.date === 'string' && typeof item.name === 'string')
    .map((item) => ({
      date: item.date,
      localName: typeof item.localName === 'string' ? item.localName : item.name,
      name: item.name,
      countryCode: typeof item.countryCode === 'string' ? item.countryCode : INDONESIA_COUNTRY_CODE,
      global: typeof item.global === 'boolean' ? item.global : true,
      types: normalizeHolidayTypes(item.types),
    }))
}

export async function syncIndonesiaPublicHolidaysForYear(client: unknown, year: number) {
  const supabase = client as HolidaysQueryClient
  const holidays = await fetchIndonesiaPublicHolidays(year)
  const rows = buildHolidayRows(holidays)

  if (!rows.length) {
    return { synced: 0 }
  }

  const { error } = await supabase.from('public_holidays').upsert(rows, {
    onConflict: 'country_code,holiday_date,name',
    ignoreDuplicates: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { synced: rows.length }
}

export async function ensureIndonesiaPublicHolidaysForYear(client: unknown, year: number) {
  const supabase = client as HolidaysQueryClient
  const rangeStart = `${year}-01-01`
  const rangeEnd = `${year}-12-31`

  const { data, error } = await supabase
    .from('public_holidays')
    .select('id')
    .eq('country_code', INDONESIA_COUNTRY_CODE)
    .gte('holiday_date', rangeStart)
    .lte('holiday_date', rangeEnd)
    .order('holiday_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  if ((data ?? []).length > 0) {
    return { synced: 0, alreadyExists: true }
  }

  const result = await syncIndonesiaPublicHolidaysForYear(supabase, year)
  return { ...result, alreadyExists: false }
}

export function mapPublicHolidayToCalendarEvent(holiday: PublicHoliday): CalendarDisplayEvent {
  const startAt = `${holiday.holiday_date}T00:00:00+07:00`
  const endAt = `${holiday.holiday_date}T23:59:59+07:00`
  const holidayTitle = holiday.local_name && holiday.local_name !== holiday.name
    ? `${holiday.local_name} · ${holiday.name}`
    : holiday.name

  return {
    id: `holiday-${holiday.id}`,
    user_id: 'system',
    title: holidayTitle,
    description: 'Hari libur nasional Indonesia',
    start_at: startAt,
    end_at: endAt,
    is_all_day: true,
    reminder_minutes: null,
    contextual_role: 'general',
    recurrence: 'none',
    created_at: holiday.created_at,
    updated_at: holiday.updated_at,
    is_deleted: false,
    event_source: 'holiday',
    is_readonly: true,
    holiday_date: holiday.holiday_date,
  }
}

export function mapHolidayRows(rows: unknown[]) {
  return rows.map((row) => {
    const record = row as Record<string, unknown>
    return mapPublicHolidayToCalendarEvent({
      id: String(record.id),
      country_code: String(record.country_code),
      holiday_date: String(record.holiday_date),
      local_name: String(record.local_name),
      name: String(record.name),
      is_global: Boolean(record.is_global),
      holiday_types: normalizeHolidayTypes(record.holiday_types),
      source: String(record.source ?? 'nager-date'),
      source_url: typeof record.source_url === 'string' ? record.source_url : null,
      created_at: String(record.created_at ?? ''),
      updated_at: String(record.updated_at ?? ''),
    })
  })
}

export function buildHolidayDateRangeForYear(year: number) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  }
}

export function formatHolidayLabel(dateKey: string) {
  return formatInTimeZone(`${dateKey}T12:00:00+07:00`, 'Asia/Jakarta', 'EEEE, dd MMMM yyyy')
}

export async function getIndonesiaPublicHolidaysForRange(
  client: unknown,
  range: { from: string; to: string }
) {
  const supabase = client as HolidaysQueryClient

  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .eq('country_code', INDONESIA_COUNTRY_CODE)
    .gte('holiday_date', range.from)
    .lte('holiday_date', range.to)
    .order('holiday_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return mapHolidayRows(data ?? [])
}
