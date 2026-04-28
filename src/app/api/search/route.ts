// ============================================================
// Route Handler: /api/search
// GET — Global cross-module search using Supabase text search
// Used by CommandPalette (Cmd+K)
// ============================================================

import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { stripNoteContent } from '@/lib/notes'

interface SearchResult {
  id: string
  type: 'note' | 'task' | 'vault' | 'calendar'
  title: string
  description: string | null
  role: string
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return Response.json([])
    }

    // Search across all modules in parallel using ILIKE
    const searchPattern = `%${query}%`

    const [notesRes, tasksRes, vaultRes, calendarRes] = await Promise.all([
      supabase
        .from('brain_notes')
        .select('id, title, content_body, contextual_role')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .or(`title.ilike.${searchPattern},content_body.ilike.${searchPattern}`)
        .order('updated_at', { ascending: false })
        .limit(5),

      supabase
        .from('tasks')
        .select('id, title, description, contextual_role')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order('updated_at', { ascending: false })
        .limit(5),

      supabase
        .from('academic_vault_items')
        .select('id, title, description, document_type')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order('updated_at', { ascending: false })
        .limit(5),

      supabase
        .from('calendar_events')
        .select('id, title, description, contextual_role')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order('start_at', { ascending: false })
        .limit(5),
    ])

    const results: SearchResult[] = []

    // Map notes
    if (notesRes.data) {
      for (const note of notesRes.data) {
        results.push({
          id: note.id,
          type: 'note',
          title: note.title,
          description: stripNoteContent(note.content_body || '').slice(0, 100) || null,
          role: note.contextual_role || 'general',
        })
      }
    }

    // Map tasks
    if (tasksRes.data) {
      for (const task of tasksRes.data) {
        results.push({
          id: task.id,
          type: 'task',
          title: task.title,
          description: task.description?.slice(0, 100) || null,
          role: task.contextual_role || 'general',
        })
      }
    }

    // Map vault
    if (vaultRes.data) {
      for (const item of vaultRes.data) {
        results.push({
          id: item.id,
          type: 'vault',
          title: item.title,
          description: item.description?.slice(0, 100) || null,
          role: 'dosen',
        })
      }
    }

    // Map calendar
    if (calendarRes.data) {
      for (const event of calendarRes.data) {
        results.push({
          id: event.id,
          type: 'calendar',
          title: event.title,
          description: event.description?.slice(0, 100) || null,
          role: event.contextual_role || 'general',
        })
      }
    }

    return Response.json(results)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
