'use client';

import { useState } from 'react';

import {
  Brain, Plus, Pin, Search, Filter, BookOpen, Lightbulb, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/shared/StatCard';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { useNotes } from '@/hooks/use-notes';
import { createNote, updateNote, togglePinNote, deleteNote as deleteNoteAction } from '@/actions/notes.actions';
import { toast } from 'sonner';
import { NOTE_TYPES } from '@/core/constants';
import type { RoleContext, NoteType } from '@/core/constants';
import type { BrainNote } from '@/core/types';
import { isToday, subDays } from 'date-fns';
import { stripNoteContent } from '@/lib/notes';
import { Button } from '@/components/ui/button';
import { NoteEditorModal } from '@/components/modules/notes/NotesEditorModal';
import { NoteDetailModal } from '@/components/modules/notes/NotesDetailModal';
import { DeleteConfirmModal } from '@/components/modules/notes/NotesDeleteModal';
import { NoteCard } from '@/components/modules/notes/NotesCard';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

// Toast is now handled by Sonner



const roleFilters = [
  { key: 'all', label: 'Semua', icon: '⚡' },
  { key: 'dosen', label: 'Dosen', icon: '🎓' },
  { key: 'creator', label: 'Kreator', icon: '🎨' },
  { key: 'affiliate', label: 'Afiliator', icon: '📱' },
  { key: 'consultant', label: 'Konsultan', icon: '💼' },
  { key: 'general', label: 'Umum', icon: '⭐' },
];

const timeFilters = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'all', label: 'Semua' },
];

// ─────────────────────────────────────
// Main Page
// ─────────────────────────────────────

export default function NotesPage() {
  const { notes, isLoading, mutate } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleContext | 'all'>('all');
  const [selectedTime, setSelectedTime] = useState('all');
  const [selectedType, setSelectedType] = useState<NoteType | 'all'>('all');

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editingNote, setEditNote] = useState<BrainNote | null>(null);
  const [previewNote, setPreviewNote] = useState<BrainNote | null>(null);
  const [deletingNote, setDeleteNote] = useState<BrainNote | null>(null);

  const filtered = notes.filter((note) => {
    if (selectedRole !== 'all' && note.contextual_role !== selectedRole) return false;
    if (selectedType !== 'all' && note.note_type !== selectedType) return false;
    const createdAt = new Date(note.created_at);
    if (selectedTime === 'today' && !isToday(createdAt)) return false;
    if (selectedTime === '7d' && createdAt < subDays(new Date(), 7)) return false;
    if (selectedTime === '30d' && createdAt < subDays(new Date(), 30)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return note.title.toLowerCase().includes(q) || stripNoteContent(note.content_body).toLowerCase().includes(q);
    }
    return true;
  });

  const pinnedNotes = filtered.filter(n => n.is_pinned);
  const unpinnedNotes = filtered.filter(n => !n.is_pinned);
  const totalNotes = notes.length;
  const pinnedCount = notes.filter(n => n.is_pinned).length;

  // Action handlers
  const handlePin = async (note: BrainNote) => {
    const result = await togglePinNote(note.id, note.is_pinned);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(note.is_pinned ? `"${note.title}" di-unpin` : `"${note.title}" di-pin`);
      mutate();
    }
  };

  const handleCopy = (note: BrainNote) => {
    navigator.clipboard.writeText(stripNoteContent(note.content_body));
    toast.success('Konten disalin ke clipboard!');
  };

  const handleDelete = async () => {
    if (deletingNote) {
      const result = await deleteNoteAction(deletingNote.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${deletingNote.title}" berhasil dihapus`);
        mutate();
      }
      setDeleteNote(null);
    }
  };

  const handleCreateSave = async (data: Partial<BrainNote>) => {
    const result = await createNote({
      title: data.title!,
      content_body: data.content_body || undefined,
      note_type: data.note_type || 'text',
      contextual_role: data.contextual_role || 'general',
      source_url: data.source_url || undefined,
      is_pinned: data.is_pinned || false,
    });
    if (result.error) {
      toast.error(result.error);
      return false;
    } else {
      toast.success(`"${data.title}" berhasil disimpan`);
      mutate();
      return true;
    }
  };

  const handleEditSave = async (data: Partial<BrainNote>) => {
    if (!editingNote) return;
    const result = await updateNote(editingNote.id, {
      title: data.title,
      content_body: data.content_body,
      note_type: data.note_type,
      contextual_role: data.contextual_role,
      source_url: data.source_url,
      is_pinned: data.is_pinned,
    });
    if (result.error) {
      toast.error(result.error);
      return false;
    } else {
      toast.success(`"${data.title}" berhasil diperbarui`);
      mutate();
      setEditNote(null);
      return true;
    }
  };

  const statCards = [
    { label: 'Total Catatan', value: totalNotes, gradient: 'gradient-violet', glow: 'shadow-violet-500/20', icon: Brain },
    { label: 'Pinned', value: pinnedCount, gradient: 'gradient-amber', glow: 'shadow-amber-500/20', icon: Pin },
    { label: 'Ide & Snippet', value: notes.filter(n => n.note_type === 'idea' || n.note_type === 'snippet').length, gradient: 'gradient-emerald', glow: 'shadow-emerald-500/20', icon: Lightbulb },
    { label: 'Link Tersimpan', value: notes.filter(n => n.note_type === 'link').length, gradient: 'gradient-blue', glow: 'shadow-blue-500/20', icon: Link2 },
  ];

  if (isLoading) {
    return <PageSkeleton statCount={4} contentRows={5} />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 ts-display text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20">
                <Brain className="h-5 w-5" />
              </div>
              Brain Notes
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground sm:text-[14px]">
              Repositori catatan, ide, link, dan snippet
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-5 py-2.5 text-[13px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 hover:opacity-90 active:scale-[0.97] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Catatan Baru
          </button>
        </div>

        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              gradient={card.gradient}
              glow={card.glow}
            />
          ))}
        </div>

        {/* ─── Workspace Toolbar ─── */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari catatan, ide, atau snippet..."
                  className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="rounded-lg bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{filtered.length} hasil terlihat</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{pinnedNotes.length} pinned</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{selectedType === 'all' ? 'Semua tipe' : NOTE_TYPES[selectedType].label}</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{searchQuery.trim() ? 'Pencarian aktif' : 'Tanpa kata kunci'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[280px]">
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">Pinned</p>
                <p className="mt-1 ts-h2 text-foreground">{pinnedCount}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">Ide</p>
                <p className="mt-1 ts-h2 text-foreground">{notes.filter(n => n.note_type === 'idea').length}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">Draft</p>
                <p className="mt-1 ts-h2 text-foreground">{notes.filter(n => !stripNoteContent(n.content_body).trim()).length}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-[12px] font-medium">Peran</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {roleFilters.map((role) => (
                  <button
                    key={role.key}
                    onClick={() => setSelectedRole(role.key as RoleContext | 'all')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200',
                      selectedRole === role.key
                        ? 'bg-foreground text-background shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span>{role.icon}</span>
                    <span>{role.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
                <p className="mb-2 text-[12px] font-medium text-muted-foreground">Waktu</p>
                <div className="flex flex-wrap gap-2">
                  {timeFilters.map((time) => (
                    <button
                      key={time.key}
                      onClick={() => setSelectedTime(time.key)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200',
                        selectedTime === time.key
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
                <p className="mb-2 text-[12px] font-medium text-muted-foreground">Tipe</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedType('all')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200',
                      selectedType === 'all'
                        ? 'bg-violet-500/10 text-violet-600 shadow-sm dark:text-violet-400'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    Semua
                  </button>
                  {(Object.keys(NOTE_TYPES) as NoteType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(selectedType === type ? 'all' : type)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200',
                        selectedType === type
                          ? 'bg-violet-500/10 text-violet-600 shadow-sm dark:text-violet-400'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {NOTE_TYPES[type].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Pinned Notes ─── */}
        {pinnedNotes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Pin className="h-4 w-4 text-amber-500 rotate-45" />
              <h2 className="text-[14px] font-semibold text-foreground">Pinned</h2>
              <span className="text-[12px] text-muted-foreground/60">({pinnedNotes.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPreview={setPreviewNote}
                  onEdit={setEditNote}
                  onPin={handlePin}
                  onCopy={handleCopy}
                  onDelete={setDeleteNote}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── All Notes ─── */}
        <div>
          {pinnedNotes.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[14px] font-semibold text-foreground">Semua Catatan</h2>
              <span className="text-[12px] text-muted-foreground/60">({unpinnedNotes.length})</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(pinnedNotes.length > 0 ? unpinnedNotes : filtered).map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onPreview={setPreviewNote}
                onEdit={setEditNote}
                onPin={handlePin}
                onCopy={handleCopy}
                onDelete={setDeleteNote}
              />
            ))}
          </div>
        </div>

        {/* ─── Empty state ─── */}
        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4 text-muted-foreground">
              <Brain className="h-8 w-8" />
            </div>
            <p className="text-[14px] font-medium text-foreground mb-1">
              {notes.length === 0 ? 'Belum ada catatan tersimpan' : 'Tidak ada catatan ditemukan'}
            </p>
            <p className="text-[12px] text-muted-foreground mb-4">
              {notes.length === 0
                ? 'Mulai dari ide cepat, ringkasan materi, atau link penting yang ingin kamu simpan.'
                : 'Coba ubah filter atau kata kunci pencarian.'}
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[12px] font-semibold shadow-md shadow-violet-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Buat Catatan Baru
            </Button>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      <NoteEditorModal
        key={createOpen ? 'create' : 'closed'}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateSave}
      />
      {editingNote && (
        <NoteEditorModal
          key={`edit-${editingNote.id}`}
          open={!!editingNote}
          onClose={() => setEditNote(null)}
          onSave={handleEditSave}
          editNote={editingNote}
        />
      )}
      <NoteDetailModal
        note={previewNote}
        onClose={() => setPreviewNote(null)}
        onEdit={(note) => { setPreviewNote(null); setEditNote(note); }}
      />
      <DeleteConfirmModal note={deletingNote} onClose={() => setDeleteNote(null)} onConfirm={handleDelete} />
    </>
  );
}
