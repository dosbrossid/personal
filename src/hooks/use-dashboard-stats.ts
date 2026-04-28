// ============================================================
// SWR Hook: useDashboardStats
// Read layer for dashboard stats — fetches from /api/dashboard/stats
// Auto-refreshes every 60 seconds
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { DashboardStats } from '@/core/types'

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    '/api/dashboard/stats',
    fetcher,
    { refreshInterval: 60000 } // refresh every 60 seconds
  )

  return {
    stats: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
