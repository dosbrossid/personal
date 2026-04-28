import useSWR from 'swr'

import { fetcher } from '@/lib/fetcher'
import type { ClassCourse, ClassSession } from '@/core/types'

interface UseClassesOptions {
  status?: string
  semester?: string
  query?: string
}

export function useClasses(options?: UseClassesOptions) {
  const searchParams = new URLSearchParams()

  if (options?.status) {
    searchParams.set('status', options.status)
  }

  if (options?.semester) {
    searchParams.set('semester', options.semester)
  }

  if (options?.query) {
    searchParams.set('query', options.query)
  }

  const query = searchParams.toString()

  const { data, error, isLoading, mutate } = useSWR<ClassCourse[]>(
    `/api/classes${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    classes: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useClass(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ClassCourse>(
    id ? `/api/classes/${id}` : null,
    fetcher
  )

  return {
    classCourse: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useClassSessions(classId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ClassSession[]>(
    classId ? `/api/classes/${classId}/sessions` : null,
    fetcher
  )

  return {
    sessions: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
