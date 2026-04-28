'use client';

import Image from 'next/image';
import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical,
  Eye,
  Clock,
  CheckCircle2,
  Edit3,
  Trash2,
  Archive,
  Globe,
  Lock,
  EyeOff,
  PenSquare,
  FileText,
  BarChart3,
  ArrowUpRight,
  Tag,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useBlogPosts, useBlogTags } from '@/hooks/use-blog';
import { BLOG_STATUSES } from '@/core/constants';
import type { BlogPost, BlogStatus, BlogTag, BlogVisibility } from '@/core/types';
import { Loader2 } from 'lucide-react';
import { createBlogTag, deleteBlogPost, deleteBlogTag, updateBlogPost, updateBlogTag } from '@/actions/blog.actions';
import { toast } from 'sonner';
import { isScheduledDraft } from '@/lib/blog-schedule';
import { getPublicBlogPostUrl } from '@/lib/blog';
import { Textarea } from '@/components/ui/textarea';

function BlogPostActions({
  post,
  onTogglePublish,
  onDelete,
}: {
  post: BlogPost;
  onTogglePublish: (postId: string, nextStatus: Extract<BlogStatus, 'draft' | 'published'>) => void;
  onDelete: (postId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/70 transition-all duration-200 hover:bg-muted hover:text-foreground">
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60 bg-card shadow-xl">
        <Link href={`/blog/${post.id}/edit`}>
          <DropdownMenuItem className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
            <Edit3 className="h-4 w-4 text-muted-foreground" /> Edit Artikel
          </DropdownMenuItem>
        </Link>
        {post.status === 'published' && (
          <DropdownMenuItem
            onClick={() => window.open(getPublicBlogPostUrl(post.slug), '_blank', 'noopener,noreferrer')}
            className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground"
          >
            <Globe className="h-4 w-4 text-muted-foreground" /> Lihat Publik
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-border/40" />
        {post.status === 'published' ? (
          <DropdownMenuItem
            onClick={() => onTogglePublish(post.id, 'draft')}
            className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground"
          >
            <Archive className="h-4 w-4 text-amber-500/70" /> Unpublish (Draft)
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onTogglePublish(post.id, 'published')}
            className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500/70" /> Publish Sekarang
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-border/40" />
        <DropdownMenuItem
          onClick={() => onDelete(post.id)}
          className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500"
        >
          <Trash2 className="h-4 w-4" /> Hapus Artikel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlogPostMobileCard({
  post,
  getVisibilityIcon,
  onTogglePublish,
  onDelete,
}: {
  post: BlogPost;
  getVisibilityIcon: (visibility: BlogVisibility) => React.ReactNode;
  onTogglePublish: (postId: string, nextStatus: Extract<BlogStatus, 'draft' | 'published'>) => void;
  onDelete: (postId: string) => void;
}) {
  const isScheduled = isScheduledDraft(post);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
          {post.featured_image_url ? (
            <Image
              src={post.featured_image_url}
              alt={post.featured_image_alt || 'Cover'}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <PenSquare className="h-4 w-4 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/blog/${post.id}/edit`} className="group/link flex items-start gap-1.5">
                <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground transition-colors group-hover/link:text-primary">
                  {post.title}
                </h3>
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all duration-200 group-hover/link:translate-x-0 group-hover/link:translate-y-0 group-hover/link:text-primary" />
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: isScheduled ? '#8b5cf615' : `${BLOG_STATUSES[post.status].color}15`,
                    color: isScheduled ? '#8b5cf6' : BLOG_STATUSES[post.status].color,
                  }}
                >
                  {isScheduled ? '◔ Scheduled' : `${BLOG_STATUSES[post.status].icon} ${BLOG_STATUSES[post.status].label}`}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-muted-foreground">
                  {getVisibilityIcon(post.visibility)}
                  <span className="capitalize">{post.visibility}</span>
                </span>
              </div>
            </div>
            <BlogPostActions post={post} onTogglePublish={onTogglePublish} onDelete={onDelete} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {post.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag.id} variant="outline" className="rounded-full border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tag.name}
          </Badge>
        ))}
        {post.tags && post.tags.length > 3 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70">
            +{post.tags.length - 3} tag
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-muted/15 p-3 text-[11px]">
        <div>
          <p className="text-muted-foreground">Views</p>
          <p className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            {new Intl.NumberFormat('id-ID').format(post.view_count)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Durasi baca</p>
          <p className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {post.reading_time_minutes}m · {post.word_count}w
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-[11px]">
        <span className="truncate font-mono text-muted-foreground/70">/blog/{post.slug}</span>
        {post.status === 'published' && post.published_at ? (
          <div className="text-right">
            <p className="font-medium text-emerald-500 dark:text-emerald-400">Published</p>
            <p className="text-muted-foreground">{format(parseISO(post.published_at), 'd MMM y', { locale: id })}</p>
          </div>
        ) : isScheduled && post.scheduled_at ? (
          <div className="text-right">
            <p className="font-medium text-violet-500 dark:text-violet-400">Scheduled</p>
            <p className="text-muted-foreground">{format(parseISO(post.scheduled_at), 'd MMM y • HH:mm', { locale: id })}</p>
          </div>
        ) : (
          <div className="text-right">
            <p className="font-medium text-muted-foreground">Edited</p>
            <p className="text-muted-foreground/70">{formatDistanceToNow(parseISO(post.updated_at), { addSuffix: true, locale: id })}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BlogTagRow({
  tag,
  onEdit,
  onDelete,
}: {
  tag: BlogTag;
  onEdit: (tag: BlogTag) => void;
  onDelete: (tagId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-3.5 w-3.5 rounded-full border border-white/50 shadow-sm"
            style={{ backgroundColor: tag.color }}
          />
          <h3 className="text-[14px] font-semibold text-foreground">{tag.name}</h3>
          <Badge variant="outline" className="rounded-full border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tag.post_count} post
          </Badge>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            /tag/{tag.slug}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {tag.description?.trim() || 'Belum ada deskripsi kategori. Tambahkan supaya struktur kontenmu lebih rapi.'}
        </p>
      </div>

      <div className="flex items-center gap-2 self-start">
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(tag)} className="rounded-xl border-border/60">
          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDelete(tag.id)}
          className="rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Hapus
        </Button>
      </div>
    </div>
  );
}


export default function BlogCMSPage() {
  const { posts: allPosts, isLoading, mutate } = useBlogPosts();
  const { tags, mutate: mutateTags } = useBlogTags();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | BlogStatus>('all');
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [tagDialogMode, setTagDialogMode] = useState<'create' | 'edit'>('create');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [tagColor, setTagColor] = useState('#0f766e');
  const [isTagSaving, setIsTagSaving] = useState(false);

  const filteredPosts = allPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (post.tags && post.tags.some(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesTab = activeTab === 'all' || post.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalViews = allPosts.reduce((acc, p) => acc + p.view_count, 0);
  const publishedCount = allPosts.filter(p => p.status === 'published').length;
  const draftCount = allPosts.filter(p => p.status === 'draft').length;

  const resetTagForm = () => {
    setEditingTagId(null);
    setTagName('');
    setTagDescription('');
    setTagColor('#0f766e');
    setTagDialogMode('create');
  };

  const openCreateTagDialog = () => {
    resetTagForm();
    setIsTagDialogOpen(true);
  };

  const openEditTagDialog = (tag: BlogTag) => {
    setTagDialogMode('edit');
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagDescription(tag.description || '');
    setTagColor(tag.color || '#0f766e');
    setIsTagDialogOpen(true);
  };

  const getVisibilityIcon = (visibility: BlogVisibility) => {
    switch (visibility) {
      case 'public': return <Globe className="h-3 w-3" />;
      case 'unlisted': return <EyeOff className="h-3 w-3" />;
      case 'private': return <Lock className="h-3 w-3" />;
    }
  };

  const handleTogglePublish = async (postId: string, nextStatus: Extract<BlogStatus, 'draft' | 'published'>) => {
    const result = await updateBlogPost(postId, {
      status: nextStatus,
      scheduled_at: null,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(nextStatus === 'published' ? 'Artikel dipublish' : 'Artikel dikembalikan ke draft');
    mutate();
  };

  const handleDelete = async (postId: string) => {
    const result = await deleteBlogPost(postId);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Artikel dihapus');
    mutate();
  };

  const handleSaveTag = async () => {
    if (isTagSaving) return;

    setIsTagSaving(true);
    const payload = {
      name: tagName,
      description: tagDescription,
      color: tagColor,
    };

    const result =
      tagDialogMode === 'create'
        ? await createBlogTag(payload)
        : await updateBlogTag(editingTagId || '', payload);

    setIsTagSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(tagDialogMode === 'create' ? 'Kategori berhasil dibuat' : 'Kategori berhasil diperbarui');
    setIsTagDialogOpen(false);
    resetTagForm();
    mutateTags();
    mutate();
  };

  const handleDeleteTag = async (tagId: string) => {
    const approved = window.confirm('Hapus kategori ini dari CMS? Relasi tag pada artikel juga akan dilepas.');
    if (!approved) return;

    const result = await deleteBlogTag(tagId);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Kategori berhasil dihapus');
    mutateTags();
    mutate();
  };

  const statCards = [
    { label: 'Total Artikel', value: allPosts.length, icon: FileText, gradient: 'gradient-blue', glow: 'shadow-blue-500/20' },
    { label: 'Published', value: publishedCount, icon: CheckCircle2, gradient: 'gradient-emerald', glow: 'shadow-emerald-500/20' },
    { label: 'Draft', value: draftCount, icon: Edit3, gradient: 'gradient-amber', glow: 'shadow-amber-500/20' },
    { label: 'Total Views', value: totalViews.toLocaleString('id-ID'), icon: BarChart3, gradient: 'gradient-violet', glow: 'shadow-violet-500/20' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat artikel blog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-[24px] font-bold tracking-tight text-foreground sm:text-[28px]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/20">
              <PenSquare className="h-5 w-5" />
            </div>
            Blog CMS
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground sm:text-[14px]">
            Kelola artikel, tutorial, dan ide untuk publish ke zmaula.web.id
          </p>
        </div>
        <Link href="/blog/new">
          <Button className="h-auto w-full gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-5 py-2.5 text-[13px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 hover:opacity-90 active:scale-[0.97] sm:w-auto">
            <Plus className="h-4 w-4" />
            Tulis Artikel
          </Button>
        </Link>
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
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
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

      {/* ─── Controls ─── */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
              activeTab === 'all' 
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{allPosts.length}</span>
          </button>
          {(Object.entries(BLOG_STATUSES) as [BlogStatus, typeof BLOG_STATUSES[BlogStatus]][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                activeTab === key 
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="mr-1.5" style={{ color: activeTab === key ? 'inherit' : val.color }}>{val.icon}</span>
              {val.label}
              <span className="ml-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                {allPosts.filter(p => p.status === key).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row xl:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari artikel atau tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border-border/60 bg-card pl-9 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/50 shadow-sm"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-full shrink-0 rounded-xl border-border/60 bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground sm:w-10">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── Articles Table ─── */}
      <div className="widget-card rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="hidden grid-cols-12 gap-4 border-b border-border/60 bg-muted/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div className="col-span-6 md:col-span-5">Artikel</div>
          <div className="hidden md:block md:col-span-2">Tags</div>
          <div className="col-span-3 md:col-span-2 text-center">Stats</div>
          <div className="col-span-3 md:col-span-2 text-right">Terakhir Edit</div>
          <div className="col-span-1" />
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border/40">
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <PenSquare className="h-8 w-8" />
              </div>
              <h3 className="text-[14px] font-medium text-foreground">Tidak ada artikel ditemukan</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">Coba ubah kata kunci pencarian atau filter tab.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {filteredPosts.map((post) => (
                  <BlogPostMobileCard
                    key={post.id}
                    post={post}
                    getVisibilityIcon={getVisibilityIcon}
                    onTogglePublish={handleTogglePublish}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              <div className="hidden divide-y divide-border/40 md:block">
                {filteredPosts.map((post) => {
                  const isScheduled = isScheduledDraft(post);

                  return (
                  <div
                    key={post.id}
                    className="group grid grid-cols-12 items-center gap-4 px-5 py-4 transition-all duration-200 hover:bg-muted/30"
                  >
                    <div className="col-span-6 md:col-span-5">
                      <div className="flex items-start gap-3">
                        <div className="relative mt-0.5 hidden h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted sm:block">
                          {post.featured_image_url ? (
                            <Image
                              src={post.featured_image_url}
                              alt={post.featured_image_alt || 'Cover'}
                              fill
                              sizes="64px"
                              className="object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <PenSquare className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/blog/${post.id}/edit`} className="group/link flex items-center gap-1.5">
                            <h3 className="truncate text-[14px] font-semibold text-foreground transition-colors group-hover/link:text-primary">
                              {post.title}
                            </h3>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 translate-x-0.5 -translate-y-0.5 text-muted-foreground/0 transition-all duration-200 group-hover/link:translate-x-0 group-hover/link:translate-y-0 group-hover/link:text-primary" />
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                              style={{
                                backgroundColor: isScheduled ? '#8b5cf615' : `${BLOG_STATUSES[post.status].color}15`,
                                color: isScheduled ? '#8b5cf6' : BLOG_STATUSES[post.status].color,
                              }}
                            >
                              {isScheduled ? '◔ Scheduled' : `${BLOG_STATUSES[post.status].icon} ${BLOG_STATUSES[post.status].label}`}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground/70">
                              {getVisibilityIcon(post.visibility)}
                              <span className="capitalize">{post.visibility}</span>
                            </span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground/50">/blog/{post.slug}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden flex-wrap gap-1.5 md:col-span-2 md:flex">
                      {post.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag.id} variant="outline" className="rounded-full border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {tag.name}
                        </Badge>
                      ))}
                      {post.tags && post.tags.length > 2 && (
                        <span className="text-[10px] font-medium text-muted-foreground/50">+{post.tags.length - 2}</span>
                      )}
                    </div>

                    <div className="col-span-3 flex flex-col items-center justify-center gap-1.5 md:col-span-2">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground" title="Views">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="tabular-nums font-medium">{new Intl.NumberFormat('id-ID').format(post.view_count)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60" title="Reading time & words">
                        <Clock className="h-3 w-3" />
                        <span className="tabular-nums">{post.reading_time_minutes}m · {post.word_count}w</span>
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      {post.status === 'published' && post.published_at ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-medium text-emerald-500 dark:text-emerald-400">Published</span>
                          <span className="text-[11px] text-muted-foreground">{format(parseISO(post.published_at), 'd MMM y', { locale: id })}</span>
                        </div>
                      ) : isScheduled && post.scheduled_at ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-medium text-violet-500 dark:text-violet-400">Scheduled</span>
                          <span className="text-[11px] text-muted-foreground">{format(parseISO(post.scheduled_at), 'd MMM y • HH:mm', { locale: id })}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-medium text-muted-foreground">Edited</span>
                          <span className="text-[11px] text-muted-foreground/60">{formatDistanceToNow(parseISO(post.updated_at), { addSuffix: true, locale: id })}</span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-1 text-right">
                      <BlogPostActions post={post} onTogglePublish={handleTogglePublish} onDelete={handleDelete} />
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-foreground">Kategori & Tags</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Atur taxonomy blog dari satu tempat. Kategori ini dipakai di editor artikel, halaman tag publik, dan struktur konten di zmaula.web.id.
            </p>
          </div>
          <Button type="button" onClick={openCreateTagDialog} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Kategori
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {tags.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Tag className="h-5 w-5" />
              </div>
              <h3 className="text-[14px] font-semibold text-foreground">Belum ada kategori blog</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Buat taxonomy pertamamu supaya artikel lebih mudah dikelompokkan dan dibaca pengunjung.
              </p>
            </div>
          ) : (
            tags.map((tag) => (
              <BlogTagRow
                key={tag.id}
                tag={tag}
                onEdit={openEditTagDialog}
                onDelete={handleDeleteTag}
              />
            ))
          )}
        </div>
      </div>

      <Dialog open={isTagDialogOpen} onOpenChange={(open) => {
        setIsTagDialogOpen(open);
        if (!open) resetTagForm();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tagDialogMode === 'create' ? 'Tambah Kategori Blog' : 'Edit Kategori Blog'}
            </DialogTitle>
            <DialogDescription>
              Kategori ini akan muncul di editor artikel dan halaman tag publik. Gunakan nama yang jelas supaya struktur blog terasa rapi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground">Nama Kategori</label>
              <Input
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="Contoh: Digital Marketing"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground">Deskripsi</label>
              <Textarea
                value={tagDescription}
                onChange={(event) => setTagDescription(event.target.value)}
                placeholder="Jelaskan kategori ini akan menampung tulisan seperti apa."
                className="min-h-[110px] rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground">Warna</label>
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <input
                  type="color"
                  value={tagColor}
                  onChange={(event) => setTagColor(event.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border/60 bg-transparent"
                />
                <div>
                  <p className="text-[12px] font-medium text-foreground">{tagColor.toUpperCase()}</p>
                  <p className="text-[11px] text-muted-foreground">Dipakai untuk chip dan identitas visual kategori.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsTagDialogOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button type="button" onClick={handleSaveTag} disabled={isTagSaving} className="rounded-xl">
              {isTagSaving ? 'Menyimpan...' : tagDialogMode === 'create' ? 'Buat Kategori' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
