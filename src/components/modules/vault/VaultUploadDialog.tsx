'use client';

import { useState, useCallback } from 'react';
import {
  Upload, CloudUpload, File, X, CheckCircle2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACADEMIC_DOC_TYPES } from '@/core/constants';
import type { AcademicDocType } from '@/core/constants';
import {
  createVaultItem,
  uploadVaultDocuments,
} from '@/actions/vault.actions';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

type UploadItem = { id: string; file: File; name: string; size: number; type: string; progress: number };
type UploadMode = 'file' | 'link';

export interface VaultUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  semesterFilters: { key: string; label: string }[];
}

// ─────────────────────────────────────
// Upload Modal
// ─────────────────────────────────────

export function VaultUploadDialog({ open, onClose, onUploaded, semesterFilters }: VaultUploadDialogProps) {
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [dragOver, setDragOver] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadItem[]>([]);
  const [docType, setDocType] = useState<AcademicDocType>('materi_ajar');
  const [semester, setSemester] = useState('Genap 2025/2026');
  const [mataKuliah, setMataKuliah] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const queueFiles = useCallback((files: File[]) => {
    const newFiles: UploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
    }));

    setUploadFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    queueFiles(files);
  }, [queueFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    queueFiles(files);
    e.target.value = '';
  }, [queueFiles]);

  const handleSubmit = async () => {
    if (isUploading) return;

    if (uploadMode === 'file') {
      if (uploadFiles.length === 0) return;

      setIsUploading(true);
      setUploadFiles((prev) => prev.map((file) => ({ ...file, progress: 45 })));

      const formData = new FormData();
      uploadFiles.forEach((item) => formData.append('files', item.file));
      formData.set('document_type', docType);
      formData.set('semester', semester);
      formData.set('mata_kuliah', mataKuliah);

      const result = await uploadVaultDocuments(formData);

      if (result.error) {
        toast.error(result.error);
        setUploadFiles((prev) => prev.map((file) => ({ ...file, progress: 0 })));
        setIsUploading(false);
        return;
      }

      setUploadFiles((prev) => prev.map((file) => ({ ...file, progress: 100 })));
      toast.success(`${result.data?.length ?? uploadFiles.length} file berhasil diupload`);
      setIsUploading(false);
      onUploaded();
      onClose();
      return;
    }

    if (!linkTitle.trim()) {
      toast.error('Judul dokumen wajib diisi');
      return;
    }

    try {
      new URL(linkUrl);
    } catch {
      toast.error('URL referensi tidak valid');
      return;
    }

    setIsUploading(true);
    const result = await createVaultItem({
      title: linkTitle.trim(),
      description: linkDescription.trim() || undefined,
      document_type: docType,
      file_format: 'link',
      file_url: linkUrl.trim(),
      semester,
      mata_kuliah: mataKuliah.trim() || null,
    });

    if (result.error) {
      toast.error(result.error);
      setIsUploading(false);
      return;
    }

    toast.success(`Referensi "${linkTitle}" berhasil disimpan`);
    setIsUploading(false);
    onUploaded();
    onClose();
  };

  const removeFile = (idx: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] border-border/60 bg-card sm:w-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 ts-h2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20">
              <Upload className="h-4.5 w-4.5" />
            </div>
            Upload Dokumen
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Upload dokumen akademik ke vault. Format: PDF, DOCX, PPTX, XLSX
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-muted/15 p-1">
            <button
              onClick={() => setUploadMode('file')}
              className={cn(
                'rounded-xl px-3 py-2 text-[12px] font-medium transition-all',
                uploadMode === 'file'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Upload File
            </button>
            <button
              onClick={() => setUploadMode('link')}
              className={cn(
                'rounded-xl px-3 py-2 text-[12px] font-medium transition-all',
                uploadMode === 'link'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Simpan Link
            </button>
          </div>

          {uploadMode === 'file' ? (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-300',
                  dragOver
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/[0.02]'
                )}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls"
                />
                <div className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-300',
                  dragOver ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <CloudUpload className="h-7 w-7" />
                </div>
                <p className="mt-3 text-[14px] font-medium text-foreground">
                  {dragOver ? 'Lepaskan file di sini' : 'Drag & drop file'}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">atau klik untuk browse file</p>
              </div>

              {/* Uploaded Files */}
              {uploadFiles.length > 0 && (
                <div className="max-h-[160px] space-y-2 overflow-y-auto scrollbar-thin">
                  {uploadFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="animate-in fade-in slide-in-from-bottom-1 flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3.5 py-2.5 duration-200"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                        <File className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.progress >= 100 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : isUploading ? (
                          <span className="tabular-nums text-[11px] text-muted-foreground">uploading</span>
                        ) : (
                          <span className="tabular-nums text-[11px] text-muted-foreground">ready</span>
                        )}
                        <button
                          onClick={() => removeFile(i)}
                          disabled={isUploading}
                          className="text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Judul Referensi</label>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="cth: RPS Algoritma di Google Drive"
                  className="h-9 rounded-lg border-border/60 bg-background text-[12px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">URL Dokumen</label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/... atau URL dokumen lain"
                  className="h-9 rounded-lg border-border/60 bg-background text-[12px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Deskripsi (opsional)</label>
                <Input
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="Ringkasan singkat isi dokumen"
                  className="h-9 rounded-lg border-border/60 bg-background text-[12px]"
                />
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Tipe Dokumen</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as AcademicDocType)}
                className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              >
                {Object.entries(ACADEMIC_DOC_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Semester</label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              >
                {semesterFilters.filter(s => s.key !== 'all').map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Mata Kuliah (opsional)</label>
            <Input
              value={mataKuliah}
              onChange={e => setMataKuliah(e.target.value)}
              placeholder="cth: Algoritma & Pemrograman"
              className="h-9 rounded-lg border-border/60 bg-background text-[12px]"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={onClose} className="h-9 w-full rounded-lg border-border/60 text-[12px] sm:w-auto">
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={(uploadMode === 'file' ? uploadFiles.length === 0 : !linkTitle.trim() || !linkUrl.trim()) || isUploading}
              className="h-9 w-full gap-2 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-[12px] font-semibold text-white shadow-md shadow-primary/25 transition-all hover:opacity-90 disabled:opacity-40 sm:w-auto"
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {isUploading
                ? uploadMode === 'file' ? 'Mengupload...' : 'Menyimpan link...'
                : uploadMode === 'file'
                  ? `Upload ${uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}`
                  : 'Simpan Referensi'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
