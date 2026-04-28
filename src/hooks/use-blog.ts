// ============================================================
// SWR Hook: useBlogPosts, useBlogPost, useBlogTags
// Read layer for blog module — fetches from /api/blog/*
// ============================================================

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { BlogPost, BlogTag } from '@/core/types'

export function useBlogPosts(filters?: { status?: string }) {
  const params = filters?.status ? `?status=${filters.status}` : ''

  const { data, error, isLoading, mutate } = useSWR<BlogPost[]>(
    `/api/blog/posts${params}`,
    fetcher
  )

  return {
    posts: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useBlogPost(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<BlogPost>(
    id ? `/api/blog/posts/${id}` : null,
    fetcher
  )

  return {
    post: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useBlogTags() {
  const { data, error, isLoading, mutate } = useSWR<BlogTag[]>(
    '/api/blog/tags',
    fetcher
  )

  return {
    tags: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
