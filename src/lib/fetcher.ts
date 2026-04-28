// ============================================================
// SWR Fetcher
// Dedicated fetcher with proper error handling for SWR hooks
// ============================================================

export const fetcher = async (url: string) => {
  const res = await fetch(url)

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    const fetchError = new Error(error.error || 'Request failed') as Error & {
      status?: number
    }
    fetchError.status = res.status
    throw fetchError
  }

  return res.json()
}
