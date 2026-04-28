// ============================================================
// SWR Hook: useNotifications
// Read layer for notifications — fetches from /api/notifications
// Auto-refreshes every 30 seconds
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { Notification } from '@/core/types'

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 30000 } // refresh every 30 seconds
  )

  return {
    notifications: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
