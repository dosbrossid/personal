// ============================================================
// Route Handler: /api/cron/notifications
// GET — Dispatch pending notifications from a trusted scheduler.
// ============================================================

import { type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendTelegramMessage } from '@/lib/telegram'

interface PendingNotification {
  id: string
  user_id: string
  channel: 'push' | 'telegram'
  title: string
  body: string
  scheduled_at: string | null
  retry_count: number
  users?: { telegram_chat_id: string | null } | Array<{ telegram_chat_id: string | null }> | null
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return bearer === cronSecret || querySecret === cronSecret
}

function getTelegramChatId(row: PendingNotification) {
  if (Array.isArray(row.users)) {
    return row.users[0]?.telegram_chat_id ?? null
  }

  return row.users?.telegram_chat_id ?? null
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()
    const now = new Date()

    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, channel, title, body, scheduled_at, retry_count, users(telegram_chat_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const pending = ((data ?? []) as PendingNotification[]).filter((notification) => {
      if (!notification.scheduled_at) return true
      return new Date(notification.scheduled_at).getTime() <= now.getTime()
    })

    let sent = 0
    let failed = 0

    for (const notification of pending) {
      try {
        if (notification.channel === 'telegram') {
          const chatId = getTelegramChatId(notification)

          if (!chatId) {
            throw new Error('User belum punya telegram_chat_id')
          }

          await sendTelegramMessage(chatId, `${notification.title}\n\n${notification.body}`)
        }

        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', notification.id)

        if (updateError) throw updateError
        sent += 1
      } catch (error) {
        failed += 1
        await supabase
          .from('notifications')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Gagal dispatch notifikasi',
            retry_count: (notification.retry_count ?? 0) + 1,
          })
          .eq('id', notification.id)
      }
    }

    return Response.json({ processed: pending.length, sent, failed })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
