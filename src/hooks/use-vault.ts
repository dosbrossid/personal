// ============================================================
// SWR Hook: useVaultItems
// Read layer for academic vault — fetches from /api/vault
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { AcademicVaultItem } from '@/core/types'

interface UseVaultFilters {
  docType?: string
  semester?: string
  mataKuliah?: string
}

export function useVaultItems(filters?: UseVaultFilters) {
  const params = new URLSearchParams()
  if (filters?.docType) params.set('doc_type', filters.docType)
  if (filters?.semester) params.set('semester', filters.semester)
  if (filters?.mataKuliah) params.set('mata_kuliah', filters.mataKuliah)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<AcademicVaultItem[]>(
    `/api/vault${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    items: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
