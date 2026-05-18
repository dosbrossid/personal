import type { AgentSearchResult } from '@/lib/ai/client'

export function isCurrencySearchQuery(query: string) {
  return /\b(kurs|exchange rate|usd|idr|dollar|rupiah)\b/i.test(query)
}

export function getEffectiveSearchQuery(query: string) {
  if (!isCurrencySearchQuery(query)) return query
  if (/\b(usd|dollar)\b/i.test(query) && /\b(idr|rupiah)\b/i.test(query)) {
    return 'kurs dollar hari ini'
  }
  return query
}

export function getSearchSourceLabel(item: Pick<AgentSearchResult, 'title' | 'url' | 'displayUrl'>) {
  if (item.displayUrl) return item.displayUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (!item.url) return item.title
  try {
    return new URL(item.url).hostname.replace(/^www\./, '')
  } catch {
    return item.title
  }
}

export function formatSearchSources(results: Pick<AgentSearchResult, 'title' | 'url' | 'displayUrl'>[], limit = 4) {
  return results
    .slice(0, limit)
    .map((item, index) => `${index + 1}. ${item.title} (${getSearchSourceLabel(item)})`)
    .join('\n')
}

export function formatSearchResultBlock(item: AgentSearchResult, index: number) {
  return [
    `${index + 1}. ${item.title}`,
    `Source: ${getSearchSourceLabel(item)}`,
    item.snippet ? `Snippet: ${item.snippet}` : '',
  ].filter(Boolean).join('\n')
}

function normalizeCurrencyNumber(value: string) {
  return value.trim()
}

export function formatCurrencyAnswerFromSearch(query: string, results: AgentSearchResult[]) {
  if (!isCurrencySearchQuery(query)) return null

  const bankRates: string[] = []
  const singleRates: string[] = []

  for (const item of results) {
    const snippet = item.snippet ?? ''
    if (!snippet) continue

    for (const match of snippet.matchAll(/\b(BI|BCA|Mandiri|BNI|BRI)\s*:\s*([\d.,]+)\s*\/\s*([\d.,]+)/gi)) {
      const bank = match[1].toUpperCase() === 'BI' ? 'BI' : match[1]
      bankRates.push(`• ${bank}: beli ${normalizeCurrencyNumber(match[2])} / jual ${normalizeCurrencyNumber(match[3])}`)
    }

    const currentRate = snippet.match(/\bcurrently\s+([\d.,]+)\b/i)
    if (currentRate) {
      singleRates.push(`• ${getSearchSourceLabel(item)}: sekitar ${normalizeCurrencyNumber(currentRate[1])}`)
    }
  }

  const uniqueBankRates = [...new Set(bankRates)]
  const uniqueSingleRates = [...new Set(singleRates)]
  if (uniqueBankRates.length === 0 && uniqueSingleRates.length === 0) return null

  return [
    '💱 Kurs USD/IDR hari ini dari hasil pencarian:',
    uniqueBankRates.length ? uniqueBankRates.slice(0, 6).join('\n') : null,
    uniqueSingleRates.length ? uniqueSingleRates.slice(0, 3).join('\n') : null,
    '',
    'Catatan: angka kurs bisa beda antara kurs tengah, TT counter, e-rate, dan kurs pasar/live. Untuk transaksi, cek sumber bank/exchange yang kamu pakai.',
  ].filter(Boolean).join('\n')
}
