'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useBlogPost } from '@/hooks/use-blog';
import { BLOG_STATUSES } from '@/core/constants';
import type { BlogPost } from '@/core/types';
import { updateBlogPost } from '@/actions/blog.actions';
import { toast } from 'sonner';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function getPostStats(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return {
    word_count: words,
    reading_time_minutes: Math.max(1, Math.ceil(words / 200)),
  };
}

export default function BlogEditorEditPage() {
  const params = useParams();
  const postId = params.id as string;
  
  const { post: fetchedPost, isLoading } = useBlogPost(postId);

  if (isLoading || !fetchedPost) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        <span className="text-[14px] text-muted-foreground">Loading editor...</span>
      </div>
    );
  }

  return <BlogEditorForm key={fetchedPost.id} post={fetchedPost} />;
}

function BlogEditorForm({ post }: { post: BlogPost }) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content_text);
  const [visibility, setVisibility] = useState(post.visibility);
  const [metaTitle, setMetaTitle] = useState(post.meta_title || '');
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [isSaving, setIsSaving] = useState(false);
  const statusConfig = BLOG_STATUSES[post.status];

  const savePost = async (status: 'draft' | 'published') => {
    if (isSaving) return;
    setIsSaving(true);

    const result = await updateBlogPost(post.id, {
      title: title || 'Untitled',
      content_text: content,
      content_html: textToHtml(content),
      excerpt: excerpt || content.slice(0, 160),
      meta_title: metaTitle || title || 'Untitled',
      meta_description: excerpt || content.slice(0, 160),
      status,
      visibility,
      ...getPostStats(content),
    });

    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(status === 'published' ? 'Artikel berhasil dipublish/update' : 'Draft berhasil disimpan');
  };

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
          <div className="h-4 w-px bg-border/60" />
          <span 
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ 
              backgroundColor: `${statusConfig.color}15`, 
              color: statusConfig.color 
            }}
          >
            {statusConfig.icon} {statusConfig.label}
          </span>
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
            Save
          </Button>
          <Button
            size="sm"
            disabled={isSaving}
            onClick={() => savePost('published')}
            className="h-8 gap-1.5 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-[12px] font-semibold shadow-md shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : post.status === 'published' ? 'Update' : 'Publish'}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Main Editor Area ─── */}
        <main className="flex-1 overflow-y-auto px-8 py-10 scrollbar-thin">
          <div className="mx-auto max-w-3xl space-y-8">
            
            {/* Cover Image */}
            {post.featured_image_url ? (
              <div 
                className="group relative h-48 w-full overflow-hidden rounded-2xl border border-border/60"
              >
                <img src={post.featured_image_url} alt={post.featured_image_alt || "Cover"} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 backdrop-blur-sm">
                  <Button variant="secondary" size="sm" className="rounded-lg shadow-lg">Change Cover</Button>
                </div>
              </div>
            ) : (
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
            )}

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
            <div 
              className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-1 shadow-sm w-fit"
            >
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-[13px] font-bold"><b>B</b></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-[13px]"><i>I</i></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-[13px]"><u>U</u></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-[13px]"><s>S</s></Button>
              <div className="mx-1 h-5 w-px bg-border/60" />
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-[11px] font-semibold">H1</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-[11px] font-semibold">H2</Button>
              <div className="mx-1 h-5 w-px bg-border/60" />
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><ImageIcon className="h-4 w-4" /></Button>
            </div>

            {/* Content Textarea */}
            <div>
              <Textarea 
                placeholder="Mulai menulis cerita Anda (Gunakan markdown atau slash / commands)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[400px] w-full resize-none border-none bg-transparent p-0 text-[16px] leading-[1.8] text-foreground placeholder:text-muted-foreground/30 focus-visible:ring-0"
              />
            </div>
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
                  <span 
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                    style={{ 
                      backgroundColor: `${statusConfig.color}15`, 
                      color: statusConfig.color 
                    }}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                <div className="h-px bg-border/40" />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Visibility</span>
                  <select
                    className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
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
              <Input placeholder="Tambah tag..." className="h-9 rounded-xl border-border/60 bg-background/50 text-[12px]" />
              <div className="flex flex-wrap gap-1.5">
                {post.tags?.map(tag => (
                  <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground border border-border/40">
                    {tag.name} 
                    <button className="hover:text-foreground transition-colors text-muted-foreground/50">&times;</button>
                  </span>
                ))}
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
                  <Input defaultValue={post.slug} className="h-8 rounded-lg border-border/60 bg-background font-mono text-[11px]" />
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
