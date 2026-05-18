import {
  callLLM,
  fetchWebWithAgent,
  searchWithAgent,
  type AgentSearchResult,
  type AgentWebFetchResult,
} from '@/lib/ai/client'
import {
  formatCurrencyAnswerFromSearch,
  formatSearchResultBlock,
  formatSearchSources,
  getEffectiveSearchQuery,
  getSearchSourceLabel,
  isCurrencySearchQuery,
} from '@/lib/ai/search-format'

interface WebAgentSource {
  title: string
  url?: string
  displayUrl?: string
}

interface SearchAnswerResult {
  answer: string
  query: string
  effectiveQuery: string
  sources: WebAgentSource[]
  fetchedPages: AgentWebFetchResult[]
}

interface FetchAnswerResult {
  answer: string
  page: AgentWebFetchResult
}

function hasUsefulSnippet(item: AgentSearchResult) {
  const snippet = item.snippet ?? ''
  return snippet.length >= 80 || /[\d]{2,}/.test(snippet)
}

function shouldFetchForSearch(query: string, results: AgentSearchResult[]) {
  const usefulSnippets = results.filter(hasUsefulSnippet).length
  const asksForConcreteAnswer = /\b(berapa|kurs|harga|rate|nilai|siapa|kapan|dimana|kenapa|bagaimana|apa|update|terbaru|hari ini|sekarang|review|bandingkan|compare)\b/i.test(query)
  const asksForSummary = /\b(ringkas|rangkum|analisa|analisis|baca|cek)\b/i.test(query)
  return (asksForConcreteAnswer && usefulSnippets < 2) || asksForSummary
}

function getFetchableSearchResults(results: AgentSearchResult[]) {
  const seen = new Set<string>()
  return results.filter((item) => {
    if (!item.url) return false
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

async function fetchTopSearchPages(results: AgentSearchResult[], limit = 2) {
  const targets = getFetchableSearchResults(results).slice(0, limit)
  const settled = await Promise.allSettled(targets.map((item) => fetchWebWithAgent({ url: item.url! })))
  return settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
}

function buildSearchToolContext(results: AgentSearchResult[], fetchedPages: AgentWebFetchResult[]) {
  const searchBlocks = results.map(formatSearchResultBlock).join('\n\n') || 'No search results.'
  const fetchedBlocks = fetchedPages
    .map((page, index) => [
      `FETCHED PAGE ${index + 1}`,
      page.title ? `Title: ${page.title}` : '',
      page.url ? `URL: ${page.url}` : '',
      page.content.slice(0, 4500),
    ].filter(Boolean).join('\n'))
    .join('\n\n')

  return [
    'SEARCH RESULTS:',
    searchBlocks,
    fetchedBlocks ? '\nFETCHED CONTENT:' : '',
    fetchedBlocks,
  ].filter(Boolean).join('\n')
}

function buildFallbackSearchAnswer(query: string, results: AgentSearchResult[]) {
  if (!results.length) return `Saya belum menemukan hasil web untuk "${query}".`

  const useful = results.filter((item) => item.snippet)
  if (useful.length) {
    return [
      `Saya menemukan beberapa petunjuk untuk "${query}", tapi belum cukup kuat untuk jawaban final:`,
      useful.slice(0, 4).map((item) => `• ${item.snippet} (${getSearchSourceLabel(item)})`).join('\n'),
      '',
      'Kalau kamu mau, saya bisa lanjut baca sumber teratas dengan web fetch.',
    ].join('\n')
  }

  return [
    `Saya menemukan sumber untuk "${query}", tapi hasil search belum membawa isi yang cukup.`,
    formatSearchSources(results),
    'Perlu web fetch ke salah satu sumber untuk mengambil detailnya.',
  ].join('\n\n')
}

export async function answerSearchWithAgent(params: {
  query: string
  instruction: string
  maxChars?: number
}): Promise<SearchAnswerResult> {
  const effectiveQuery = getEffectiveSearchQuery(params.query)
  const results = await searchWithAgent({ query: effectiveQuery, limit: 6 })

  const deterministicAnswer = formatCurrencyAnswerFromSearch(effectiveQuery, results)
  if (deterministicAnswer) {
    return {
      answer: deterministicAnswer,
      query: params.query,
      effectiveQuery,
      sources: results,
      fetchedPages: [],
    }
  }

  const fetchedPages = shouldFetchForSearch(effectiveQuery, results)
    ? await fetchTopSearchPages(results, isCurrencySearchQuery(effectiveQuery) ? 3 : 2)
    : []

  const context = buildSearchToolContext(results, fetchedPages)

  try {
    const { raw } = await callLLM([
      {
        role: 'system',
        content: [
          'Kamu adalah web research agent untuk personal assistant Indonesia.',
          'Tugasmu menjawab pertanyaan user dari SEARCH RESULTS dan FETCHED CONTENT saja.',
          'Jawab inti dulu. Jangan mulai dari daftar link.',
          'Kalau ada angka, kurs, harga, tanggal, status, atau nama konkret, sebutkan eksplisit di awal.',
          'Kalau data tidak cukup, bilang apa yang kurang dan sumber mana yang perlu dibuka, jangan mengarang.',
          'Jangan tampilkan URL redirect panjang. Sebutkan nama sumber/domain saja.',
          'Gunakan Markdown ringan: bullet, numbering, bold seperlunya.',
          `Maksimal ${params.maxChars ?? 1400} karakter.`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `PERTANYAAN USER: ${params.instruction}`,
          `QUERY SEARCH: ${effectiveQuery}`,
          context,
        ].join('\n\n'),
      },
    ], { temperature: 0.15 })

    const answer = raw.trim()
    return {
      answer: answer ? answer.slice(0, params.maxChars ?? 1400) : buildFallbackSearchAnswer(params.query, results),
      query: params.query,
      effectiveQuery,
      sources: results,
      fetchedPages,
    }
  } catch {
    return {
      answer: buildFallbackSearchAnswer(params.query, results),
      query: params.query,
      effectiveQuery,
      sources: results,
      fetchedPages,
    }
  }
}

export async function answerFetchWithAgent(params: {
  url: string
  instruction: string
  maxChars?: number
}): Promise<FetchAnswerResult> {
  const page = await fetchWebWithAgent({ url: params.url })

  try {
    const { raw } = await callLLM([
      {
        role: 'system',
        content: [
          'Kamu adalah web fetch reader untuk personal assistant Indonesia.',
          'Jawab permintaan user dari konten halaman saja.',
          'Jangan dump isi halaman mentah. Ambil inti, data penting, angka, tanggal, dan langkah praktis.',
          'Kalau halaman tidak relevan atau konten kosong, bilang jelas.',
          'Gunakan Markdown ringan dan enak dibaca.',
          `Maksimal ${params.maxChars ?? 1400} karakter.`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `INSTRUKSI USER: ${params.instruction}`,
          page.title ? `TITLE: ${page.title}` : '',
          page.url ? `URL: ${page.url}` : `URL: ${params.url}`,
          'CONTENT:',
          page.content.slice(0, 12000),
        ].filter(Boolean).join('\n'),
      },
    ], { temperature: 0.15 })

    const answer = raw.trim().slice(0, params.maxChars ?? 1400)
    return {
      answer: answer || `Saya berhasil membaca halaman, tapi belum menemukan isi yang cukup jelas untuk diringkas. Sumber: ${page.title ?? page.url ?? params.url}`,
      page,
    }
  } catch {
    return {
      answer: [
        page.title ? `Ringkasan ${page.title}:` : 'Ringkasan halaman:',
        page.content.trim().slice(0, params.maxChars ?? 1400),
      ].join('\n\n'),
      page,
    }
  }
}
