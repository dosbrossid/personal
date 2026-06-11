'use client';

import { useState, useTransition } from 'react';
import { mutate as mutateGlobal } from 'swr';
import { Brain, Pin, ArrowUpRight, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNotes } from '@/hooks/use-notes';
import { createNote, togglePinNote } from '@/actions/notes.actions';
import { ROLES, NOTE_TYPES } from '@/core/constants';
import { formatRelativeTime } from '@/lib/utils';
import { stripNoteContent } from '@/lib/notes';
import { WidgetSkeleton } from '@/components/modules/dashboard/WidgetSkeleton';
import Link from 'next/link';

const noteTypeColors: Record<string, string> = {
  text: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  link: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  idea: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  snippet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

export function WidgetNotes() {
  const { notes, isLoading, mutate } = useNotes();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [isPinnedDraft, setIsPinnedDraft] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [pinningId, setPinningId] = useState<string | null>(null);

  const pinnedNotes = notes.filter((note) => note.is_pinned).slice(0, 2);
  const recentNotes = notes.filter((note) => !note.is_pinned).slice(0, 3);
  const pinnedCount = notes.filter((note) => note.is_pinned).length;
  const ideaCount = notes.filter((note) => note.note_type === 'idea').length;
  const emptyDraftCount = notes.filter((note) => !stripNoteContent(note.content_body).trim()).length;

  async function handleQuickCreate() {
    if (!title.trim()) {
      toast.error('Judul catatan wajib diisi');
      return;
    }

    startSaving(async () => {
      const result = await createNote({
        title: title.trim(),
        note_type: 'text',
        contextual_role: 'general',
        content_body: '',
      });

      if (result.error || !result.data) {
        toast.error(result.error ?? 'Gagal membuat catatan');
        return;
      }

      if (isPinnedDraft) {
        const pinResult = await togglePinNote(result.data.id, false);
        if (pinResult.error) {
          toast.error(pinResult.error);
          mutate();
          return;
        }
      }

      toast.success(`"${title.trim()}" berhasil dibuat`);
      setTitle('');
      setIsPinnedDraft(false);
      setShowQuickAdd(false);
      mutate();
      mutateGlobal((key: unknown) => typeof key === 'string' && key.startsWith('/api/dashboard'));
    });
  }

  async function handleTogglePin(id: string, isPinned: boolean, titleText: string) {
    setPinningId(id);
    const result = await togglePinNote(id, isPinned);
    setPinningId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isPinned ? `"${titleText}" di-unpin` : `"${titleText}" di-pin`);
    mutate();
    mutateGlobal((key: unknown) => typeof key === 'string' && key.startsWith('/api/dashboard'));
  }

  if (isLoading) {
    return <WidgetSkeleton rows={3} showStats />;
  }

  return (
    <div className="widget-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400">
            <Brain className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="ts-title text-foreground">Catatan</h2>
            <p className="text-[12px] text-muted-foreground">{notes.length} total, {pinnedCount} pinned</p>
          </div>
        </div>
        <button
          onClick={() => setShowQuickAdd((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Pinned</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{pinnedCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Ide</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{ideaCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Draft Kosong</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{emptyDraftCount}</p>
          </div>
        </div>
      </div>

      {showQuickAdd && (
        <div className="mb-4 rounded-xl border border-blue-200/60 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(168,85,247,0.06))] p-3">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleQuickCreate();
                }
              }}
              placeholder="Catatan cepat..."
              className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-primary/10"
            />
            <button
              onClick={() => setIsPinnedDraft((current) => !current)}
              className={cn(
                'h-9 rounded-lg px-3 text-[12px] font-medium transition-colors',
                isPinnedDraft
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-background text-muted-foreground border border-border/60'
              )}
            >
              Pin
            </button>
            <button
              onClick={() => void handleQuickCreate()}
              disabled={isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Simpan
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {pinnedNotes.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Pin className="h-3.5 w-3.5 rotate-45 text-amber-500" />
              <p className="text-[12px] font-semibold text-foreground">Penting</p>
            </div>
            <div className="space-y-2">
              {pinnedNotes.map((note) => (
                <NoteRow
                  key={note.id}
      note={note}
      pinningId={pinningId}
      onTogglePin={handleTogglePin}
      subtle={false}
            />
          ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {pinnedNotes.length > 0 && (
            <p className="text-[12px] font-semibold text-foreground">Terbaru</p>
          )}
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <p className="text-[13px] font-medium text-foreground">Belum ada catatan</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Catatan terbaru akan muncul di sini begitu kamu mulai menyimpan ide.</p>
            </div>
          ) : recentNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-center">
              <p className="text-[12px] text-muted-foreground">Semua catatan teratas sedang dipin.</p>
            </div>
          ) : recentNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              pinningId={pinningId}
              onTogglePin={handleTogglePin}
              subtle
            />
          ))}
        </div>
      </div>

      <Link
        href="/notes"
        className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl border border-border/60 bg-muted/30 text-[13px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
      >
        Buka Catatan
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}

function NoteRow({
  note,
  pinningId,
  onTogglePin,
  subtle,
}: {
  note: (ReturnType<typeof useNotes>['notes'])[number];
  pinningId: string | null;
  onTogglePin: (id: string, isPinned: boolean, title: string) => Promise<void>;
  subtle: boolean;
}) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl p-3 transition-all duration-200',
        subtle
          ? 'bg-muted/20 hover:bg-muted/45 border border-transparent hover:border-border/60'
          : 'bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(251,191,36,0.05))] border border-amber-500/15 hover:bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.07))]'
      )}
    >
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-transform duration-200 group-hover:scale-105',
        noteTypeColors[note.note_type] || 'bg-muted'
      )}>
        {NOTE_TYPES[note.note_type].icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[14px] font-medium text-foreground truncate">
            {note.title}
          </p>
          {note.is_pinned && (
            <Pin className="h-3 w-3 text-amber-500 shrink-0 rotate-45" />
          )}
        </div>
        <p className="text-[12px] text-muted-foreground truncate mb-2">
          {(() => {
            const preview = stripNoteContent(note.content_body);
            if (!preview) return 'Catatan masih kosong';
            return `${preview.slice(0, 60)}${preview.length > 60 ? '...' : ''}`;
          })()}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', ROLES[note.contextual_role].bgClass)}>
            {ROLES[note.contextual_role].label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {formatRelativeTime(note.created_at)}
            </span>
            <button
              onClick={() => void onTogglePin(note.id, note.is_pinned, note.title)}
              disabled={pinningId === note.id}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                note.is_pinned
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {pinningId === note.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pin className={cn('h-3.5 w-3.5', note.is_pinned && 'rotate-45')} />
              )}
            </button>
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-200 mt-3 shrink-0 translate-x-1 group-hover:translate-x-0" />
    </div>
  );
}
