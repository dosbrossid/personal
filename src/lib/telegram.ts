// ============================================================
// Telegram Bot API helper
// Server-only utilities for Settings tests, cron dispatch, and webhooks.
// ============================================================

import 'server-only'

interface TelegramSendResponse {
  ok: boolean
  description?: string
}

export function hasTelegramConfig() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN belum dikonfigurasi')
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  const payload = (await response.json().catch(() => null)) as TelegramSendResponse | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API error (${response.status})`)
  }

  return payload
}
