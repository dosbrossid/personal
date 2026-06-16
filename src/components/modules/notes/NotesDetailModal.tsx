'use client';

import { Pin, ExternalLink, Copy, Share2, Edit3, Sparkles } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { NOTE_TYPES, ROLES } from '@/core/constants';
import type { BrainNote } from '@/core/types';
import {
  buildSharePayload,
  getNoteRenderHtml,
  getNoteWordCount,
  stripNoteContent,
} from '@/lib/notes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { noteTypeIcons, noteTypeColors, getSafeHostname, getSafeExternalHref } from './notes-constants';
import { MetaCard } from './NotesMetaCard';

function NoteDetailModal({
  note,
  onClose,
  onEdit,
}: {
  note: BrainNote | null;
  onClose: () => void;
  onEdit: (note: BrainNote) => void;
}) {
  if (!note) return null;

  const typeColor = noteTypeColors[note.note_type] || '#6366f1';
  const roleData = ROLES[note.contextual_role];
  const safeHref = getSafeExternalHref(note.source_url);
  const sourceLabel = getSafeHostname(note.source_url);
  const renderedHtml = getNoteRenderHtml(note.content_body);
  const plainContent = stripNoteContent(note.content_body);

  const handleCopy = () => {
    navigator.clipboard.writeText(plainContent);
    toast.success('Konten disalin ke clipboard!');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(buildSharePayload(note));
    toast.success('Ringkasan catatan disalin ke clipboard!');
  };

  return (
    <Dialog open={!!note} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden border-border/60 bg-card p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md shrink-0"
              style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)` }}
            >
              {noteTypeIcons[note.note_type]}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="ts-title leading-snug">{note.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
                >
                  {NOTE_TYPES[note.note_type].icon} {NOTE_TYPES[note.note_type].label}
                </span>
                <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', roleData.bgClass)}>
                  {roleData.icon} {roleData.label}
                </span>
                {note.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                    <Pin className="h-3 w-3 rotate-45" /> Pinned
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground/50 ml-auto">
                  {formatRelativeTime(note.created_at)}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
          <div className="space-y-5 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:gap-6 lg:space-y-0">
            <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:scrollbar-thin">
              <div
                className={cn(
                  'rounded-xl border p-5',
                  note.note_type === 'snippet'
                    ? 'border-zinc-800 bg-zinc-950 font-mono text-[13px] text-emerald-400'
                    : 'border-border/40 bg-muted/20 text-[14px] text-foreground'
                )}
              >
                {note.note_type === 'snippet' ? (
                  <pre className="whitespace-pre-wrap leading-relaxed">{note.content_body}</pre>
                ) : (
                    <div
                      className="prose prose-sm max-w-none break-words whitespace-normal leading-relaxed text-inherit dark:prose-invert prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-img:my-4 prose-img:max-h-[420px] prose-img:rounded-xl prose-img:border prose-img:border-border/60 prose-img:object-contain"
                      dangerouslySetInnerHTML={{ __html: renderedHtml || '<p>Catatan masih kosong.</p>' }}
                    />
                )}
              </div>

              {note.ai_summary && (
                <div className="flex items-start gap-3 rounded-xl border border-violet-500/10 bg-violet-500/5 px-4 py-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <div>
                    <p className="mb-0.5 text-[12px] font-semibold text-violet-600">AI Ringkasan</p>
                    <p className="text-[13px] leading-relaxed text-foreground/80">{note.ai_summary}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {note.source_url && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-2">
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="mb-1 text-[12px] font-semibold text-emerald-600">Source</p>
                      <p className="truncate text-[12px] text-muted-foreground">{sourceLabel || note.source_url}</p>
                      <p className="mt-1 break-all text-[12px] text-foreground/85">{note.source_url}</p>
                      {safeHref && (
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                        >
                          Buka link
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Metadata</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <MetaCard label="Dibuat" value={formatRelativeTime(note.created_at)} />
                  <MetaCard label="Diupdate" value={formatRelativeTime(note.updated_at)} />
                  <MetaCard label="Kata / Karakter" value={`${getNoteWordCount(note.content_body)} / ${stripNoteContent(note.content_body).length}`} />
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Teks Bersih</p>
                <div className="mt-2 max-h-[240px] overflow-y-auto rounded-lg bg-background/40 px-3 py-3 text-[13px] leading-relaxed text-foreground/85 scrollbar-thin">
                  <p className="whitespace-pre-wrap break-words">
                    {plainContent || 'Catatan masih kosong.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-card/95 px-4 py-4 supports-backdrop-filter:backdrop-blur sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 flex-1 gap-1.5 rounded-lg border-border/60 text-[12px] sm:flex-none">
                <Copy className="h-3.5 w-3.5 text-blue-500" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="h-8 flex-1 gap-1.5 rounded-lg border-border/60 text-[12px] sm:flex-none">
                <Share2 className="h-3.5 w-3.5 text-violet-500" />
                Share
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => { onClose(); onEdit(note); }}
              className="h-8 w-full gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-[12px] font-semibold text-white shadow-md shadow-violet-500/25 sm:w-auto"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { NoteDetailModal };
