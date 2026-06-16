'use client';

import { useState, useTransition } from 'react';
import { mutate as mutateGlobal } from 'swr';
import {
  Brain,
  LibraryBig,
  Plus,
  Tag,
  Search,
  Trash2,
  Edit3,
  Pin,
  ExternalLink,
  Sparkles,
  Hash,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNotes } from '@/hooks/use-notes';
import { useCategories } from '@/hooks/use-categories';
import { createNote, togglePinNote, deleteNote } from '@/actions/notes.actions';
import { createCategory, updateCategory, deleteCategory } from '@/actions/categories.actions';
import { ROLES, NOTE_TYPES } from '@/core/constants';
import { formatRelativeTime } from '@/lib/utils';
import { stripNoteContent } from '@/lib/notes';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { BrainNote, Category } from '@/core/types';
import Link from 'next/link';

const CATEGORY_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1'];

export default function KnowledgePage() {
  const { notes, isLoading: notesLoading, mutate } = useNotes();
  const { categories, isLoading: catLoading, mutate: catMutate } = useCategories();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [pinningId, setPinningId] = useState<string | null>(null);

  // Category CRUD state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(CATEGORY_COLORS[0]);

  const isLoading = notesLoading || catLoading;
  if (isLoading) return <PageSkeleton statCount={4} contentRows={6} />;

  const filteredNotes = notes
    .filter((n) => {
      if (activeCategory) {
        const cat = categories.find((c) => c.name === activeCategory);
        if (!cat) return false;
        return (n.categories ?? []).some((jc) => jc.category_id === cat.id);
      }
      if (search) {
        const q = search.toLowerCase();
        const content = stripNoteContent(n.content_body || '').toLowerCase();
        return n.title.toLowerCase().includes(q) || content.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at);
    });

  const categoryNoteCounts = categories.map((cat) => ({
    ...cat,
    count: notes.filter((n) => (n.categories ?? []).some((jc) => jc.category_id === cat.id)).length,
  }));

  async function handleQuickCreate() {
    if (!newTitle.trim()) return;
    startSaving(async () => {
      const result = await createNote({ title: newTitle.trim(), note_type: 'text', contextual_role: 'general' });
      if (result.error) { toast.error(result.error); return; }
      toast.success(`"${newTitle.trim()}" dibuat`);
      setNewTitle('');
      mutate();
      mutateGlobal((k) => typeof k === 'string' && k.startsWith('/api/dashboard'));
    });
  }

  async function handleTogglePin(note: BrainNote) {
    setPinningId(note.id);
    const result = await togglePinNote(note.id, note.is_pinned);
    setPinningId(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success(note.is_pinned ? `"${note.title}" di-unpin` : `"${note.title}" di-pin`);
    mutate();
    mutateGlobal((k) => typeof k === 'string' && k.startsWith('/api/dashboard'));
  }

  async function handleDeleteNote(note: BrainNote) {
    if (!confirm(`Hapus "${note.title}"?`)) return;
    const result = await deleteNote(note.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`"${note.title}" dihapus`);
    mutate();
    mutateGlobal((k) => typeof k === 'string' && k.startsWith('/api/dashboard'));
  }

  function openCategoryEditor(cat?: Category) {
    setEditingCategory(cat || null);
    setCatName(cat?.name || '');
    setCatColor(cat?.color || CATEGORY_COLORS[0]);
    setShowCategoryDialog(true);
  }

  async function handleSaveCategory() {
    if (!catName.trim()) return;
    if (editingCategory) {
      const result = await updateCategory(editingCategory.id, { name: catName.trim(), color: catColor });
      if (result.error) { toast.error(result.error); return; }
      toast.success('Kategori diperbarui');
    } else {
      const result = await createCategory({ name: catName.trim(), color: catColor, contextual_role: 'general' });
      if (result.error) { toast.error(result.error); return; }
      toast.success('Kategori dibuat');
    }
    setShowCategoryDialog(false);
    catMutate();
  }

  async function handleDeleteCategory(cat: Category) {
    if (cat.is_system) { toast.error('Kategori sistem tidak bisa dihapus'); return; }
    if (!confirm(`Hapus kategori "${cat.name}"? Catatan tetap aman.`)) return;
    const result = await deleteCategory(cat.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`Kategori "${cat.name}" dihapus`);
    if (activeCategory === cat.name) setActiveCategory(null);
    catMutate();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="ts-display text-foreground flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20">
              <LibraryBig className="h-5 w-5" />
            </div>
            Knowledge Hub
          </h1>
          <p className="ts-sm text-muted-foreground mt-1">Second Brain — source of knowledge untuk AI agent kamu</p>
        </div>
      </div>

      {/* MCP Setup Banner */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="ts-title text-foreground">MCP Server Siap</p>
            <p className="ts-caption text-muted-foreground mt-0.5">
              AI agent kamu bisa akses knowledge ini via <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono">POST /api/mcp</code> (SSE/HTTP) atau STDIO via <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono">npm run mcp</code>. Tools: search_notes, get_note, create_note, list_categories, dll.
            </p>
          </div>
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* LEFT: Categories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="ts-title text-foreground flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Kategori
            </h2>
            <button
              type="button"
              onClick={() => openCategoryEditor()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/15"
              aria-label="Buat kategori baru"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* All notes button */}
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
              activeCategory === null
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <Hash className="h-4 w-4" />
            Semua Catatan
            <span className="ml-auto ts-micro text-muted-foreground">{notes.length}</span>
          </button>

          <div className="max-h-[50vh] space-y-1 overflow-y-auto scrollbar-thin">
            {categoryNoteCounts.length === 0 ? (
              <p className="ts-caption text-muted-foreground px-3">Belum ada kategori.</p>
            ) : (
              categoryNoteCounts.map((cat) => (
                <div key={cat.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(cat.name)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                      activeCategory === cat.name
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || '#6b7280' }}
                    />
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-auto ts-micro text-muted-foreground">{cat.count}</span>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openCategoryEditor(cat); }}
                      className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted"
                      aria-label={`Edit kategori ${cat.name}`}
                    >
                      <Edit3 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                      className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-red-500/10 hover:text-red-500"
                      aria-label={`Hapus kategori ${cat.name}`}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Notes */}
        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari di knowledge base..."
                className="ts-sm h-10 w-full rounded-xl border border-border/60 bg-card pl-10 pr-4 text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>

            {/* Quick create */}
            <div className="flex items-center gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleQuickCreate(); } }}
                placeholder="Judul catatan baru..."
                className="ts-sm h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-card px-3 text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-56 sm:flex-none"
              />
              <button
                type="button"
                onClick={() => void handleQuickCreate()}
                disabled={isSaving}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Baru
              </button>
            </div>
          </div>

          {/* Active filter indicator */}
          {(activeCategory || search) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="ts-caption text-muted-foreground">Filter:</span>
              {activeCategory && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categories.find((c) => c.name === activeCategory)?.color }} />
                  {activeCategory}
                  <button type="button" onClick={() => setActiveCategory(null)} className="ml-1 hover:text-primary/70">×</button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  &quot;{search}&quot;
                  <button type="button" onClick={() => setSearch('')} className="ml-1 hover:text-foreground">×</button>
                </span>
              )}
              <span className="ts-micro text-muted-foreground">({filteredNotes.length} catatan)</span>
            </div>
          )}

          {/* Notes list */}
          {filteredNotes.length === 0 ? (
            <EmptyState
              icon={search || activeCategory ? Search : Brain}
              title={search || activeCategory ? 'Tidak ada hasil' : 'Knowledge base kosong'}
              description={search || activeCategory ? 'Coba kata kunci atau filter lain.' : 'Mulai dengan membuat catatan pertama lewat input di atas, atau buka notes page untuk editor lengkap.'}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="group relative rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <span className="text-base">{NOTE_TYPES[note.note_type]?.icon || '📝'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="ts-sm font-semibold text-foreground truncate">{note.title}</p>
                        <p className="ts-micro text-muted-foreground">{formatRelativeTime(note.updated_at || note.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(note)}
                        disabled={pinningId === note.id}
                        className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', note.is_pinned ? 'bg-amber-500/10 text-amber-500' : 'text-muted-foreground hover:bg-muted')}
                        aria-label={note.is_pinned ? 'Unpin' : 'Pin'}
                      >
                        {pinningId === note.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pin className={cn('h-3.5 w-3.5', note.is_pinned && 'fill-amber-500')} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                        aria-label={`Hapus ${note.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="ts-caption text-muted-foreground line-clamp-2 mb-3">
                    {stripNoteContent(note.content_body || '') || 'Catatan kosong'}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(note.categories ?? []).slice(0, 3).map((jc) => {
                        const cat = categories.find((c) => c.id === jc.category_id);
                        if (!cat) return null;
                        return (
                          <span key={cat.id} className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </span>
                        );
                      })}
                      {(note.categories ?? []).length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{note.categories!.length - 3}</span>
                      )}
                    </div>
                    <Link
                      href={`/notes`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                      aria-label="Buka di catatan"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 ts-title">
              <Tag className="h-5 w-5 text-primary" />
              {editingCategory ? 'Edit Kategori' : 'Buat Kategori'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="ts-label text-muted-foreground block mb-1.5">Nama</label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Contoh: Riset, Draft, AI Prompts..." />
            </div>
            <div>
              <label className="ts-label text-muted-foreground block mb-1.5">Warna</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCatColor(color)}
                    className={cn(
                      'h-8 w-8 rounded-lg border-2 transition-all',
                      catColor === color ? 'border-foreground scale-110 shadow-sm' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Warna ${color}`}
                  />
                ))}
              </div>
            </div>
            <Button onClick={() => void handleSaveCategory()} className="w-full">
              {editingCategory ? 'Simpan' : 'Buat Kategori'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
