'use client';

import { useState } from 'react';
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
import { createBlogPost, updateBlogPost } from '@/actions/blog.actions';
import { toast } from 'sonner';
import { BlogRichTextEditor } from '@/components/modules/blog/BlogRichTextEditor';
import { getBlogWordStats, stripBlogContent } from '@/lib/blog-editor';

export default function BlogEditorPage() {
  const router = useRouter();
  const { tags } = useBlogTags();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('<p></p>');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [metaTitle, setMetaTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [pendingTagNames, setPendingTagNames] = useState<string[]>([]);

  const savePost = async (status: 'draft' | 'published') => {
    if (isSaving) return;
    setIsSaving(true);

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
      status,
      visibility,
      tag_ids: selectedTagIds,
      tag_names: pendingTagNames,
      ...stats,
    });

    setIsSaving(false);

    if (updateResult.error) {
      toast.error(updateResult.error);
      return;
    }

    toast.success(status === 'published' ? 'Artikel berhasil dipublish' : 'Draft berhasil disimpan');
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

  return (
    <div className="flex h-[calc(100vh-2px)] w-full flex-col overflow-hidden -my-6 -mx-8">
      {/* ─── Editor Top Bar ─── */}
      <header className="flex h-14 shrink-0 justify-between items-center border-b border-border/60 bg-card/80 backdrop-blur-xl px-5">
        <div className="flex items-center gap-3">
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
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg border-border/60 bg-transparent text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => savePost('draft')}
            className="h-8 gap-2 rounded-lg border-border/60 bg-transparent text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button
            size="sm"
            disabled={isSaving}
            onClick={() => savePost('published')}
            className="h-8 gap-1.5 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-[12px] font-semibold shadow-md shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Publish'}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Main Editor Area ─── */}
        <main className="flex-1 overflow-y-auto px-8 py-10 scrollbar-thin">
          <div className="mx-auto max-w-3xl space-y-8">
            
            {/* Cover Image Upload */}
            <div 
              className="group relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex flex-col items-center gap-2.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/80 group-hover:bg-primary/10 transition-colors">
                  <ImageIcon className="h-6 w-6 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[13px] font-medium">Add Cover Image</span>
                <span className="text-[11px]">Drag & drop or click to upload</span>
              </div>
            </div>

            {/* Title Input */}
            <div>
              <input
                type="text"
                placeholder="Judul artikel Anda..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-[36px] font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none leading-tight tracking-tight"
              />
            </div>

            {/* Toolbar */}
            <BlogRichTextEditor value={content} onChange={setContent} />
          </div>
        </main>

        {/* ─── Right Sidebar ─── */}
        <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-border/60 bg-card/50 backdrop-blur-sm p-5 scrollbar-thin">
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
                  <span className="rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 px-2.5 py-0.5 text-[11px] font-medium">Draft</span>
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
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Schedule</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary rounded-lg gap-1.5">
                    <Clock className="h-3 w-3" />
                    Set Date
                  </Button>
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
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary rounded-lg">
                  <Sparkles className="h-3 w-3" />
                  Generate AI
                </Button>
              </div>
              
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Slug (URL)</label>
                  <Input placeholder="auto-generated-slug" className="h-8 rounded-lg border-border/60 bg-background font-mono text-[11px]" />
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
    </div>
  );
}
