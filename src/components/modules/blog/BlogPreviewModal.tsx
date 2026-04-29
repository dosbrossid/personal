'use client';

import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { CalendarDays, Clock3, Eye, Globe2, Lock, Tag } from 'lucide-react';

import type { BlogTag, BlogVisibility } from '@/core/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BlogPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  tags: BlogTag[];
  visibility: BlogVisibility;
  statusLabel: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  publicUrl?: string | null;
}

const visibilityLabel: Record<BlogVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

const visibilityIcon: Record<BlogVisibility, typeof Globe2> = {
  public: Globe2,
  unlisted: Eye,
  private: Lock,
};

export function BlogPreviewModal({
  open,
  onOpenChange,
  title,
  slug,
  excerpt,
  contentHtml,
  coverImageUrl,
  coverImageAlt,
  tags,
  visibility,
  statusLabel,
  scheduledAt,
  publishedAt,
  publicUrl,
}: BlogPreviewModalProps) {
  const VisibilityIcon = visibilityIcon[visibility];
  const hasContent = contentHtml && contentHtml !== '<p></p>';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col overflow-hidden p-0 sm:max-w-4xl" showCloseButton={false}>
        <DialogHeader className="gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground sm:text-xl">
                Preview Artikel
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed">
                Ini preview lokal dari draft saat ini. Kamu bisa cek struktur artikel, cover, kategori, dan flow baca sebelum publish.
              </DialogDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/60 bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {statusLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/60 bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <VisibilityIcon className="mr-1.5 h-3.5 w-3.5" />
                {visibilityLabel[visibility]}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {coverImageUrl ? (
              <div className="relative h-52 overflow-hidden rounded-3xl border border-border/60 bg-muted sm:h-72">
                <Image
                  src={coverImageUrl}
                  alt={coverImageAlt || title || 'Cover artikel'}
                  fill
                  sizes="(max-width: 768px) 100vw, 960px"
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 font-mono">
                  /blog/{slug}
                </span>
                {publishedAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Publish {format(parseISO(publishedAt), 'd MMM yyyy • HH:mm', { locale: id })}
                  </span>
                ) : null}
                {scheduledAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-violet-500/10 px-2.5 py-1 text-violet-600 dark:text-violet-300">
                    <Clock3 className="h-3.5 w-3.5" />
                    Jadwal {format(parseISO(scheduledAt), 'd MMM yyyy • HH:mm', { locale: id })}
                  </span>
                ) : null}
              </div>

              <div className="space-y-3">
                <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                  {title || 'Untitled'}
                </h2>
                {excerpt ? (
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {excerpt}
                  </p>
                ) : null}
              </div>

              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-[12px] font-medium text-foreground"
                      style={{ backgroundColor: `${tag.color}15` }}
                    >
                      <Tag className="h-3.5 w-3.5" style={{ color: tag.color }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <article
              className="prose prose-slate max-w-none text-[15px] leading-7 prose-headings:text-foreground prose-p:my-3 prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground dark:prose-invert [&_p:has(br:only-child)]:my-1"
              dangerouslySetInnerHTML={{
                __html: hasContent ? contentHtml : '<p>Konten artikel masih kosong.</p>',
              }}
            />
          </div>
        </div>

        <DialogFooter className="items-center justify-between gap-3 sm:flex-row sm:justify-between">
          <p className="text-[12px] text-muted-foreground">
            Preview ini tidak menyimpan perubahan. Tutup modal lalu lanjutkan edit seperti biasa.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {publicUrl ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
              >
                <Globe2 className="mr-2 h-4 w-4" />
                Buka Versi Publik
              </Button>
            ) : null}
            <Button type="button" onClick={() => onOpenChange(false)} className="rounded-xl">
              Tutup Preview
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
