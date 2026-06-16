'use client';

import { useState, useMemo } from 'react';

import {
  GraduationCap, Plus, FileText, ExternalLink, Search, Download,
  HardDrive, FolderOpen, ChevronRight, ArrowLeft, LayoutGrid,
  List, Archive, Filter, Eye, MoreVertical, Trash2, Share2,
} from 'lucide-react';
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils';
import { StatCard } from '@/components/shared/StatCard';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { useVaultItems } from '@/hooks/use-vault';
import {
  createVaultDownloadUrl,
  deleteVaultItem as deleteVaultAction,
} from '@/actions/vault.actions';
import { VaultUploadDialog } from '@/components/modules/vault/VaultUploadDialog';
import { VaultPreviewDialog } from '@/components/modules/vault/VaultPreviewDialog';
import { VaultDeleteDialog } from '@/components/modules/vault/VaultDeleteDialog';
import { toast } from 'sonner';
import { ACADEMIC_DOC_TYPES, ACADEMIC_DOC_ICONS } from '@/core/constants';
import type { AcademicDocType } from '@/core/constants';
import type { AcademicVaultItem } from '@/core/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface CourseFolder {
  key: string;
  name: string;
  semester: string;
  docCounts: Record<string, number>;
  totalFiles: number;
  totalSize: number;
  latestUpdate: string;
}

type ViewMode = 'folders' | 'list';
type FolderSelection = { key: string; name: string; semester: string };

// Toast is now handled by Sonner



const semesterFilters = [
  { key: 'all', label: 'Semua' },
  { key: 'Genap 2025/2026', label: 'Genap 2025/2026' },
  { key: 'Ganjil 2025/2026', label: 'Ganjil 2025/2026' },
  { key: 'Genap 2024/2025', label: 'Genap 2024/2025' },
];



// ─────────────────────────────────────
// Main Page
// ─────────────────────────────────────

export default function VaultPage() {
  const { items: vaultItems, isLoading, mutate } = useVaultItems();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedDocType, setSelectedDocType] = useState<AcademicDocType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [openFolder, setOpenFolder] = useState<FolderSelection | null>(null);

  // Modal states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<AcademicVaultItem | null>(null);
  const [deletingItem, setDeleteItem] = useState<AcademicVaultItem | null>(null);

  // Data
  const filteredItems = useMemo(() => {
    return vaultItems.filter((item) => {
      if (selectedSemester !== 'all' && item.semester !== selectedSemester) return false;
      if (selectedDocType !== 'all' && item.document_type !== selectedDocType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.mata_kuliah?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vaultItems, searchQuery, selectedSemester, selectedDocType]);

  const { courseFolders, uncategorizedItems } = useMemo(() => {
    const courseMap = new Map<string, CourseFolder>();
    const uncategorized = filteredItems.filter((item) => !item.mata_kuliah);

    filteredItems
      .filter((item) => item.mata_kuliah)
      .forEach((item) => {
        const key = `${item.mata_kuliah}___${item.semester ?? 'all'}`;
        if (!courseMap.has(key)) {
          courseMap.set(key, {
            key,
            name: item.mata_kuliah!,
            semester: item.semester ?? 'Tanpa Semester',
            docCounts: {},
            totalFiles: 0,
            totalSize: 0,
            latestUpdate: item.updated_at,
          });
        }
        const folder = courseMap.get(key)!;
        folder.totalFiles++;
        folder.totalSize += item.file_size_bytes ?? 0;
        folder.docCounts[item.document_type] = (folder.docCounts[item.document_type] ?? 0) + 1;
        if (item.updated_at > folder.latestUpdate) {
          folder.latestUpdate = item.updated_at;
        }
      });

    const folders = Array.from(courseMap.values()).sort(
      (a, b) => new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    );

    return { courseFolders: folders, uncategorizedItems: uncategorized };
  }, [filteredItems]);

  const folderItems = useMemo(() => {
    const activeFolder = openFolder
      ? courseFolders.find((folder) => folder.key === openFolder.key) ?? null
      : null;
    if (!activeFolder) return [];
    return filteredItems
      .filter((item) => item.mata_kuliah === activeFolder.name && (item.semester ?? 'Tanpa Semester') === activeFolder.semester)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [courseFolders, filteredItems, openFolder]);

  const activeOpenFolder = useMemo(
    () => (openFolder ? courseFolders.find((folder) => folder.key === openFolder.key) ?? null : null),
    [courseFolders, openFolder]
  );

  const totalStorage = vaultItems.reduce((sum, item) => sum + (item.file_size_bytes ?? 0), 0);
  const totalDocs = vaultItems.length;
  const rpsCount = vaultItems.filter(i => i.document_type === 'rps').length;
  const materiCount = vaultItems.filter(i => i.document_type === 'materi_ajar').length;
  const maxStorage = 1024 * 1024 * 1024;
  const storagePercent = (totalStorage / maxStorage) * 100;

  const effectiveView = searchQuery.trim() ? 'list' : viewMode;

  const statCards = [
    { label: 'Total Dokumen', value: totalDocs, icon: FileText, gradient: 'gradient-amber', glow: 'shadow-amber-500/20' },
    { label: 'RPS & Silabus', value: rpsCount + vaultItems.filter(i => i.document_type === 'silabus').length, icon: GraduationCap, gradient: 'gradient-blue', glow: 'shadow-blue-500/20' },
    { label: 'Materi Ajar', value: materiCount, icon: FolderOpen, gradient: 'gradient-emerald', glow: 'shadow-emerald-500/20' },
    { label: 'Storage', value: formatFileSize(totalStorage), icon: HardDrive, gradient: 'gradient-violet', glow: 'shadow-violet-500/20' },
  ];

  // Action handlers
  const handleDownload = async (item: AcademicVaultItem) => {
    const result = await createVaultDownloadUrl(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    window.open(result.data!, '_blank', 'noopener,noreferrer');
    toast.success(`Membuka "${item.title}"...`);
  };

  const handleShare = async (item: AcademicVaultItem) => {
    const result = await createVaultDownloadUrl(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.data!);
    toast.success(`Signed link "${item.title}" disalin ke clipboard!`);
  };

  const handleDelete = async () => {
    if (deletingItem) {
      const result = await deleteVaultAction(deletingItem.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${deletingItem.title}" berhasil dihapus`);
        mutate();
      }
      setDeleteItem(null);
    }
  };

  if (isLoading) {
    return <PageSkeleton statCount={4} contentRows={5} />;
  }

  return (
    <>
      <div className="space-y-6 overflow-x-hidden">
        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 ts-display text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
                <GraduationCap className="h-5 w-5" />
              </div>
              Academic Vault
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground sm:text-[14px]">
              Repositori RPS, silabus, materi ajar, dan dokumen akademik
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex items-center justify-between gap-2.5 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-sm sm:justify-start">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div className="w-20">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(storagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{formatFileSize(totalStorage)}</span>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-5 py-2.5 text-[13px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 hover:opacity-90 active:scale-[0.97] sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Upload
            </button>
          </div>
        </div>

        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              gradient={card.gradient}
              glow={card.glow}
            />
          ))}
        </div>

        {/* ─── Search ─── */}
        <div className="rounded-xl border border-border/60 bg-card p-1 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dokumen, mata kuliah, atau topik..."
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg bg-muted/50">
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span>{filteredItems.length} dokumen terlihat</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span>{courseFolders.length} folder mata kuliah</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span>{effectiveView === 'folders' ? 'Mode folder' : 'Mode list'}</span>
          </div>
        </div>

        {/* ─── Filters ─── */}
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Semester</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {semesterFilters.map((sem) => (
                <button
                  key={sem.key}
                  onClick={() => setSelectedSemester(selectedSemester === sem.key ? 'all' : sem.key)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-[12px] font-medium transition-all duration-200',
                    selectedSemester === sem.key
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {sem.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Archive className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Tipe Dokumen</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDocType('all')}
                className={cn(
                  'rounded-xl px-3 py-2 text-[12px] font-medium transition-all duration-200',
                  selectedDocType === 'all'
                    ? 'bg-amber-500/12 text-amber-600 shadow-sm dark:text-amber-400'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Semua Tipe
              </button>
              {(['rps', 'silabus', 'materi_ajar', 'jurnal'] as AcademicDocType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedDocType(selectedDocType === type ? 'all' : type)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-[12px] font-medium transition-all duration-200',
                    selectedDocType === type
                      ? 'bg-amber-500/12 text-amber-600 shadow-sm dark:text-amber-400'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {ACADEMIC_DOC_ICONS[type].icon} {ACADEMIC_DOC_TYPES[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm xl:min-w-[148px]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Tampilan
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted/30 p-1">
              <button
                onClick={() => setViewMode('folders')}
                className={cn(
                  'flex-1 rounded-lg p-2 transition-all duration-200',
                  effectiveView === 'folders' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <LayoutGrid className="mx-auto h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex-1 rounded-lg p-2 transition-all duration-200',
                  effectiveView === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <List className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Breadcrumb ─── */}
        {activeOpenFolder && effectiveView === 'folders' && (
          <div
            className="flex flex-wrap items-center gap-2 text-[14px]"
          >
            <button
              onClick={() => setOpenFolder(null)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-lg hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Vault
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-foreground font-semibold">{activeOpenFolder.name}</span>
            <Badge variant="outline" className="border-border/60 bg-background text-[11px] font-medium text-muted-foreground">
              {activeOpenFolder.semester}
            </Badge>
            <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary border-transparent font-medium">
              {folderItems.length} file
            </Badge>
          </div>
        )}

        {/* ─── FOLDER VIEW ─── */}
        {effectiveView === 'folders' && !openFolder && (
          <div className="space-y-6">
            {courseFolders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  <h2 className="text-[14px] font-semibold text-foreground">Mata Kuliah</h2>
                  <span className="text-[12px] text-muted-foreground/60">({courseFolders.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {courseFolders.map((folder) => (
                    <button
                      key={folder.key}
                      onClick={() => setOpenFolder({ key: folder.key, name: folder.name, semester: folder.semester })}
                      className="group widget-card rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm sm:p-5"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors duration-200">
                          <FolderOpen className="h-5 w-5 text-amber-500" />
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>

                      <h3 className="text-[15px] font-semibold text-foreground mb-1 truncate group-hover:text-primary transition-colors">{folder.name}</h3>
                      <p className="text-[12px] text-muted-foreground/60 mb-4">{folder.semester}</p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {Object.entries(folder.docCounts).slice(0, 3).map(([type, count]) => {
                          const docType = type as AcademicDocType;
                          return (
                            <span
                              key={type}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: `${ACADEMIC_DOC_ICONS[docType].color}12`,
                                color: ACADEMIC_DOC_ICONS[docType].color,
                              }}
                            >
                              {ACADEMIC_DOC_ICONS[docType].icon} {count}
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground/60 font-medium tabular-nums">
                          {folder.totalFiles} file · {formatFileSize(folder.totalSize)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {uncategorizedItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-[14px] font-semibold text-foreground">Dokumen Umum</h2>
                </div>
                <div className="widget-card rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
                  <DocumentTable
                    items={uncategorizedItems}
                    showCourse={false}
                    onPreview={setPreviewItem}
                    onDownload={handleDownload}
                    onShare={handleShare}
                    onDelete={setDeleteItem}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── FOLDER OPEN ─── */}
        {effectiveView === 'folders' && activeOpenFolder && (
          <div
            className="widget-card rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm"
          >
            <DocumentTable
              items={folderItems}
              showCourse={false}
              onPreview={setPreviewItem}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={setDeleteItem}
            />
          </div>
        )}

        {/* ─── LIST VIEW ─── */}
        {effectiveView === 'list' && (
          <div className="widget-card rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <DocumentTable
              items={filteredItems}
              showCourse={true}
              onPreview={setPreviewItem}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={setDeleteItem}
            />
          </div>
        )}

        {/* ─── Empty state ─── */}
        {filteredItems.length === 0 && (
          <div
            className="py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4 text-muted-foreground">
              <GraduationCap className="h-8 w-8" />
            </div>
            <p className="text-[14px] font-medium text-foreground mb-1">
              {vaultItems.length === 0 ? 'Vault kamu masih kosong' : 'Tidak ada dokumen ditemukan'}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {vaultItems.length === 0
                ? 'Mulai dengan upload file atau simpan link Google Drive agar materi akademikmu terkumpul di satu tempat.'
                : 'Coba ubah filter atau kata kunci pencarian.'}
            </p>
            {vaultItems.length === 0 && (
              <Button
                onClick={() => setUploadOpen(true)}
                className="mt-4 gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-[12px] font-semibold text-white shadow-md shadow-amber-500/25"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambahkan Dokumen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {uploadOpen && <VaultUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={() => mutate()} semesterFilters={semesterFilters} />}
      <VaultPreviewDialog item={previewItem} onClose={() => setPreviewItem(null)} />
      <VaultDeleteDialog item={deletingItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} />
    </>
  );
}

// ─────────────────────────────────────
// Document Table
// ─────────────────────────────────────

function DocumentTable({
  items,
  showCourse,
  onPreview,
  onDownload,
  onShare,
  onDelete,
}: {
  items: AcademicVaultItem[];
  showCourse: boolean;
  onPreview: (item: AcademicVaultItem) => void;
  onDownload: (item: AcademicVaultItem) => void;
  onShare: (item: AcademicVaultItem) => void;
  onDelete: (item: AcademicVaultItem) => void;
}) {
  const gridCols = showCourse
    ? 'grid-cols-[minmax(0,1.4fr)_130px_150px_120px_88px_72px]'
    : 'grid-cols-[minmax(0,1.4fr)_130px_120px_88px_72px]';

  return (
    <>
      <div className={cn('hidden gap-3 border-b border-border/40 bg-muted/30 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 md:grid', gridCols)}>
        <span>Dokumen</span>
        <span>Tipe</span>
        {showCourse && <span>Mata Kuliah</span>}
        <span>Semester</span>
        <span>Ukuran</span>
        <span className="text-right">Aksi</span>
      </div>

      <div className="divide-y divide-border/30">
        {items.map((item) => {
          const docIcon = ACADEMIC_DOC_ICONS[item.document_type];
          const isExternalReference = Boolean(item.gdrive_id || /^https?:\/\//.test(item.file_url));
          return (
            <div key={item.id}>
              <div
                className="cursor-pointer px-4 py-4 transition-all duration-200 hover:bg-muted/20 md:hidden"
                onClick={() => onPreview(item)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
                    style={{ backgroundColor: `${docIcon.color}10` }}
                  >
                    {isExternalReference ? (
                      <ExternalLink className="h-4 w-4" style={{ color: docIcon.color }} />
                    ) : (
                      <span>{docIcon.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-foreground">{item.title}</p>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60 bg-card shadow-xl">
                            <DropdownMenuItem onClick={() => onPreview(item)} className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
                              <Eye className="h-4 w-4 text-muted-foreground" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDownload(item)} className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
                              <Download className="h-4 w-4 text-muted-foreground" /> {isExternalReference ? 'Buka Referensi' : 'Download'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onShare(item)} className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
                              <Share2 className="h-4 w-4 text-muted-foreground" /> Share Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/40" />
                            <DropdownMenuItem onClick={() => onDelete(item)} className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500">
                              <Trash2 className="h-4 w-4" /> Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: `${docIcon.color}12`, color: docIcon.color }}
                      >
                        {docIcon.icon} {ACADEMIC_DOC_TYPES[item.document_type]}
                      </span>
                      {showCourse && item.mata_kuliah && (
                        <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-foreground">
                          {item.mata_kuliah}
                        </span>
                      )}
                      {item.semester && (
                        <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
                          {item.semester}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{item.file_size_bytes ? formatFileSize(item.file_size_bytes) : 'Link eksternal'}</span>
                        <span>{formatRelativeTime(item.updated_at)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(item);
                        }}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        {isExternalReference ? 'Buka' : 'Unduh'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cn('group hidden cursor-pointer items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-muted/20 md:grid', gridCols)}
                onClick={() => onPreview(item)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg transition-transform duration-200 group-hover:scale-105"
                    style={{ backgroundColor: `${docIcon.color}10` }}
                  >
                    {isExternalReference ? (
                      <ExternalLink className="h-4 w-4" style={{ color: docIcon.color }} />
                    ) : (
                      <span>{docIcon.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">{item.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatRelativeTime(item.updated_at)}</span>
                      {item.description && <span className="truncate">{item.description}</span>}
                    </div>
                  </div>
                </div>

                <span
                  className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                  style={{ backgroundColor: `${docIcon.color}12`, color: docIcon.color }}
                >
                  {docIcon.icon} {ACADEMIC_DOC_TYPES[item.document_type]}
                </span>

                {showCourse && (
                  <span className="truncate text-[12px] text-muted-foreground">{item.mata_kuliah ?? '—'}</span>
                )}

                <span className="truncate text-[12px] text-muted-foreground/70">{item.semester ?? '—'}</span>

                <span className="text-[12px] text-muted-foreground/70 tabular-nums">
                  {item.file_size_bytes ? formatFileSize(item.file_size_bytes) : 'Link'}
                </span>

                <div className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground md:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60 bg-card shadow-xl">
                      <DropdownMenuItem onClick={() => onPreview(item)} className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
                        <Eye className="h-4 w-4 text-muted-foreground" /> Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDownload(item)} className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
                        <Download className="h-4 w-4 text-muted-foreground" /> {isExternalReference ? 'Buka Referensi' : 'Download'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onShare(item)} className="gap-2 rounded-lg text-[13px] focus:bg-muted focus:text-foreground">
                        <Share2 className="h-4 w-4 text-muted-foreground" /> Share Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuItem onClick={() => onDelete(item)} className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500">
                        <Trash2 className="h-4 w-4" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
