'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Palette,
  Quote,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sanitizeBlogHtml } from '@/lib/blog-editor';
import { cn } from '@/lib/utils';

interface BlogRichTextEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
}

type ImageAlign = 'left' | 'center' | 'right';

const IMAGE_ID_ATTR = 'data-editor-image-id';

export function BlogRichTextEditor({ value, onChange, className }: BlogRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const selectedImageMeta = (() => {
    const image = getImageElement(editorRef.current, selectedImageId);
    return image ? getImageMeta(image) : null;
  })();

  useEffect(() => {
    if (!editorRef.current) return;
    const normalized = sanitizeBlogHtml(value) || '<p></p>';
    if (editorRef.current.innerHTML !== normalized) {
      editorRef.current.innerHTML = normalized;
    }
    ensureEditorImageIds(editorRef.current);
  }, [value]);

  const syncValue = () => {
    if (!editorRef.current) return;
    const selectedImage = getImageElement(editorRef.current, selectedImageId);
    const selectedImageSrc = selectedImage?.getAttribute('src') || null;
    const normalized = sanitizeBlogHtml(editorRef.current.innerHTML) || '<p></p>';
    if (editorRef.current.innerHTML !== normalized) {
      editorRef.current.innerHTML = normalized;
    }
    ensureEditorImageIds(editorRef.current);
    if (selectedImageSrc) {
      const replacement = Array.from(editorRef.current.querySelectorAll('img')).find(
        (image) => image.getAttribute('src') === selectedImageSrc
      );
      setSelectedImageId(replacement?.getAttribute(IMAGE_ID_ATTR) || null);
    }
    onChange(normalized);
  };

  const applyCommand = (command: string, valueArg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, valueArg);
    window.setTimeout(syncValue, 0);
  };

  const applyStyledCommand = (command: string, valueArg: string) => {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, valueArg);
    window.setTimeout(syncValue, 0);
  };

  const insertImageIntoEditor = (url: string) => {
    editorRef.current?.focus();
    document.execCommand('insertImage', false, url);

    window.setTimeout(() => {
      if (!editorRef.current) return;
      ensureEditorImageIds(editorRef.current);
      const images = editorRef.current.querySelectorAll('img');
      const image = images.item(images.length - 1);
      if (!image) return;

      applyImageStyles(image, {
        widthPercent: 100,
        align: 'center',
      });

      setSelectedImageId(image.getAttribute(IMAGE_ID_ATTR));
      syncValue();
    }, 0);
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/blog/media', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Gagal upload gambar');
      }

      if (!payload?.data?.publicUrl) {
        throw new Error('URL gambar tidak ditemukan setelah upload');
      }

      insertImageIntoEditor(String(payload.data.publicUrl));
      toast.success('Gambar berhasil diupload');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal upload gambar');
    } finally {
      event.target.value = '';
    }
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      ensureEditorImageIds(target.closest('[contenteditable="true"]') as HTMLDivElement | null);
      setSelectedImageId(target.getAttribute(IMAGE_ID_ATTR));
      return;
    }

    setSelectedImageId(null);
  };

  const updateSelectedImage = (patch: Partial<{ widthPercent: number; align: ImageAlign }>) => {
    const image = getImageElement(editorRef.current, selectedImageId);
    if (!image) return;

    const current = getImageMeta(image);
    applyImageStyles(image, {
      widthPercent: patch.widthPercent ?? current.widthPercent,
      align: patch.align ?? current.align,
    });
    syncValue();
  };

  const clearSelectedImage = () => {
    setSelectedImageId(null);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/80 p-1 shadow-sm scrollbar-thin sm:flex-wrap">
        <ToolbarButton onClick={() => applyCommand('bold')} label="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('italic')} label="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('formatBlock', 'h1')} label="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('formatBlock', 'h2')} label="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('formatBlock', 'blockquote')} label="Quote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('insertUnorderedList')} label="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('insertOrderedList')} label="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <ToolbarButton onClick={() => applyCommand('justifyLeft')} label="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('justifyCenter')} label="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('justifyRight')} label="Align right">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => applyCommand('justifyFull')} label="Align justify">
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <ColorPicker
          label="Text color"
          icon={<Palette className="h-4 w-4" />}
          onChange={(color) => applyStyledCommand('foreColor', color)}
        />
        <ColorPicker
          label="Highlight color"
          icon={<Highlighter className="h-4 w-4" />}
          onChange={(color) => applyStyledCommand('hiliteColor', color)}
        />
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <ToolbarButton onClick={handleInsertImageByUrl} label="Insert image from URL">
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleUploadClick} label="Upload image">
          <Upload className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {selectedImageMeta && (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold text-foreground">Atur gambar terpilih</p>
              <p className="text-[11px] text-muted-foreground">Resize dan alignment gambar seperti editor klasik.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelectedImage} className="h-8 rounded-lg px-3 text-[12px]">
              Tutup
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[33, 50, 75, 100].map((size) => (
              <Button
                key={size}
                type="button"
                variant={selectedImageMeta.widthPercent === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSelectedImage({ widthPercent: size })}
                className="h-8 rounded-lg px-3 text-[12px]"
              >
                {size}%
              </Button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Lebar gambar</span>
              <span className="font-semibold text-foreground">{selectedImageMeta.widthPercent}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={selectedImageMeta.widthPercent}
              onChange={(event) => updateSelectedImage({ widthPercent: Number(event.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={selectedImageMeta.align === 'left' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSelectedImage({ align: 'left' })}
              className="h-8 rounded-lg px-3 text-[12px]"
            >
              <AlignLeft className="mr-1 h-3.5 w-3.5" />
              Left
            </Button>
            <Button
              type="button"
              variant={selectedImageMeta.align === 'center' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSelectedImage({ align: 'center' })}
              className="h-8 rounded-lg px-3 text-[12px]"
            >
              <AlignCenter className="mr-1 h-3.5 w-3.5" />
              Center
            </Button>
            <Button
              type="button"
              variant={selectedImageMeta.align === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSelectedImage({ align: 'right' })}
              className="h-8 rounded-lg px-3 text-[12px]"
            >
              <AlignRight className="mr-1 h-3.5 w-3.5" />
              Right
            </Button>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncValue}
        onBlur={syncValue}
        onClick={handleEditorClick}
        onPaste={(event) => {
          event.preventDefault();
          const pastedText = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, pastedText);
          window.setTimeout(syncValue, 0);
        }}
        className="min-h-[320px] rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-[15px] leading-[1.8] text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 sm:min-h-[420px] sm:px-5 sm:py-4 sm:text-[16px] [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/30 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_h1]:mt-6 [&_h1]:text-[1.75rem] [&_h1]:font-bold sm:[&_h1]:text-[2rem] [&_h2]:mt-5 [&_h2]:text-[1.35rem] [&_h2]:font-semibold sm:[&_h2]:text-[1.5rem] [&_img]:my-4 [&_img]:max-h-[420px] [&_img]:rounded-xl [&_img]:border [&_img]:border-border/60 [&_img]:object-contain [&_img]:shadow-sm [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:min-h-[1.6em] [&_p]:text-foreground [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
      />

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

function ensureEditorImageIds(container: HTMLDivElement | null) {
  if (!container) return;
  container.querySelectorAll('img').forEach((image) => {
    if (!image.getAttribute(IMAGE_ID_ATTR)) {
      image.setAttribute(IMAGE_ID_ATTR, crypto.randomUUID());
    }
  });
}

function getImageElement(container: HTMLDivElement | null, imageId: string | null) {
  if (!container || !imageId) return null;
  return container.querySelector(`img[${IMAGE_ID_ATTR}="${imageId}"]`) as HTMLImageElement | null;
}

function getImageMeta(image: HTMLImageElement) {
  const widthStyle = image.style.width || image.getAttribute('width') || '100%';
  const parsedWidth = Number.parseFloat(widthStyle.replace('%', '')) || 100;
  const dataAlign = image.getAttribute('data-align');
  const align: ImageAlign =
    dataAlign === 'left' || dataAlign === 'right' ? dataAlign : 'center';

  return {
    widthPercent: Math.max(20, Math.min(100, Math.round(parsedWidth))),
    align,
  };
}

function applyImageStyles(
  image: HTMLImageElement,
  settings: {
    widthPercent: number;
    align: ImageAlign;
  }
) {
  image.style.width = `${settings.widthPercent}%`;
  image.style.maxWidth = '100%';
  image.style.height = 'auto';
  image.style.display = 'block';

  if (settings.align === 'left') {
    image.style.marginLeft = '0';
    image.style.marginRight = 'auto';
  } else if (settings.align === 'right') {
    image.style.marginLeft = 'auto';
    image.style.marginRight = '0';
  } else {
    image.style.marginLeft = 'auto';
    image.style.marginRight = 'auto';
  }

  image.setAttribute('data-align', settings.align);
  image.setAttribute('data-size', String(settings.widthPercent));
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function ColorPicker({
  icon,
  label,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
      title={label}
    >
      {icon}
      <span className="sr-only">{label}</span>
      <input
        type="color"
        className="absolute inset-0 cursor-pointer opacity-0"
        defaultValue="#0f172a"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
