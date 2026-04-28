// ============================================================
// SWR Hook: useNotes
// Read layer for brain notes module — fetches from /api/notes
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { BrainNote } from '@/core/types'

interface UseNotesFilters {
  type?: string
  role?: string
  pinned?: boolean
}

export function useNotes(filters?: UseNotesFilters) {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.role) params.set('role', filters.role)
  if (filters?.pinned) params.set('pinned', 'true')
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<BrainNote[]>(
    `/api/notes${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    notes: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
