'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBlogTags } from '@/hooks/use-blog';

import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Eye, 
  Globe,
  Tag,
  Search,
  Sparkles,
  Save,
  ChevronDown,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createBlogPost, generateBlogAIContent, updateBlogPost } from '@/actions/blog.actions';
import { toast } from 'sonner';
import { BlogRichTextEditor } from '@/components/modules/blog/BlogRichTextEditor';
import { BlogPreviewModal } from '@/components/modules/blog/BlogPreviewModal';
import { uploadCompressedPublicImage } from '@/lib/client-image';
import { getBlogWordStats, stripBlogContent } from '@/lib/blog-editor';
import { isFutureSchedule, toScheduledAtIso } from '@/lib/blog-schedule';

export default function BlogEditorPage() {
  const router = useRouter();
  const { tags } = useBlogTags();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('<p></p>');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [metaTitle, setMetaTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [pendingTagNames, setPendingTagNames] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageAlt, setCoverImageAlt] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const handleCoverFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const upload = await uploadCompressedPublicImage(file, {
        context: 'cover',
        registerBlogMedia: true,
        maxDimension: 2000,
        quality: 0.84,
      });

      setCoverImageUrl(upload.publicUrl);
      setCoverImageAlt((current) => current || title || file.name.replace(/\.[^.]+$/, ''));
      toast.success('Cover image berhasil diupload dan dikompres ke WebP');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal upload cover image');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const savePost = async (status: 'draft' | 'published') => {
    if (isSaving) return;
    setIsSaving(true);

    const scheduledAtIso = toScheduledAtIso(scheduledAt);
    const shouldSchedule = status === 'published' && isFutureSchedule(scheduledAtIso);

    const createResult = await createBlogPost({ title: title || 'Untitled' });
    if (createResult.error) {
      toast.error(createResult.error);
      setIsSaving(false);
      return;
    }
    if (!createResult.data) {
      toast.error('Draft gagal dibuat');
      setIsSaving(false);
      return;
    }

    const stats = getBlogWordStats(content);
    const createdPost = createResult.data;
    const plainContent = stripBlogContent(content);
    const updateResult = await updateBlogPost(createdPost.id, {
      title: title || 'Untitled',
      content_text: plainContent,
      content_html: content,
      excerpt: excerpt || plainContent.slice(0, 160),
      meta_title: metaTitle || title || 'Untitled',
      meta_description: excerpt || plainContent.slice(0, 160),
      featured_image_url: coverImageUrl,
      featured_image_alt: coverImageAlt || title || 'Cover article',
      status: shouldSchedule ? 'draft' : status,
      visibility,
      scheduled_at: shouldSchedule || status === 'draft' ? scheduledAtIso : null,
      tag_ids: selectedTagIds,
      tag_names: pendingTagNames,
      ...stats,
    });

    setIsSaving(false);

    if (updateResult.error) {
      toast.error(updateResult.error);
      return;
    }

    toast.success(
      shouldSchedule
        ? 'Artikel berhasil dijadwalkan'
        : status === 'published'
          ? 'Artikel berhasil dipublish'
          : 'Draft berhasil disimpan'
    );
    router.push(`/blog/${createdPost.id}/edit`);
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

  const handleAddPendingTag = () => {
    const normalized = newTagInput.trim();
    if (!normalized) return;

    const existsInPending = pendingTagNames.some((tag) => tag.toLowerCase() === normalized.toLowerCase());
    const existsInSaved = tags.some((tag) => tag.name.toLowerCase() === normalized.toLowerCase());

    if (existsInPending || existsInSaved) {
      toast.error('Kategori ini sudah ada');
      return;
    }

    setPendingTagNames((current) => [...current, normalized]);
    setNewTagInput('');
  };

  const stats = getBlogWordStats(content);
  const isScheduling = isFutureSchedule(toScheduledAtIso(scheduledAt));
  const previewSlug =
    title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled';
  const previewTags = [
    ...tags.filter((tag) => selectedTagIds.includes(tag.id)),
    ...pendingTagNames.map((tagName) => ({
      id: `pending-${tagName}`,
      user_id: '',
      name: tagName,
      slug: tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: null,
      color: '#0f766e',
      post_count: 0,
      is_deleted: false,
      created_at: '',
      updated_at: '',
    })),
  ];

  const handleGenerateSeo = async () => {
    setIsGeneratingSeo(true);
    const result = await generateBlogAIContent({
      mode: 'seo_generate',
      title,
      content,
      excerpt,
    });
    setIsGeneratingSeo(false);

    if (result.error || !result.data) {
      toast.error(result.error || 'AI belum menghasilkan draft SEO yang valid');
      return;
    }

    if (result.data.metaTitle) {
      setMetaTitle(result.data.metaTitle.slice(0, 60));
    }

    const nextExcerpt = result.data.excerpt || result.data.metaDescription || '';
    if (nextExcerpt) {
      setExcerpt(nextExcerpt.slice(0, 160));
    }

    toast.success('Draft SEO berhasil dibuat oleh AI');
  };

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-2px)] w-auto flex-col overflow-x-hidden sm:-mx-8">
      {/* ─── Editor Top Bar ─── */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur-xl sm:px-5 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link href="/blog">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
            Draft tersimpan beberapa detik lalu
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
            className="h-8 gap-2 rounded-lg border-border/60 bg-transparent px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => savePost('draft')}
            className="h-8 gap-2 rounded-lg border-border/60 bg-transparent px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save Draft</span>
            <span className="sm:hidden">Draft</span>
          </Button>
          <Button
            size="sm"
            disabled={isSaving}
            onClick={() => savePost('published')}
            className="h-8 gap-1.5 rounded-lg bg-gradient-to-r from-primary to-emerald-600 px-2 text-[12px] font-semibold text-white shadow-md shadow-primary/25 transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 sm:px-3"
          >
            {isSaving ? 'Saving...' : isScheduling ? 'Schedule' : 'Publish'}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-x-hidden xl:flex-row">
        {/* ─── Main Editor Area ─── */}
        <main className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-3xl space-y-8">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleCoverFileChange}
            />
            
            {/* Cover Image Upload */}
            {coverImageUrl ? (
              <div className="group relative h-40 w-full overflow-hidden rounded-2xl border border-border/60 sm:h-48">
                <Image
                  src={coverImageUrl}
                  alt={coverImageAlt || 'Cover'}
                  fill
                  sizes="(max-width: 640px) 100vw, 768px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-white">
                  <p className="text-[12px] font-medium">Cover siap dipakai</p>
                  <p className="text-[11px] text-white/75">Sudah dikompres otomatis ke WebP</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => coverInputRef.current?.click()}
                    className="rounded-lg shadow-lg"
                    disabled={isUploadingCover}
                  >
                    {isUploadingCover ? 'Uploading...' : 'Change Cover'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCoverImageUrl(null);
                      setCoverImageAlt('');
                    }}
                    className="rounded-lg border-white/40 bg-black/20 text-white hover:bg-black/40"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="group relative flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-lg hover:shadow-primary/5 sm:h-48"
              >
                <div className="flex flex-col items-center gap-2.5 text-muted-foreground/60 transition-colors duration-300 group-hover:text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/80 transition-colors group-hover:bg-primary/10">
                    <ImageIcon className="h-6 w-6 transition-colors group-hover:text-primary" />
                  </div>
                  <span className="text-[13px] font-medium">{isUploadingCover ? 'Uploading cover...' : 'Add Cover Image'}</span>
                  <span className="text-[11px]">JPG/PNG/WEBP akan dikompres otomatis ke WebP</span>
                </div>
              </button>
            )}

            {/* Title Input */}
            <div>
              <input
                type="text"
                placeholder="Judul artikel Anda..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-[28px] font-bold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none sm:text-[36px]"
              />
            </div>

            {/* Toolbar */}
            <BlogRichTextEditor value={content} onChange={setContent} documentTitle={title} />
          </div>
        </main>

        {/* ─── Right Sidebar ─── */}
        <aside className="scrollbar-thin w-full shrink-0 overflow-y-auto border-t border-border/60 bg-card/50 p-4 backdrop-blur-sm sm:p-5 xl:w-[300px] xl:border-l xl:border-t-0">
          <div className="space-y-6">
            
            {/* Publish Settings */}
            <div 
              className="space-y-4"
            >
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                Pengaturan Publish
              </h3>
              
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Status</span>
                  <span className="rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 px-2.5 py-0.5 text-[11px] font-medium">
                    {isScheduling ? 'Scheduled Draft' : 'Draft'}
                  </span>
                </div>
                <div className="h-px bg-border/40" />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Visibility</span>
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                    className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div className="h-px bg-border/40" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">Jadwal Publish</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setScheduledAt('')}
                      className="h-7 px-2.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary rounded-lg gap-1.5"
                    >
                      <Clock className="h-3 w-3" />
                      Reset
                    </Button>
                  </div>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    className="h-8 rounded-lg border-border/60 bg-background text-[11px]"
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                    Kosongkan untuk publish manual. Jika waktunya masih di masa depan,
                    tombol publish akan berubah jadi schedule.
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div 
              className="space-y-3"
            >
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Tag className="h-3.5 w-3.5" />
                </div>
                Kategori & Tags
              </h3>
              <div className="flex gap-2">
                <Input
                  value={newTagInput}
                  onChange={(event) => setNewTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddPendingTag();
                    }
                  }}
                  placeholder="Buat kategori baru..."
                  className="h-9 rounded-xl border-border/60 bg-background/50 text-[12px]"
                />
                <Button type="button" variant="outline" onClick={handleAddPendingTag} className="h-9 rounded-xl px-3 text-[12px]">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        selected
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-border/40 bg-muted/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
                {pendingTagNames.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setPendingTagNames((current) => current.filter((item) => item !== tag))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-[11px] text-muted-foreground">
                {selectedTagIds.length + pendingTagNames.length} kategori dipilih • {stats.word_count} kata • {stats.reading_time_minutes} menit baca
              </div>
            </div>

            {/* SEO Settings */}
            <div 
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  SEO & Meta
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateSeo}
                  disabled={isGeneratingSeo}
                  className="h-7 gap-1.5 px-2.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary rounded-lg"
                >
                  <Sparkles className="h-3 w-3" />
                  {isGeneratingSeo ? 'Generating...' : 'Generate AI'}
                </Button>
              </div>
              
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Slug (URL)</label>
                  <Input
                    value={title ? `/blog/${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled'}` : '/blog/auto-generated-slug'}
                    readOnly
                    className="h-8 rounded-lg border-border/60 bg-background font-mono text-[11px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Meta Title</label>
                  <Input
                    value={metaTitle}
                    onChange={(event) => setMetaTitle(event.target.value)}
                    placeholder="Leave blank to use post title"
                    className="h-8 rounded-lg border-border/60 bg-background text-[11px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">Excerpt / Meta Desc</label>
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">{excerpt.length}/160</span>
                  </div>
                  <Textarea
                    value={excerpt}
                    onChange={(event) => setExcerpt(event.target.value.slice(0, 160))}
                    className="min-h-[80px] resize-none rounded-lg border-border/60 bg-background text-[11px]"
                    placeholder="Ringkasan singkat untuk SEO dan kartu preview sosial media..."
                  />
                </div>
              </div>
            </div>

          </div>
        </aside>
      </div>

      <BlogPreviewModal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        title={title}
        slug={previewSlug}
        excerpt={excerpt}
        contentHtml={content}
        coverImageUrl={coverImageUrl}
        coverImageAlt={coverImageAlt}
        tags={previewTags}
        visibility={visibility}
        statusLabel={isScheduling ? 'Scheduled Draft' : 'Draft'}
        scheduledAt={toScheduledAtIso(scheduledAt)}
        publicUrl={null}
      />
    </div>
  );
}
