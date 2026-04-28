// ============================================================
// Auth Server Actions
// Handles: login, signup, logout (email/password only)
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/core/types'

/**
 * Login with email + password
 */
export async function loginAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    const supabase = await createServerClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email?.trim()) return { data: null, error: 'Email wajib diisi' }
    if (!password) return { data: null, error: 'Password wajib diisi' }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      // Map common Supabase auth errors to Indonesian
      if (error.message.includes('Invalid login credentials')) {
        return { data: null, error: 'Email atau password salah' }
      }
      if (error.message.includes('Email not confirmed')) {
        return { data: null, error: 'Email belum diverifikasi. Cek inbox Anda.' }
      }
      return { data: null, error: error.message }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await ensureUserProfile(user)
    }

    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Sign up with email + password
 */
export async function signupAction(formData: FormData): Promise<ActionResult<null>> {
  try {
    const supabase = await createServerClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('full_name') as string

    if (!email?.trim()) return { data: null, error: 'Email wajib diisi' }
    if (!password || password.length < 6) {
      return { data: null, error: 'Password minimal 6 karakter' }
    }
    if (!fullName?.trim()) return { data: null, error: 'Nama lengkap wajib diisi' }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return { data: null, error: 'Email sudah terdaftar' }
      }
      return { data: null, error: error.message }
    }

    if (data.user && data.session) {
      await ensureUserProfile(data.user)
    }

    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Logout — clear session and redirect to login
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
