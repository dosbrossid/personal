import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { DashboardActivityResponse } from '@/core/types'

export function useDashboardActivity(options?: {
  page?: number
  limit?: number
  refreshInterval?: number
}) {
  const page = options?.page ?? 1
  const limit = options?.limit ?? 5
  const refreshInterval = options?.refreshInterval ?? 60000

  const { data, error, isLoading, mutate } = useSWR<DashboardActivityResponse>(
    `/api/dashboard/activity?page=${page}&limit=${limit}`,
    fetcher,
    { refreshInterval }
  )

  return {
    items: data?.items ?? [],
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
