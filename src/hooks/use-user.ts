// ============================================================
// SWR Hook: useUser
// Read layer for user profile — fetches from /api/user
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { User } from '@/core/types'

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<User>(
    '/api/user',
    fetcher
  )

  return {
    user: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
