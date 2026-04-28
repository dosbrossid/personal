// ============================================================
// SWR Hook: useHabits
// Read layer for habits module — fetches from /api/habits
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { Habit } from '@/core/types'

interface UseHabitsFilters {
  role?: string
}

export function useHabits(filters?: UseHabitsFilters) {
  const params = new URLSearchParams()
  if (filters?.role) params.set('role', filters.role)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<Habit[]>(
    `/api/habits${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    habits: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
