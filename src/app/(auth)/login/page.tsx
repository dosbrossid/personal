import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { getUser } from '@/lib/auth'
import { normalizeRedirectPath } from '@/lib/auth-redirect'

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string | string[]
    mode?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUser()

  if (user) {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const redirectTo = normalizeRedirectPath(resolvedSearchParams.redirect)
  const modeParam = Array.isArray(resolvedSearchParams.mode)
    ? resolvedSearchParams.mode[0]
    : resolvedSearchParams.mode

  const initialMode = modeParam === 'signup' ? 'signup' : 'login'

  return <LoginForm initialMode={initialMode} redirectTo={redirectTo} />
}
