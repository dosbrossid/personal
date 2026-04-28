// ============================================================
// Auth Helpers
// Used in: Route Handlers, Server Actions
// Every endpoint MUST call requireAuth() — NO EXCEPTION
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function getDefaultFullName(user: SupabaseUser) {
  const fullName = user.user_metadata?.full_name

  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim()
  }

  if (typeof user.email === 'string' && user.email.trim()) {
    return user.email.split('@')[0]
  }

  return 'User'
}

export async function ensureUserProfile(user: SupabaseUser) {
  const supabase = await createServerClient()

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', user.id)
    .maybeSingle()

  if (existingUserError) {
    throw new Error(`Gagal memeriksa profil user: ${existingUserError.message}`)
  }

  if (!existingUser) {
    const { error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email ?? `${user.id}@local.invalid`,
        full_name: getDefaultFullName(user),
      })

    if (error) {
      throw new Error(`Gagal menyiapkan profil user: ${error.message}`)
    }

    return
  }

  if (user.email && existingUser.email !== user.email) {
    const { error } = await supabase
      .from('users')
      .update({ email: user.email })
      .eq('id', user.id)

    if (error) {
      throw new Error(`Gagal menyelaraskan email user: ${error.message}`)
    }
  }
}

/**
 * Get the currently authenticated user.
 * Returns null if not authenticated.
 */
export async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Require authentication — throws if not authenticated.
 * Use this at the top of every Route Handler and Server Action.
 */
export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  await ensureUserProfile(user)

  return user
}
