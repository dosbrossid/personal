// ============================================================
// SWR Hook: useTasks
// Read layer for tasks module — fetches from /api/tasks
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { Task } from '@/core/types'

interface UseTasksFilters {
  status?: string
  role?: string
  priority?: string
}

export function useTasks(filters?: UseTasksFilters) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.role) params.set('role', filters.role)
  if (filters?.priority) params.set('priority', filters.priority)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    `/api/tasks${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
