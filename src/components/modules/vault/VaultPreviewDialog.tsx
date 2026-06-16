'use client';

import { FileText, Download, Link2 } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { ACADEMIC_DOC_ICONS, ACADEMIC_DOC_TYPES } from '@/core/constants';
import type { AcademicVaultItem } from '@/core/types';
import { createVaultDownloadUrl } from '@/actions/vault.actions';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────
// File Preview Modal
// ─────────────────────────────────────

export interface VaultPreviewDialogProps {
  item: AcademicVaultItem | null;
  onClose: () => void;
}

export function VaultPreviewDialog({ item, onClose }: VaultPreviewDialogProps) {
  if (!item) return null;
  const docIcon = ACADEMIC_DOC_ICONS[item.document_type];
  const isExternalReference = Boolean(item.gdrive_id || /^https?:\/\//.test(item.file_url));

  const handleDownload = async () => {
    const result = await createVaultDownloadUrl(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    window.open(result.data!, '_blank', 'noopener,noreferrer');
    toast.success(`Membuka "${item.title}"...`);
  };

  const handleShare = async () => {
    const result = await createVaultDownloadUrl(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.data!);
    toast.success('Signed link disalin ke clipboard!');
  };

  // Simulated content preview
  const getPreviewContent = () => {
    switch (item.document_type) {
      case 'rps':
        return (
          <div className="space-y-4 text-[13px] text-muted-foreground leading-relaxed">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-2">
              <h4 className="font-semibold text-foreground text-[14px]">Rencana Pembelajaran Semester</h4>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <span className="text-muted-foreground">Mata Kuliah:</span>
                <span className="text-foreground font-medium">{item.mata_kuliah || 'N/A'}</span>
                <span className="text-muted-foreground">Semester:</span>
                <span className="text-foreground font-medium">{item.semester || 'N/A'}</span>
                <span className="text-muted-foreground">SKS:</span>
                <span className="text-foreground font-medium">3 SKS</span>
                <span className="text-muted-foreground">Program Studi:</span>
                <span className="text-foreground font-medium">Teknik Informatika</span>
              </div>
            </div>
            <div className="space-y-2">
              <h5 className="font-semibold text-foreground">Capaian Pembelajaran Lulusan:</h5>
              <ul className="list-disc list-inside space-y-1 text-[12px]">
                <li>Mampu menguasai konsep dasar dan lanjut dalam bidang studi</li>
                <li>Mampu mengaplikasikan pengetahuan secara profesional</li>
                <li>Mampu mengidentifikasi dan menyelesaikan permasalahan</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h5 className="font-semibold text-foreground">Jadwal Pertemuan:</h5>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                {[1, 2, 3, 4].map(week => (
                  <div key={week} className={cn('flex items-center px-3 py-2 text-[12px]', week % 2 === 0 ? 'bg-muted/15' : '')}>
                    <span className="w-24 font-medium text-foreground">Minggu {week}</span>
                    <span className="text-muted-foreground flex-1">
                      {week === 1 ? 'Pengenalan dan Pendahuluan' :
                       week === 2 ? 'Konsep Dasar dan Terminologi' :
                       week === 3 ? 'Implementasi dan Studi Kasus' :
                       'Praktikum dan Latihan'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'materi_ajar':
        return (
          <div className="space-y-4 text-[13px] text-muted-foreground">
            <div className="rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/10 p-5">
              <p className="ts-h2 text-foreground mb-1">{item.title}</p>
              <p className="text-[12px] text-muted-foreground">{item.mata_kuliah} · {item.semester}</p>
            </div>
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-lg bg-muted/20 border-l-3 border-primary">
                <p className="text-[14px] font-semibold text-foreground mb-1">Tujuan Pembelajaran</p>
                <p className="text-[12px]">Setelah mempelajari materi ini, mahasiswa diharapkan mampu memahami konsep dan mengaplikasikannya dalam proyek.</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-[14px]">Outline Materi:</p>
                {['Pendahuluan', 'Konsep Utama', 'Contoh Implementasi', 'Studi Kasus', 'Latihan Soal'].map((topic, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">{i + 1}</span>
                    <span className="text-[13px] text-foreground">{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4 text-[13px] text-muted-foreground">
            <div className="rounded-xl bg-muted/20 border border-border/40 p-5 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-[14px] font-semibold text-foreground mb-1">{item.title}</p>
              <p className="text-[12px]">Preview dokumen tersedia setelah file diunduh.</p>
            </div>
            {item.description && (
              <div className="px-4 py-3 rounded-lg bg-muted/10 border border-border/30">
                <p className="text-[12px] font-medium text-foreground mb-1">Deskripsi</p>
                <p className="text-[12px]">{item.description}</p>
              </div>
            )}
            {item.ai_summary && (
              <div className="px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[12px] font-medium text-primary mb-1">✨ AI Summary</p>
                <p className="text-[12px]">{item.ai_summary}</p>
              </div>
            )}
            {isExternalReference && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">Referensi eksternal</p>
                <p className="mt-1 break-all text-[12px] text-muted-foreground">{item.file_url}</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-1rem)] flex-col overflow-hidden border-border/60 bg-card sm:w-auto sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-lg"
                style={{ backgroundColor: `${docIcon.color}15` }}
              >
                <span className="text-xl">{docIcon.icon}</span>
              </div>
              <div>
                <DialogTitle className="ts-title">{item.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${docIcon.color}12`, color: docIcon.color }}
                  >
                    {docIcon.icon} {ACADEMIC_DOC_TYPES[item.document_type]}
                  </span>
                  {item.mata_kuliah && (
                    <span className="text-[11px] text-muted-foreground">
                      {item.mata_kuliah}
                    </span>
                  )}
                  {item.semester && (
                    <span className="text-[11px] text-muted-foreground/50">
                      · {item.semester}
                    </span>
                  )}
                  {item.file_size_bytes && (
                    <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                      · {formatFileSize(item.file_size_bytes)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Preview content */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {getPreviewContent()}
        </div>

        {/* Actions footer */}
        <div className="shrink-0 border-t border-border/40 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare} className="h-8 flex-1 gap-1.5 rounded-lg border-border/60 text-[12px] sm:flex-none">
                <Link2 className="h-3.5 w-3.5 text-violet-500" />
                Share Link
              </Button>
            </div>
            <Button onClick={handleDownload} size="sm" className="h-8 w-full gap-1.5 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-[12px] font-semibold text-white shadow-md shadow-primary/25 sm:w-auto">
              <Download className="h-3.5 w-3.5" />
              {isExternalReference ? 'Buka Referensi' : 'Download File'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
