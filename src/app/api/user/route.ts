// ============================================================
// Route Handler: /api/user
// GET — Retrieve current user profile
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { ensureUserProfile, requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const authUser = await requireAuth()
    const supabase = await createServerClient()

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        await ensureUserProfile(authUser)

        const { data: recoveredUser, error: recoveredError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (recoveredError) {
          return Response.json({ error: recoveredError.message }, { status: 500 })
        }

        return Response.json(recoveredUser)
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(user)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
