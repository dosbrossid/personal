'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Brain, Plus, Pin, Search, ExternalLink, MoreHorizontal, Filter,
  Trash2, Copy, Edit3, Eye, Share2, PinOff, BookOpen,
  Sparkles, CheckCircle2, AlertTriangle, Code2, Lightbulb, Link2, FileText, Loader2, List, ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotes } from '@/hooks/use-notes';
import { createNote, updateNote, togglePinNote, deleteNote as deleteNoteAction } from '@/actions/notes.actions';
import { generateNoteSummary } from '@/actions/ai.actions';
import { toast } from 'sonner';
import { NOTE_TYPES, ROLES } from '@/core/constants';
import type { RoleContext, NoteType } from '@/core/constants';
import type { BrainNote } from '@/core/types';
import { formatRelativeTime } from '@/lib/utils';
import { isToday, subDays } from 'date-fns';
import {
  buildSharePayload,
  escapeNoteHtml,
  getNoteEditorHtml,
  getNoteExcerpt,
  getNoteRenderHtml,
  getNoteWordCount,
  sanitizeNoteHtml,
  stripNoteContent,
} from '@/lib/notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

const noteTypeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  idea: <Lightbulb className="h-4 w-4" />,
  snippet: <Code2 className="h-4 w-4" />,
};

const noteTypeColors: Record<string, string> = {
  text: '#6366f1',
  link: '#10b981',
  idea: '#f59e0b',
  snippet: '#ec4899',
};

function getSafeHostname(url?: string | null) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').slice(0, 40);
  }
}

function getSafeExternalHref(url?: string | null) {
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

// ─────────────────────────────────────
// New / Edit Note Modal
// ─────────────────────────────────────

function NoteEditorModal({
  open,
  onClose,
  onSave,
  editNote,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<BrainNote>) => Promise<boolean | void>;
  editNote?: BrainNote | null;
}) {
  const isEdit = !!editNote;
  const initialType = editNote?.note_type || 'text';
  const [isSaving, setIsSaving] = useState(false);
  const snippetRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(editNote?.title || '');
  const [content, setContent] = useState(
    initialType === 'snippet'
      ? editNote?.content_body || ''
      : getNoteEditorHtml(editNote?.content_body || '')
  );
  const [noteType, setNoteType] = useState<NoteType>(initialType);
  const [role, setRole] = useState<RoleContext>(editNote?.contextual_role || 'general');
  const [sourceUrl, setSourceUrl] = useState(editNote?.source_url || '');
  const [isPinned, setIsPinned] = useState(editNote?.is_pinned || false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    if (noteType !== 'snippet' && editorRef.current && !editorRef.current.innerHTML.trim()) {
      editorRef.current.innerHTML = content || '<p></p>';
    }
    // Rich editor content is synced via input handlers; this effect only hydrates when mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteType]);

  const syncRichEditorContent = () => {
    if (!editorRef.current) return content;

    const nextHtml = sanitizeNoteHtml(editorRef.current.innerHTML);
    const safeHtml = nextHtml || '<p></p>';
    if (editorRef.current.innerHTML !== safeHtml) {
      editorRef.current.innerHTML = safeHtml;
    }
    setContent(safeHtml);
    return safeHtml;
  };

  const getCurrentContentForSave = () => (
    noteType === 'snippet'
      ? content
      : sanitizeNoteHtml(editorRef.current?.innerHTML || content)
  );

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Judul catatan wajib diisi');
      return;
    }

    const nextContent = getCurrentContentForSave();
    setIsSaving(true);
    const result = await onSave({
      title,
      content_body: nextContent,
      note_type: noteType,
      contextual_role: role,
      source_url: sourceUrl || null,
      is_pinned: isPinned,
    });
    setIsSaving(false);

    if (result !== false) {
      onClose();
    }
  };

  const handleAIGenerate = async () => {
    const sourceContent = noteType === 'snippet'
      ? content
      : stripNoteContent(editorRef.current?.innerHTML || content);

    if (!sourceContent.trim()) {
      toast.error('Isi konten catatan dulu sebelum generate ringkasan AI');
      return;
    }

    setIsGeneratingSummary(true);
    const result = await generateNoteSummary({ title, content: sourceContent });
    setIsGeneratingSummary(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const summaryText = result.data ?? '';

    if (noteType === 'snippet') {
      const nextContent = `${content.trim()}\n\nRingkasan AI:\n${summaryText}`;
      setContent(nextContent);
    } else {
      const summaryHtml = `<p><strong>Ringkasan AI:</strong></p><p>${escapeNoteHtml(summaryText).replace(/\n/g, '<br />')}</p>`;
      const currentHtml = sanitizeNoteHtml(editorRef.current?.innerHTML || content);
      const nextContent = `${currentHtml}${currentHtml ? '<p><br /></p>' : ''}${summaryHtml}`;
      const safeHtml = sanitizeNoteHtml(nextContent) || '<p></p>';
      if (editorRef.current) {
        editorRef.current.innerHTML = safeHtml;
      }
      setContent(safeHtml);
    }
    toast.success('Ringkasan AI ditambahkan ke catatan');
  };

  const applyRichCommand = (command: 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList') => {
    if (noteType === 'snippet') return;
    editorRef.current?.focus();
    document.execCommand(command);
    window.setTimeout(() => {
      syncRichEditorContent();
    }, 0);
  };

  const handleNoteTypeChange = (nextType: NoteType) => {
    if (nextType === noteType) return;

    const currentContent = noteType === 'snippet'
      ? content
      : sanitizeNoteHtml(editorRef.current?.innerHTML || content);

    const nextContent = nextType === 'snippet'
      ? stripNoteContent(currentContent)
      : getNoteEditorHtml(currentContent);

    setNoteType(nextType);
    setContent(nextContent);

    window.setTimeout(() => {
      if (nextType === 'snippet') {
        snippetRef.current?.focus();
        return;
      }

      if (editorRef.current) {
        editorRef.current.innerHTML = nextContent || '<p></p>';
        editorRef.current.focus();
      }
    }, 0);
  };

  const plainContent = noteType === 'snippet' ? content : stripNoteContent(content);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] flex-col overflow-hidden border-border/60 bg-card p-0 sm:w-[calc(100vw-1.5rem)] sm:max-w-5xl lg:h-[min(92vh,860px)]">
        <DialogHeader className="shrink-0 border-b border-border/40 px-4 py-4 pb-3 sm:px-6 sm:py-5 sm:pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-[18px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20">
              {isEdit ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            {isEdit ? 'Edit Catatan' : 'Catatan Baru'}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex h-full min-h-0 flex-col gap-5 lg:grid lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] lg:gap-6 lg:space-y-0">
            <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 scrollbar-thin">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Judul</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Tulis judul catatan..."
                  className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipe Catatan</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(NOTE_TYPES) as NoteType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleNoteTypeChange(type)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition-all duration-200',
                        noteType === type
                          ? 'text-white shadow-sm'
                          : 'border-border/60 bg-muted/30 text-foreground hover:bg-muted'
                      )}
                      style={noteType === type ? { backgroundColor: noteTypeColors[type] } : undefined}
                    >
                      <div className="flex items-center gap-2 text-[12px] font-semibold">
                        <span className="shrink-0">{NOTE_TYPES[type].icon}</span>
                        {NOTE_TYPES[type].label}
                      </div>
                      <p className={cn('mt-1 text-[11px]', noteType === type ? 'text-white/75' : 'text-muted-foreground')}>
                        {type === 'text' && 'Catatan umum atau ringkasan.'}
                        {type === 'link' && 'Simpan referensi penting.'}
                        {type === 'idea' && 'Tangkap ide secepat mungkin.'}
                        {type === 'snippet' && 'Potongan kode atau teks teknis.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Peran</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as RoleContext)}
                  className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                >
                  {Object.entries(ROLES).map(([key, val]) => (
                    <option key={key} value={key}>{val.icon} {val.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source URL</label>
                <Input
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-9 rounded-lg border-border/60 bg-background text-[12px]"
                />
              </div>

              <button
                onClick={() => setIsPinned(!isPinned)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-[12px] font-medium transition-all duration-200',
                  isPinned
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                    : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="flex items-center gap-2">
                  <Pin className={cn('h-3.5 w-3.5', isPinned && 'rotate-45')} />
                  {isPinned ? 'Pinned untuk akses cepat' : 'Pin catatan ini'}
                </span>
                <span className="text-[11px]">{isPinned ? 'Aktif' : 'Opsional'}</span>
              </button>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 max-sm:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview Ringkas</p>
                <p className="mt-2 text-[15px] font-semibold text-foreground">{title.trim() || 'Judul catatan'}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{getNoteExcerpt(content, 120)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: `${noteTypeColors[noteType]}15`, color: noteTypeColors[noteType] }}
                  >
                    {NOTE_TYPES[noteType].icon} {NOTE_TYPES[noteType].label}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLES[role].bgClass)}>
                    {ROLES[role].icon} {ROLES[role].label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{getNoteWordCount(content)} kata</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:pl-1 scrollbar-thin">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Konten</label>
                <div className="flex flex-wrap items-center gap-2">
                  {noteType !== 'snippet' ? (
                    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
                      <button
                        onClick={() => applyRichCommand('bold')}
                        className="rounded-md px-2 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        B
                      </button>
                      <button
                        onClick={() => applyRichCommand('italic')}
                        className="rounded-md px-2 py-1 text-[12px] italic text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        I
                      </button>
                      <button
                        onClick={() => applyRichCommand('insertUnorderedList')}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => applyRichCommand('insertOrderedList')}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      Mode snippet
                    </span>
                  )}
                  <button onClick={handleAIGenerate} className="flex items-center gap-1.5 text-[11px] font-medium text-violet-500 transition-colors hover:text-violet-600">
                    <Sparkles className="h-3 w-3" />
                    {isGeneratingSummary ? 'Generating...' : 'Generate AI'}
                  </button>
                </div>
              </div>
              <div className="lg:min-h-0 lg:flex-1">
                {noteType === 'snippet' ? (
                  <Textarea
                    ref={snippetRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Paste code snippet di sini..."
                    className="min-h-[260px] rounded-xl border-border/60 bg-zinc-950 font-mono text-[12px] text-emerald-400 resize-none dark:bg-zinc-950 lg:h-full lg:min-h-[420px]"
                  />
                ) : (
                  <div className="relative h-full">
                    {!plainContent.trim() && (
                      <div className="pointer-events-none absolute left-4 top-3 text-[13px] text-muted-foreground/60">
                        {noteType === 'idea' ? 'Tulis ide kamu...' : 'Tulis catatan...'}
                      </div>
                    )}
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => {
                        syncRichEditorContent();
                      }}
                      onPaste={(event) => {
                        event.preventDefault();
                        const pastedText = event.clipboardData.getData('text/plain');
                        document.execCommand('insertText', false, pastedText);
                        window.setTimeout(() => {
                          syncRichEditorContent();
                        }, 0);
                      }}
                      className="h-full min-h-[260px] overflow-y-auto rounded-xl border border-border/60 bg-background px-4 py-3 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-primary/30 lg:min-h-[420px] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:min-h-[1.2rem] [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {noteType === 'idea' && 'Tulis cepat dulu, rapikan belakangan. Ide yang tertangkap lebih penting.'}
                  {noteType === 'snippet' && 'Snippet cocok untuk potongan kode, command, atau template teks teknis.'}
                  {noteType === 'link' && 'Untuk link penting, kamu sekarang bisa format konteksnya langsung dengan teks tebal, miring, atau list.'}
                  {noteType === 'text' && 'Gunakan untuk ringkasan materi, catatan kelas, atau pemikiran panjang dengan formatting ringan yang langsung terlihat.'}
                </p>
                <span className="text-[11px] font-medium text-muted-foreground">{plainContent.length} karakter • {getNoteWordCount(content)} kata</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-card/95 px-4 py-4 supports-backdrop-filter:backdrop-blur sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={onClose} className="h-9 w-full rounded-lg border-border/60 text-[12px] sm:w-auto">
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="h-9 w-full gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-[12px] font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:opacity-90 disabled:opacity-40 sm:w-auto"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Catatan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────
// Note Detail / Preview Modal
// ─────────────────────────────────────

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

  const handleCopy = () => {
    navigator.clipboard.writeText(stripNoteContent(note.content_body));
    toast.success('Konten disalin ke clipboard!');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(buildSharePayload(note));
    toast.success('Ringkasan catatan disalin ke clipboard!');
  };

  return (
    <Dialog open={!!note} onOpenChange={onClose}>
      <DialogContent className="max-h-[88vh] overflow-hidden border-border/60 bg-card p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md shrink-0"
              style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)` }}
            >
              {noteTypeIcons[note.note_type]}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[17px] leading-snug">{note.title}</DialogTitle>
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

        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
          <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:gap-6 lg:space-y-0">
            <div className="space-y-4">
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
                    className="prose prose-sm max-w-none whitespace-normal leading-relaxed text-inherit dark:prose-invert prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-1"
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
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ringkas</p>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">{getNoteExcerpt(note.content_body, 180)}</p>
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

// ─────────────────────────────────────
// Delete Confirmation Modal
// ─────────────────────────────────────

function DeleteConfirmModal({
  note,
  onClose,
  onConfirm,
}: {
  note: BrainNote | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!note) return null;
  return (
    <Dialog open={!!note} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-[16px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            Hapus Catatan?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground pt-2">
            Apakah Anda yakin ingin menghapus <span className="font-semibold text-foreground">&ldquo;{note.title}&rdquo;</span>? Aksi ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            className="h-9 gap-2 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 shadow-md shadow-red-500/25 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ya, Hapus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/70 p-3 text-center">
      <p className="mb-0.5 text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[12px] font-medium text-foreground">{value}</p>
    </div>
  );
}

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
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat catatan...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-[24px] font-bold tracking-tight text-foreground sm:text-[28px]">
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
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`${card.gradient} rounded-2xl p-4 text-white shadow-lg ${card.glow} cursor-default relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-medium text-white/70">{card.label}</p>
                  <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                  </div>
                </div>
                <p className="text-[26px] font-bold leading-none">{card.value}</p>
              </div>
            );
          })}
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
                <p className="mt-1 text-[18px] font-semibold text-foreground">{pinnedCount}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">Ide</p>
                <p className="mt-1 text-[18px] font-semibold text-foreground">{notes.filter(n => n.note_type === 'idea').length}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">Draft</p>
                <p className="mt-1 text-[18px] font-semibold text-foreground">{notes.filter(n => !stripNoteContent(n.content_body).trim()).length}</p>
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

// ─────────────────────────────────────
// Note Card Component
// ─────────────────────────────────────

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
