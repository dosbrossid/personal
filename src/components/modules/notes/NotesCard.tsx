'use client';

import { Pin, MoreHorizontal, Eye, Edit3, PinOff, Copy, Trash2, ExternalLink } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { NOTE_TYPES, ROLES } from '@/core/constants';
import type { BrainNote } from '@/core/types';
import {
  getNoteExcerpt,
  getNoteWordCount,
  stripNoteContent,
} from '@/lib/notes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { noteTypeIcons, noteTypeColors, getSafeHostname, getSafeExternalHref } from './notes-constants';

function NoteCard({
  note,
  onPreview,
  onEdit,
  onPin,
  onCopy,
  onDelete,
}: {
  note: BrainNote;
  onPreview: (note: BrainNote) => void;
  onEdit: (note: BrainNote) => void;
  onPin: (note: BrainNote) => void;
  onCopy: (note: BrainNote) => void;
  onDelete: (note: BrainNote) => void;
}) {
  const typeColor = noteTypeColors[note.note_type] || '#6366f1';
  const roleData = ROLES[note.contextual_role];
  const sourceLabel = getSafeHostname(note.source_url);
  const excerpt = note.note_type === 'snippet' ? note.content_body : stripNoteContent(note.content_body);
  const preview = getNoteExcerpt(excerpt, note.note_type === 'snippet' ? 100 : 150);
  const safeHref = getSafeExternalHref(note.source_url);

  return (
    <div
      onClick={() => onPreview(note)}
      className="group widget-card cursor-pointer rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/20 hover:shadow-md hover:shadow-violet-500/10 sm:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)` }}
          >
            {noteTypeIcons[note.note_type]}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
            >
              {NOTE_TYPES[note.note_type].label}
            </span>
            {note.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Pin className="h-3 w-3 rotate-45" /> Pinned
              </span>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 border-border/60 bg-card shadow-xl rounded-xl">
              <DropdownMenuItem onClick={() => onPreview(note)} className="gap-2 text-[13px] focus:bg-muted rounded-lg">
                <Eye className="h-4 w-4 text-muted-foreground" /> Lihat Detail
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(note)} className="gap-2 text-[13px] focus:bg-muted rounded-lg">
                <Edit3 className="h-4 w-4 text-muted-foreground" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPin(note)} className="gap-2 text-[13px] focus:bg-muted rounded-lg">
                {note.is_pinned ? <PinOff className="h-4 w-4 text-muted-foreground" /> : <Pin className="h-4 w-4 text-amber-500" />}
                {note.is_pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCopy(note)} className="gap-2 text-[13px] focus:bg-muted rounded-lg">
                <Copy className="h-4 w-4 text-muted-foreground" /> Copy Konten
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/40" />
              <DropdownMenuItem onClick={() => onDelete(note)} className="gap-2 text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500 rounded-lg">
                <Trash2 className="h-4 w-4" /> Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="mb-2 line-clamp-2 text-[15px] font-semibold text-foreground transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-400">
        {note.title}
      </h3>
      <p className={cn(
        'mb-4 line-clamp-4 text-[13px] text-muted-foreground',
        note.note_type === 'snippet' && 'rounded-lg bg-muted/30 px-2 py-1.5 font-mono text-[12px] text-emerald-600 dark:text-emerald-400'
      )}>
        {preview}
      </p>

      {note.source_url && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (safeHref) window.open(safeHref, '_blank');
          }}
          className={cn(
            'mb-4 flex items-center gap-1.5 text-[12px] transition-colors',
            safeHref ? 'cursor-pointer text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground'
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {sourceLabel || note.source_url}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className={cn('w-fit rounded-full px-2 py-0.5 text-[11px] font-medium', roleData.bgClass)}>
          {roleData.icon} {roleData.label}
        </span>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/60">
          <span>{getNoteWordCount(excerpt)} kata</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span>{formatRelativeTime(note.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export { NoteCard };
