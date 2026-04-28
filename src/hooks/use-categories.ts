// ============================================================
// SWR Hook: useCategories
// Read layer for categories — fetches from /api/categories
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { Category } from '@/core/types'

export function useCategories(filters?: { role?: string }) {
  const params = new URLSearchParams()
  if (filters?.role) params.set('role', filters.role)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<Category[]>(
    `/api/categories${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    categories: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
