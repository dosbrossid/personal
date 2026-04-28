import type { BrainNote } from '@/core/types'

const HTML_LIKE_REGEX = /<\/?[a-z][\s\S]*>/i

export function isProbablyHtml(value: string) {
  return HTML_LIKE_REGEX.test(value)
}

export function escapeNoteHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

export function stripBasicMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

export function stripNoteContent(value: string) {
  if (!value?.trim()) return ''

  if (!isProbablyHtml(value)) {
    return stripBasicMarkdown(value)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const normalized = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<img[^>]*>/gi, ' [Gambar] ')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(normalized)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function renderInlineMarkdown(value: string) {
  return escapeNoteHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

export function markdownToHtml(value: string) {
  const lines = value.split('\n')
  const blocks: string[] = []
  let paragraphLines: string[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join('<br />'))}</p>`)
    paragraphLines = []
  }

  const flushList = () => {
    if (!listItems.length || !listType) return
    blocks.push(`<${listType}>${listItems.join('')}</${listType}>`)
    listItems = []
    listType = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/)
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/)

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    if (unorderedMatch) {
      flushParagraph()
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`)
      continue
    }

    if (orderedMatch) {
      flushParagraph()
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`)
      continue
    }

    flushList()
    paragraphLines.push(line)
  }

  flushParagraph()
  flushList()

  return blocks.join('')
}

export function sanitizeNoteHtml(value: string) {
  if (!value.trim()) return ''

  const normalized = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)b(\s[^>]*)?>/gi, '<$1strong>')
    .replace(/<(\/?)i(\s[^>]*)?>/gi, '<$1em>')
    .replace(/<(\/?)div(\s[^>]*)?>/gi, '<$1p>')
    .replace(/<img[^>]*src=(["'])(.*?)\1[^>]*>/gi, (_match, _quote: string, src: string) => {
      const safeSrc = src.replace(/"/g, '&quot;')
      return `<img src="${safeSrc}" alt="" />`
    })
    .replace(/<(\/?)([a-z0-9-]+)([^>]*)>/gi, (_match, slash: string, tag: string) => {
      const lowerTag = tag.toLowerCase()
      if (['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'img'].includes(lowerTag)) {
        if (lowerTag === 'br') {
          return slash ? '' : '<br />'
        }
        if (lowerTag === 'img') {
          return slash ? '' : _match
        }
        return `<${slash}${lowerTag}>`
      }
      return ''
    })

  return normalized
    .replace(/<(p|ul|ol)>\s*<\/\1>/gi, '')
    .replace(/(<br \/>){3,}/g, '<br /><br />')
    .trim()
}

export function getNoteRenderHtml(value: string) {
  if (!value.trim()) return ''
  return isProbablyHtml(value) ? sanitizeNoteHtml(value) : markdownToHtml(value)
}

export function getNoteEditorHtml(value: string) {
  return getNoteRenderHtml(value) || '<p></p>'
}

export function getNoteExcerpt(value: string, limit = 140) {
  const compact = stripNoteContent(value).replace(/\s+/g, ' ').trim()
  if (!compact) return 'Catatan masih kosong'
  if (compact.length <= limit) return compact
  return `${compact.slice(0, limit).trimEnd()}...`
}

export function getNoteWordCount(value: string) {
  const compact = stripNoteContent(value).trim()
  if (!compact) return 0
  return compact.split(/\s+/).length
}

export function buildSharePayload(note: Pick<BrainNote, 'title' | 'content_body' | 'source_url'>) {
  return [
    note.title,
    '',
    getNoteExcerpt(note.content_body, 240),
    note.source_url ? `Sumber: ${note.source_url}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}
