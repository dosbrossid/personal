// ============================================================
// Auth Redirect Helpers
// Keeps post-login redirects local and predictable.
// ============================================================

const DEFAULT_REDIRECT_PATH = '/'

export function normalizeRedirectPath(
  value: string | string[] | null | undefined
): string {
  const candidate = Array.isArray(value) ? value[0] : value

  if (!candidate) {
    return DEFAULT_REDIRECT_PATH
  }

  const trimmed = candidate.trim()

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return DEFAULT_REDIRECT_PATH
  }

  try {
    const decoded = decodeURIComponent(trimmed)

    if (!decoded.startsWith('/') || decoded.startsWith('//')) {
      return DEFAULT_REDIRECT_PATH
    }

    if (decoded.startsWith('/api') || decoded.startsWith('/login')) {
      return DEFAULT_REDIRECT_PATH
    }

    return decoded
  } catch {
    return DEFAULT_REDIRECT_PATH
  }
}

export function buildLoginRedirectTarget(pathname: string, search: string): string {
  return normalizeRedirectPath(`${pathname}${search}`)
}
