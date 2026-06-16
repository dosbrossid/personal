'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Edit3, Pin, Sparkles, CheckCircle2, List, ListOrdered, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateNoteSummary } from '@/actions/ai.actions';
import { toast } from 'sonner';
import { NOTE_TYPES, ROLES } from '@/core/constants';
import type { RoleContext, NoteType } from '@/core/constants';
import type { BrainNote } from '@/core/types';
import {
  escapeNoteHtml,
  getNoteEditorHtml,
  getNoteExcerpt,
  getNoteWordCount,
  sanitizeNoteHtml,
  stripNoteContent,
} from '@/lib/notes';
import { uploadCompressedPublicImage } from '@/lib/client-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { noteTypeColors } from './notes-constants';

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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const saveRichEditorSelection = () => {
    if (noteType === 'snippet') return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const restoreRichEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus({ preventScroll: true });

    const selection = window.getSelection();
    const range = savedSelectionRef.current;
    if (!selection || !range) return;

    try {
      if (!editor.contains(range.commonAncestorContainer)) return;
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      savedSelectionRef.current = null;
    }
  };

  const keepRichEditorSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    saveRichEditorSelection();
  };

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
    restoreRichEditorSelection();
    document.execCommand(command);
    window.setTimeout(() => {
      saveRichEditorSelection();
      syncRichEditorContent();
    }, 0);
  };

  const insertImageIntoEditor = (url: string) => {
    if (noteType === 'snippet') return;

    restoreRichEditorSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<p><img src="${url}" alt="" /></p><p><br /></p>`
    );
    window.setTimeout(() => {
      saveRichEditorSelection();
      syncRichEditorContent();
    }, 0);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (noteType === 'snippet') {
      toast.error('Upload gambar tidak tersedia untuk mode snippet.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const upload = await uploadCompressedPublicImage(file, {
        context: 'note',
        registerBlogMedia: false,
        maxDimension: 1600,
        quality: 0.8,
      });

      insertImageIntoEditor(upload.publicUrl);
      toast.success('Gambar catatan berhasil diupload dan dikompres ke WebP');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal upload gambar catatan');
    } finally {
      setIsUploadingImage(false);
    }
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
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] flex-col overflow-hidden border-border/60 bg-card p-0 sm:w-[calc(100vw-1.5rem)] sm:max-w-6xl xl:max-w-7xl lg:h-[min(94vh,920px)]">
        <DialogHeader className="shrink-0 border-b border-border/40 px-4 py-4 pb-3 sm:px-6 sm:py-5 sm:pb-4">
          <DialogTitle className="flex items-center gap-2.5 ts-h2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20">
              {isEdit ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            {isEdit ? 'Edit Catatan' : 'Catatan Baru'}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex h-full min-h-0 flex-col gap-5 lg:grid lg:grid-cols-[minmax(260px,0.68fr)_minmax(0,1.32fr)] lg:gap-6 lg:space-y-0">
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
                      type="button"
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
                type="button"
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
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  {noteType !== 'snippet' ? (
                    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
                      <button
                        type="button"
                        onMouseDown={keepRichEditorSelection}
                        onClick={() => applyRichCommand('bold')}
                        className="rounded-md px-2 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onMouseDown={keepRichEditorSelection}
                        onClick={() => applyRichCommand('italic')}
                        className="rounded-md px-2 py-1 text-[12px] italic text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onMouseDown={keepRichEditorSelection}
                        onClick={() => applyRichCommand('insertUnorderedList')}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={keepRichEditorSelection}
                        onClick={() => applyRichCommand('insertOrderedList')}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={keepRichEditorSelection}
                        onClick={() => {
                          saveRichEditorSelection();
                          imageInputRef.current?.click();
                        }}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        disabled={isUploadingImage}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      Mode snippet
                    </span>
                  )}
                  {isUploadingImage && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Uploading image...
                    </span>
                  )}
                  <button type="button" onClick={handleAIGenerate} className="flex items-center gap-1.5 text-[11px] font-medium text-violet-500 transition-colors hover:text-violet-600">
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
                    className="min-h-[420px] resize-none rounded-xl border-border/60 bg-zinc-950 font-mono text-[13px] leading-6 text-emerald-400 dark:bg-zinc-950 lg:h-full lg:min-h-[560px]"
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
                        saveRichEditorSelection();
                        syncRichEditorContent();
                      }}
                      onKeyUp={saveRichEditorSelection}
                      onMouseUp={saveRichEditorSelection}
                      onBlur={saveRichEditorSelection}
                      onPaste={(event) => {
                        event.preventDefault();
                        restoreRichEditorSelection();
                        const pastedText = event.clipboardData.getData('text/plain');
                        document.execCommand('insertText', false, pastedText);
                        window.setTimeout(() => {
                          saveRichEditorSelection();
                          syncRichEditorContent();
                        }, 0);
                      }}
                      className="h-full min-h-[420px] overflow-y-auto rounded-xl border border-border/60 bg-background px-4 py-4 text-[15px] leading-7 text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-primary/30 lg:min-h-[560px] [&_img]:my-4 [&_img]:max-h-[420px] [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-border/50 [&_img]:object-contain [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:min-h-[1.6rem] [&_p]:leading-7 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
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

export { NoteEditorModal };
