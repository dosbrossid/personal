const HTML_LIKE_REGEX = /<\/?[a-z][\s\S]*>/i;
const SAFE_COLOR_REGEX =
  /^(#[0-9a-f]{3,8}|rgb(a)?\([\d\s,.%]+\)|hsl(a)?\([\d\s,.%]+\)|[a-z]{3,20})$/i;
const SAFE_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const SAFE_IMAGE_WIDTH_REGEX = /^(100|[1-9]?\d)(\.\d+)?%$|^\d{1,4}px$/i;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function escapeBlogHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isProbablyHtml(value: string) {
  return HTML_LIKE_REGEX.test(value);
}

function sanitizeCssColor(value: string) {
  const normalized = value.trim().toLowerCase();
  return SAFE_COLOR_REGEX.test(normalized) ? normalized : null;
}

function extractInlineStyle(attrs: string, property: string) {
  const styleMatch = attrs.match(/\sstyle=["']([^"']+)["']/i)?.[1];
  if (!styleMatch) return null;

  const styleParts = styleMatch
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of styleParts) {
    const [rawName, rawValue] = part.split(':');
    if (!rawName || !rawValue) continue;
    if (rawName.trim().toLowerCase() === property) {
      return rawValue.trim();
    }
  }

  return null;
}

function extractSafeAlign(attrs: string) {
  const styleAlign = extractInlineStyle(attrs, 'text-align');
  const attrAlign = attrs.match(/\salign=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  const candidate = styleAlign?.toLowerCase() || attrAlign || null;

  if (!candidate || !SAFE_ALIGNMENTS.has(candidate)) {
    return null;
  }

  return candidate;
}

function extractSafeSpanStyle(attrs: string) {
  const color = sanitizeCssColor(extractInlineStyle(attrs, 'color') || '');
  const backgroundColor = sanitizeCssColor(extractInlineStyle(attrs, 'background-color') || '');
  const styleEntries = [
    color ? `color:${color}` : null,
    backgroundColor ? `background-color:${backgroundColor}` : null,
  ].filter(Boolean);

  return styleEntries.length > 0 ? ` style="${styleEntries.join(';')}"` : '';
}

function sanitizeImageWidth(value: string) {
  const normalized = value.trim().toLowerCase();
  return SAFE_IMAGE_WIDTH_REGEX.test(normalized) ? normalized : null;
}

function extractSafeImageWidth(attrs: string) {
  const explicitStyle = sanitizeImageWidth(extractInlineStyle(attrs, 'width') || '');
  if (explicitStyle) return explicitStyle;

  const dataSize = attrs.match(/\sdata-size=["']([^"']+)["']/i)?.[1];
  if (dataSize) {
    const parsedPercent = Number.parseFloat(dataSize);
    if (Number.isFinite(parsedPercent) && parsedPercent >= 10 && parsedPercent <= 100) {
      return `${parsedPercent}%`;
    }
  }

  const widthAttr = attrs.match(/\swidth=["']([^"']+)["']/i)?.[1];
  if (!widthAttr) return null;

  const safeWidth = sanitizeImageWidth(widthAttr);
  if (safeWidth) return safeWidth;

  const numeric = Number.parseFloat(widthAttr);
  if (Number.isFinite(numeric) && numeric > 0 && numeric <= 1000) {
    return `${numeric}px`;
  }

  return null;
}

function extractSafeImageAlign(attrs: string) {
  const dataAlign = attrs.match(/\sdata-align=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  if (dataAlign && ['left', 'center', 'right'].includes(dataAlign)) {
    return dataAlign;
  }

  const marginLeft = extractInlineStyle(attrs, 'margin-left')?.toLowerCase();
  const marginRight = extractInlineStyle(attrs, 'margin-right')?.toLowerCase();

  if (marginLeft === 'auto' && marginRight === 'auto') return 'center';
  if (marginLeft === 'auto') return 'right';
  if (marginRight === 'auto') return 'left';

  return 'center';
}

function buildSafeImageStyle(width: string | null, align: string) {
  const styleEntries = ['max-width:100%', 'height:auto'];

  if (width) {
    styleEntries.unshift(`width:${width}`);
  }

  if (align === 'left') {
    styleEntries.push('display:block', 'margin-left:0', 'margin-right:auto');
  } else if (align === 'right') {
    styleEntries.push('display:block', 'margin-left:auto', 'margin-right:0');
  } else {
    styleEntries.push('display:block', 'margin-left:auto', 'margin-right:auto');
  }

  return styleEntries.join(';');
}

export function sanitizeBlogHtml(value: string) {
  if (!value.trim()) return '';

  const normalized = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)b(\s[^>]*)?>/gi, '<$1strong>')
    .replace(/<(\/?)i(\s[^>]*)?>/gi, '<$1em>')
    .replace(/<(\/?)u(\s[^>]*)?>/gi, '<$1u>')
    .replace(/<(\/?)(strike|del)(\s[^>]*)?>/gi, '<$1s>')
    .replace(/<(\/?)div(\s[^>]*)?>/gi, '<$1p>')
    .replace(/<font([^>]*)color=["']([^"']+)["'][^>]*>/gi, (_match, _before: string, color: string) => {
      const safeColor = sanitizeCssColor(color);
      if (!safeColor) return '<span>';
      return `<span style="color:${safeColor}">`;
    })
    .replace(/<\/font>/gi, '</span>')
    .replace(/<(\/?)([a-z0-9-]+)([^>]*)>/gi, (_match, slash: string, tag: string, attrs: string) => {
      const lowerTag = tag.toLowerCase();

      if (['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2'].includes(lowerTag)) {
        if (lowerTag === 'br') {
          return slash ? '' : '<br />';
        }

        if (slash) {
          return `</${lowerTag}>`;
        }

        const align = extractSafeAlign(attrs);
        return align ? `<${lowerTag} style="text-align:${align}">` : `<${lowerTag}>`;
      }

      if (lowerTag === 'span') {
        if (slash) return '</span>';
        return `<span${extractSafeSpanStyle(attrs)}>`;
      }

      if (lowerTag === 'img' && !slash) {
        const srcMatch = attrs.match(/\ssrc=["']([^"']+)["']/i);
        const altMatch = attrs.match(/\salt=["']([^"']*)["']/i);
        if (!srcMatch?.[1]) return '';
        const safeSrc = srcMatch[1].trim();
        const safeAlt = altMatch?.[1]?.trim() || '';
        if (!/^https?:\/\//i.test(safeSrc)) return '';
        const imageWidth = extractSafeImageWidth(attrs);
        const imageAlign = extractSafeImageAlign(attrs);
        const imageStyle = buildSafeImageStyle(imageWidth, imageAlign);
        return `<img src="${escapeBlogHtml(safeSrc)}" alt="${escapeBlogHtml(safeAlt)}" data-align="${imageAlign}"${imageWidth ? ` data-size="${escapeBlogHtml(imageWidth.replace('%', ''))}"` : ''} style="${imageStyle}" />`;
      }

      return '';
    });

  return normalized
    .replace(/<(p|blockquote|h1|h2|ul|ol)>\s*<\/\1>/gi, '')
    .replace(/(<br \/>){3,}/g, '<br /><br />')
    .trim();
}

export function stripBlogContent(value: string) {
  if (!value?.trim()) return '';

  const normalized = (isProbablyHtml(value) ? value : escapeBlogHtml(value))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|ul|ol|h1|h2|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(normalized)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function getBlogEditorHtml(value: string) {
  return sanitizeBlogHtml(value) || '<p></p>';
}

export function getBlogWordStats(value: string) {
  const compact = stripBlogContent(value);
  const words = compact ? compact.split(/\s+/).filter(Boolean).length : 0;

  return {
    word_count: words,
    reading_time_minutes: Math.max(1, Math.ceil(words / 200)),
  };
}
