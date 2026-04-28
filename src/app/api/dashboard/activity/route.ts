// ============================================================
// Route Handler: /api/dashboard/activity
// GET — Latest dashboard activity feed from audit logs.
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { DashboardActivityItem, DashboardActivityResponse } from '@/core/types'

function pickTitle(record: Record<string, unknown> | null) {
  const title = record?.title
  if (typeof title === 'string' && title.trim()) return title.trim()
  return null
}

function getTableLabel(tableName: string) {
  const labels: Record<string, string> = {
    tasks: 'Task',
    brain_notes: 'Catatan',
    habits: 'Habit',
    calendar_events: 'Agenda',
    academic_vault_items: 'Vault',
    blog_posts: 'Blog',
  }

  return labels[tableName] ?? tableName
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    insert: 'dibuat',
    update: 'diperbarui',
    delete: 'dihapus',
  }

  return labels[action] ?? action
}

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    const pageParam = Number(searchParams.get('page') ?? '1')
    const limitParam = Number(searchParams.get('limit') ?? DEFAULT_LIMIT.toString())
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT
    const offset = (page - 1) * limit

    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, table_name, action, old_data, new_data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const hasMore = rows.length > limit

    const items: DashboardActivityItem[] = rows.slice(0, limit).map((log) => {
      const oldData =
        log.old_data && typeof log.old_data === 'object'
          ? (log.old_data as Record<string, unknown>)
          : null
      const newData =
        log.new_data && typeof log.new_data === 'object'
          ? (log.new_data as Record<string, unknown>)
          : null

      const title = pickTitle(newData) || pickTitle(oldData) || getTableLabel(log.table_name)
      const actionLabel = getActionLabel(log.action)
      const tableLabel = getTableLabel(log.table_name)

      return {
        id: log.id,
        table_name: log.table_name,
        action: log.action,
        title,
        description: `${tableLabel} ${actionLabel}`,
        created_at: log.created_at,
      }
    })

    const payload: DashboardActivityResponse = {
      items,
      page,
      limit,
      hasMore,
    }

    return Response.json(payload)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
