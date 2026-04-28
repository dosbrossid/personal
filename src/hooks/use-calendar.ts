// ============================================================
// SWR Hook: useCalendarEvents
// Read layer for calendar module — fetches from /api/calendar
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { CalendarDisplayEvent } from '@/core/types'

interface UseCalendarEventsOptions {
  month?: string
  includeHolidays?: boolean
  holidayYear?: number
}

export function useCalendarEvents(options?: string | UseCalendarEventsOptions) {
  const normalizedOptions: UseCalendarEventsOptions =
    typeof options === 'string' ? { month: options } : options ?? {}

  const searchParams = new URLSearchParams()

  if (normalizedOptions.month) {
    searchParams.set('month', normalizedOptions.month)
  }

  if (normalizedOptions.includeHolidays) {
    searchParams.set('include_holidays', '1')
  }

  if (typeof normalizedOptions.holidayYear === 'number') {
    searchParams.set('holiday_year', String(normalizedOptions.holidayYear))
  }

  const params = searchParams.toString()

  const { data, error, isLoading, mutate } = useSWR<CalendarDisplayEvent[]>(
    `/api/calendar${params ? `?${params}` : ''}`,
    fetcher
  )

  return {
    events: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
