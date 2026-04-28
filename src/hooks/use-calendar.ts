// ============================================================
// SWR Hook: useCalendarEvents
// Read layer for calendar module — fetches from /api/calendar
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { CalendarEvent } from '@/core/types'

export function useCalendarEvents(month?: string) {
  const params = month ? `?month=${month}` : ''

  const { data, error, isLoading, mutate } = useSWR<CalendarEvent[]>(
    `/api/calendar${params}`,
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
