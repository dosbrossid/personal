import { FileText, Link2, Lightbulb, Code2 } from 'lucide-react';

export const noteTypeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  idea: <Lightbulb className="h-4 w-4" />,
  snippet: <Code2 className="h-4 w-4" />,
};

export const noteTypeColors: Record<string, string> = {
  text: '#6366f1',
  link: '#10b981',
  idea: '#f59e0b',
  snippet: '#ec4899',
};

export function getSafeHostname(url?: string | null) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').slice(0, 40);
  }
}

export function getSafeExternalHref(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
