// ============================================================
// Telegram Bot API helper
// Server-only utilities for Settings tests, cron dispatch, and webhooks.
// ============================================================

import 'server-only'

interface TelegramSendResponse {
  ok: boolean
  description?: string
}

interface TelegramFileResponse {
  ok: boolean
  description?: string
  result?: {
    file_path?: string
    file_size?: number
  }
}

const MAX_TELEGRAM_IMAGE_BYTES = 8 * 1024 * 1024

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

export async function getTelegramFileAsDataUrl(fileId: string, mimeType = 'image/jpeg') {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN belum dikonfigurasi')
  }

  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
  const filePayload = (await fileResponse.json().catch(() => null)) as TelegramFileResponse | null

  if (!fileResponse.ok || !filePayload?.ok || !filePayload.result?.file_path) {
    throw new Error(filePayload?.description || `Telegram getFile error (${fileResponse.status})`)
  }

  if (filePayload.result.file_size && filePayload.result.file_size > MAX_TELEGRAM_IMAGE_BYTES) {
    throw new Error('Gambar terlalu besar untuk dianalisis lewat Telegram.')
  }

  const downloadResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePayload.result.file_path}`)
  if (!downloadResponse.ok) {
    throw new Error(`Telegram file download error (${downloadResponse.status})`)
  }

  const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer())
  if (fileBuffer.byteLength > MAX_TELEGRAM_IMAGE_BYTES) {
    throw new Error('Gambar terlalu besar untuk dianalisis lewat Telegram.')
  }

  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`
}
