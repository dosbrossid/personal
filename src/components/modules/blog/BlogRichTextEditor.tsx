'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Palette,
  Quote,
  Sparkles,
  Underline as UnderlineIcon,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateBlogAIContent } from '@/actions/blog.actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeBlogHtml } from '@/lib/blog-editor';
import { uploadCompressedPublicImage } from '@/lib/client-image';
import { cn } from '@/lib/utils';

interface BlogRichTextEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  documentTitle?: string;
}

type ImageAlign = 'left' | 'center' | 'right';
type ImageMeta = {
  src: string;
  widthPercent: number;
  align: ImageAlign;
};
type BubblePosition = {
  top: number;
  left: number;
};

const DEFAULT_TEXT_COLOR = '#0f172a';
const DEFAULT_HIGHLIGHT_COLOR = '#fef08a';
const MAX_RECENT_COLORS = 8;
const DEFAULT_TEXT_PALETTE = ['#0f172a', '#334155', '#0f766e', '#2563eb', '#7c3aed', '#dc2626'];
const DEFAULT_HIGHLIGHT_PALETTE = ['#fef08a', '#fde68a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fecdd3'];

const BlogImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-align': {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || inferImageAlign(element),
        renderHTML: (attributes) => ({ 'data-align': attributes['data-align'] || 'center' }),
      },
      'data-size': {
        default: '100',
        parseHTML: (element) => element.getAttribute('data-size') || inferImageWidth(element),
        renderHTML: (attributes) => ({ 'data-size': attributes['data-size'] || '100' }),
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
        renderHTML: (attributes) => {
          const widthPercent = normalizeImageWidth(attributes['data-size']);
          const align = normalizeImageAlign(attributes['data-align']);
          return { style: buildImageStyle(widthPercent, align) };
        },
      },
    };
  },
});

export function BlogRichTextEditor({ value, onChange, className, documentTitle = '' }: BlogRichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastExternalValueRef = useRef(sanitizeBlogHtml(value) || '<p></p>');
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageMeta | null>(null);
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null);
  const [recentTextColors, setRecentTextColors] = useState(DEFAULT_TEXT_PALETTE);
  const [recentHighlightColors, setRecentHighlightColors] = useState(DEFAULT_HIGHLIGHT_PALETTE);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      BlogImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          loading: 'lazy',
        },
      }),
    ],
    []
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: lastExternalValueRef.current,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[320px] rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-[15px] leading-[1.75] text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 sm:min-h-[420px] sm:px-5 sm:py-4 sm:text-[16px]',
          'prose-blog-editor',
          '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/30 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic',
          '[&_h1]:mt-6 [&_h1]:text-[1.75rem] [&_h1]:font-bold sm:[&_h1]:text-[2rem] [&_h2]:mt-5 [&_h2]:text-[1.35rem] [&_h2]:font-semibold sm:[&_h2]:text-[1.5rem]',
          '[&_img]:my-4 [&_img]:max-h-[420px] [&_img]:rounded-xl [&_img]:border [&_img]:border-border/60 [&_img]:object-contain [&_img]:shadow-sm',
          '[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p]:min-h-[1.45em] [&_p]:text-foreground [&_p:has(br:only-child)]:my-1 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6'
        ),
      },
      handleClick(view, _pos, event) {
        const target = event.target;
        if (target instanceof HTMLImageElement) {
          const position = view.posAtDOM(target, 0);
          const align = normalizeImageAlign(target.getAttribute('data-align'));
          const widthPercent = normalizeImageWidth(target.getAttribute('data-size') || target.style.width);

          view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)));
          setSelectedImage({
            src: target.getAttribute('src') || '',
            widthPercent,
            align,
          });
          return false;
        }

        setSelectedImage(null);
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const normalized = sanitizeBlogHtml(currentEditor.getHTML()) || '<p></p>';
      lastExternalValueRef.current = normalized;
      onChange(normalized);
      syncSelectedImage(currentEditor.getHTML(), selectedImage, setSelectedImage);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const selectionText = currentEditor.state.doc
        .textBetween(currentEditor.state.selection.from, currentEditor.state.selection.to, ' ')
        .trim();
      setSelectedText(selectionText);

      if (currentEditor.state.selection.empty || currentEditor.isActive('image') || !selectionText) {
        setBubblePosition(null);
      } else {
        setBubblePosition(getSelectionBubblePosition(currentEditor));
      }

      if (!currentEditor.isActive('image')) {
        setSelectedImage(null);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;

    const updatePosition = () => {
      if (editor.state.selection.empty || editor.isActive('image')) {
        setBubblePosition(null);
        return;
      }

      setBubblePosition(getSelectionBubblePosition(editor));
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const normalized = sanitizeBlogHtml(value) || '<p></p>';
    if (normalized === lastExternalValueRef.current) return;

    lastExternalValueRef.current = normalized;
    editor.commands.setContent(normalized, { emitUpdate: false });
  }, [editor, value]);

  const runCommand = (callback: () => boolean) => {
    if (!editor) return;
    callback();
    onChange(sanitizeBlogHtml(editor.getHTML()) || '<p></p>');
  };

  const rememberColor = (
    color: string,
    setPalette: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setPalette((current) => [color, ...current.filter((item) => item.toLowerCase() !== color.toLowerCase())].slice(0, MAX_RECENT_COLORS));
  };

  const applyTextColor = (color: string) => {
    rememberColor(color, setRecentTextColors);
    runCommand(() => editor?.chain().focus().setColor(color).run() ?? false);
  };

  const applyHighlightColor = (color: string) => {
    rememberColor(color, setRecentHighlightColors);
    runCommand(() => editor?.chain().focus().setHighlight({ color }).run() ?? false);
  };

  const clearFormatting = () => {
    runCommand(() =>
      editor?.chain().focus().unsetAllMarks().clearNodes().setParagraph().unsetTextAlign().run() ?? false
    );
  };

  const insertImageIntoEditor = (url: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'image',
        attrs: {
          src: url,
          'data-align': 'center',
          'data-size': '100',
        },
      })
      .run();
  };

  const handleInsertImageByUrl = () => {
    const url = window.prompt('Masukkan URL gambar eksternal');
    if (!url?.trim()) return;

    if (!/^https?:\/\//i.test(url.trim())) {
      toast.error('Gunakan URL gambar yang diawali http:// atau https://');
      return;
    }

    insertImageIntoEditor(url.trim());
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const upload = await uploadCompressedPublicImage(file, {
        context: 'blog',
        registerBlogMedia: true,
        maxDimension: 1920,
        quality: 0.82,
      });
      insertImageIntoEditor(String(upload.publicUrl));
      toast.success('Gambar berhasil diupload');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal upload gambar');
    } finally {
      event.target.value = '';
    }
  };

  const updateSelectedImage = (patch: Partial<{ widthPercent: number; align: ImageAlign }>) => {
    if (!editor || !selectedImage?.src) return;

    const nextMeta = {
      ...selectedImage,
      ...patch,
    };

    editor.commands.updateAttributes('image', {
      'data-align': nextMeta.align,
      'data-size': String(nextMeta.widthPercent),
      style: buildImageStyle(nextMeta.widthPercent, nextMeta.align),
    });
    setSelectedImage(nextMeta);
  };

  const insertHtmlAtSelection = (html: string, replaceSelection: boolean) => {
    if (!editor) return;

    const command = editor.chain().focus();
    if (replaceSelection) {
      command.deleteSelection();
    }
    command.insertContent(sanitizeBlogHtml(html) || html).run();
    setSelectedText('');
  };

  const handleAISelectionEdit = async () => {
    if (!editor || !selectedText) {
      toast.error('Blok teks yang ingin diedit dulu.');
      return;
    }

    if (!aiPrompt.trim()) {
      toast.error('Tulis arahan edit untuk AI dulu.');
      return;
    }

    setIsRunningAI(true);
    const result = await generateBlogAIContent({
      mode: 'selection_edit',
      title: documentTitle,
      content: sanitizeBlogHtml(editor.getHTML()) || '<p></p>',
      prompt: aiPrompt,
      selection: selectedText,
    });
    setIsRunningAI(false);

    if (result.error || !result.data?.html) {
      toast.error(result.error || 'AI belum menghasilkan revisi yang valid.');
      return;
    }

    insertHtmlAtSelection(result.data.html, true);
    setAiPrompt('');
    toast.success('Bagian terpilih berhasil diedit oleh AI');
  };

  const handleAISectionGenerate = async () => {
    if (!editor || (!aiPrompt.trim() && !documentTitle.trim())) {
      toast.error('Tulis arahan section atau isi judul artikel dulu.');
      return;
    }

    setIsRunningAI(true);
    const result = await generateBlogAIContent({
      mode: 'section_generate',
      title: documentTitle,
      content: sanitizeBlogHtml(editor.getHTML()) || '<p></p>',
      prompt: aiPrompt,
    });
    setIsRunningAI(false);

    if (result.error || !result.data?.html) {
      toast.error(result.error || 'AI belum menghasilkan section yang valid.');
      return;
    }

    insertHtmlAtSelection(`${result.data.html}<p><br /></p>`, false);
    setAiPrompt('');
    toast.success('Section baru berhasil ditambahkan ke editor');
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/80 p-1 shadow-sm scrollbar-thin sm:flex-wrap">
        <ToolbarButton active={editor?.isActive('bold')} onClick={() => runCommand(() => editor?.chain().focus().toggleBold().run() ?? false)} label="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('italic')} onClick={() => runCommand(() => editor?.chain().focus().toggleItalic().run() ?? false)} label="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('underline')} onClick={() => runCommand(() => editor?.chain().focus().toggleUnderline().run() ?? false)} label="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('heading', { level: 1 })} onClick={() => runCommand(() => editor?.chain().focus().toggleHeading({ level: 1 }).run() ?? false)} label="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('heading', { level: 2 })} onClick={() => runCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run() ?? false)} label="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('blockquote')} onClick={() => runCommand(() => editor?.chain().focus().toggleBlockquote().run() ?? false)} label="Quote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('bulletList')} onClick={() => runCommand(() => editor?.chain().focus().toggleBulletList().run() ?? false)} label="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive('orderedList')} onClick={() => runCommand(() => editor?.chain().focus().toggleOrderedList().run() ?? false)} label="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <ToolbarButton active={editor?.isActive({ textAlign: 'left' })} onClick={() => runCommand(() => editor?.chain().focus().setTextAlign('left').run() ?? false)} label="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive({ textAlign: 'center' })} onClick={() => runCommand(() => editor?.chain().focus().setTextAlign('center').run() ?? false)} label="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive({ textAlign: 'right' })} onClick={() => runCommand(() => editor?.chain().focus().setTextAlign('right').run() ?? false)} label="Align right">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor?.isActive({ textAlign: 'justify' })} onClick={() => runCommand(() => editor?.chain().focus().setTextAlign('justify').run() ?? false)} label="Align justify">
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <ColorPicker
          label="Text color"
          icon={<Palette className="h-4 w-4" />}
          defaultValue={DEFAULT_TEXT_COLOR}
          colors={recentTextColors}
          onChange={applyTextColor}
          onClear={() => runCommand(() => editor?.chain().focus().unsetColor().run() ?? false)}
        />
        <ColorPicker
          label="Highlight color"
          icon={<Highlighter className="h-4 w-4" />}
          defaultValue={DEFAULT_HIGHLIGHT_COLOR}
          colors={recentHighlightColors}
          onChange={applyHighlightColor}
          onClear={() => runCommand(() => editor?.chain().focus().unsetHighlight().run() ?? false)}
        />
        <ToolbarButton onClick={clearFormatting} label="Clear formatting">
          <Eraser className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <ToolbarButton onClick={handleInsertImageByUrl} label="Insert image from URL">
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Upload image">
          <Upload className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={isAIPanelOpen} onClick={() => setIsAIPanelOpen((current) => !current)} label="AI assistant">
          <Sparkles className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {isAIPanelOpen && (
        <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold text-foreground">AI Writing Assistant</p>
              <p className="text-[11px] text-muted-foreground">
                Blok teks lalu beri instruksi untuk rewrite, atau minta AI menambah section baru langsung di editor.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAIPanelOpen(false)} className="h-8 rounded-lg px-3 text-[12px]">
              Tutup
            </Button>
          </div>

          {selectedText && (
            <div className="mt-3 rounded-xl border border-border/50 bg-background/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Teks Terpilih</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/85">
                {selectedText}
              </p>
            </div>
          )}

          <div className="mt-3 space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Instruksi AI</label>
            <Textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder={selectedText ? 'Contoh: buat lebih ringkas, lebih persuasif, atau ubah jadi lebih formal.' : 'Contoh: tulis section pembuka tentang pentingnya pemasaran digital untuk UMKM.'}
              className="min-h-[88px] resize-none rounded-xl border-border/60 bg-background/70 text-[13px]"
            />
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={handleAISelectionEdit} disabled={isRunningAI || !selectedText} className="h-9 rounded-xl bg-violet-600 text-[12px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {isRunningAI ? 'Memproses...' : 'AI Edit Selection'}
            </Button>
            <Button type="button" variant="outline" onClick={handleAISectionGenerate} disabled={isRunningAI} className="h-9 rounded-xl border-border/60 text-[12px]">
              {isRunningAI ? 'Memproses...' : 'AI Generate Section'}
            </Button>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold text-foreground">Atur gambar terpilih</p>
              <p className="text-[11px] text-muted-foreground">Resize dan alignment gambar seperti editor klasik.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedImage(null)} className="h-8 rounded-lg px-3 text-[12px]">
              Tutup
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[33, 50, 75, 100].map((size) => (
              <Button key={size} type="button" variant={selectedImage.widthPercent === size ? 'default' : 'outline'} size="sm" onClick={() => updateSelectedImage({ widthPercent: size })} className="h-8 rounded-lg px-3 text-[12px]">
                {size}%
              </Button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Lebar gambar</span>
              <span className="font-semibold text-foreground">{selectedImage.widthPercent}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={selectedImage.widthPercent}
              onChange={(event) => updateSelectedImage({ widthPercent: Number(event.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(['left', 'center', 'right'] as const).map((align) => {
              const Icon = align === 'left' ? AlignLeft : align === 'right' ? AlignRight : AlignCenter;
              return (
                <Button key={align} type="button" variant={selectedImage.align === align ? 'default' : 'outline'} size="sm" onClick={() => updateSelectedImage({ align })} className="h-8 rounded-lg px-3 text-[12px]">
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {align[0].toUpperCase() + align.slice(1)}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {editor && bubblePosition && (
        <div
          className="fixed z-[80] -translate-x-1/2 -translate-y-full"
          style={{
            top: bubblePosition.top,
            left: bubblePosition.left,
          }}
        >
          <div className="flex max-w-[calc(100vw-32px)] items-center gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-popover/95 p-1.5 text-popover-foreground shadow-2xl shadow-black/15 backdrop-blur-xl">
            <BubbleToolbarButton
              active={editor.isActive('bold')}
              label="Bold"
              onClick={() => runCommand(() => editor.chain().focus().toggleBold().run())}
            >
              <Bold className="h-3.5 w-3.5" />
            </BubbleToolbarButton>
            <BubbleToolbarButton
              active={editor.isActive('italic')}
              label="Italic"
              onClick={() => runCommand(() => editor.chain().focus().toggleItalic().run())}
            >
              <Italic className="h-3.5 w-3.5" />
            </BubbleToolbarButton>
            <BubbleToolbarButton
              active={editor.isActive('underline')}
              label="Underline"
              onClick={() => runCommand(() => editor.chain().focus().toggleUnderline().run())}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </BubbleToolbarButton>

            <div className="mx-1 h-5 w-px shrink-0 bg-border/70" />

            <div className="flex shrink-0 items-center gap-1 rounded-xl bg-muted/50 px-1 py-0.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              {recentTextColors.slice(0, 4).map((color) => (
                <button
                  key={`bubble-text-${color}`}
                  type="button"
                  title={`Text color ${color}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyTextColor(color)}
                  className="h-5 w-5 rounded-full border border-black/10 shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-xl bg-muted/50 px-1 py-0.5">
              <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
              {recentHighlightColors.slice(0, 4).map((color) => (
                <button
                  key={`bubble-highlight-${color}`}
                  type="button"
                  title={`Highlight ${color}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyHighlightColor(color)}
                  className="h-5 w-5 rounded-full border border-black/10 shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="mx-1 h-5 w-px shrink-0 bg-border/70" />

            <BubbleToolbarButton label="Clear formatting" onClick={clearFormatting}>
              <Eraser className="h-3.5 w-3.5" />
            </BubbleToolbarButton>
            <BubbleToolbarButton
              active={isAIPanelOpen}
              label="AI edit selection"
              onClick={() => setIsAIPanelOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </BubbleToolbarButton>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
      )}
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function BubbleToolbarButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground',
        active && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function ColorPicker({
  icon,
  label,
  defaultValue,
  colors,
  onChange,
  onClear,
}: {
  icon: React.ReactNode;
  label: string;
  defaultValue: string;
  colors: string[];
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border/40 bg-background/40 px-1 py-0.5">
      <label
        className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title={label}
        onMouseDown={(event) => event.preventDefault()}
      >
        {icon}
        <span className="sr-only">{label}</span>
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          defaultValue={defaultValue}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div className="hidden items-center gap-1 sm:flex">
        {colors.slice(0, 5).map((color) => (
          <button
            key={`${label}-${color}`}
            type="button"
            title={`${label}: ${color}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(color)}
            className="h-4 w-4 rounded-full border border-black/10 shadow-sm ring-offset-background transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <button
        type="button"
        title={`Clear ${label}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClear}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Eraser className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function normalizeImageAlign(value: unknown): ImageAlign {
  return value === 'left' || value === 'right' ? value : 'center';
}

function normalizeImageWidth(value: unknown) {
  const raw = String(value || '100').replace('%', '').trim();
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(20, Math.min(100, Math.round(parsed)));
}

function inferImageWidth(element: HTMLElement) {
  return String(normalizeImageWidth(element.style.width || element.getAttribute('width') || '100'));
}

function inferImageAlign(element: HTMLElement) {
  const marginLeft = element.style.marginLeft;
  const marginRight = element.style.marginRight;
  if (marginLeft === 'auto' && marginRight === 'auto') return 'center';
  if (marginLeft === 'auto') return 'right';
  if (marginRight === 'auto') return 'left';
  return 'center';
}

function buildImageStyle(widthPercent: number, align: ImageAlign) {
  const styleEntries = [
    `width:${widthPercent}%`,
    'max-width:100%',
    'height:auto',
    'display:block',
  ];

  if (align === 'left') {
    styleEntries.push('margin-left:0', 'margin-right:auto');
  } else if (align === 'right') {
    styleEntries.push('margin-left:auto', 'margin-right:0');
  } else {
    styleEntries.push('margin-left:auto', 'margin-right:auto');
  }

  return styleEntries.join(';');
}

function getSelectionBubblePosition(editor: NonNullable<ReturnType<typeof useEditor>>): BubblePosition | null {
  const { from, to } = editor.state.selection;

  try {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const top = Math.max(12, Math.min(start.top, end.top) - 10);
    const rawLeft = (start.left + end.right) / 2;
    const left = Math.max(24, Math.min(window.innerWidth - 24, rawLeft));

    return { top, left };
  } catch {
    return null;
  }
}

function syncSelectedImage(
  html: string,
  selectedImage: ImageMeta | null,
  setSelectedImage: React.Dispatch<React.SetStateAction<ImageMeta | null>>
) {
  if (!selectedImage?.src) return;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const image = Array.from(doc.querySelectorAll('img')).find((item) => item.getAttribute('src') === selectedImage.src);
  if (!image) {
    setSelectedImage(null);
    return;
  }

  const widthPercent = normalizeImageWidth(image.getAttribute('data-size') || image.getAttribute('style'));
  const align = normalizeImageAlign(image.getAttribute('data-align'));
  if (widthPercent !== selectedImage.widthPercent || align !== selectedImage.align) {
    setSelectedImage({ ...selectedImage, widthPercent, align });
  }
}
