'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import type { AcademicVaultItem } from '@/core/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────
// Delete Confirmation Modal
// ─────────────────────────────────────

export interface VaultDeleteDialogProps {
  item: AcademicVaultItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function VaultDeleteDialog({ item, onClose, onConfirm }: VaultDeleteDialogProps) {
  if (!item) return null;
  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] border-border/60 bg-card sm:w-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 ts-title">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            Hapus Dokumen?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground pt-2">
            Apakah Anda yakin ingin menghapus <span className="font-semibold text-foreground">&ldquo;{item.title}&rdquo;</span>? Aksi ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" onClick={onClose} className="h-9 w-full rounded-lg border-border/60 text-[12px] sm:w-auto">
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            className="h-9 w-full gap-2 rounded-lg bg-red-500 text-[12px] font-semibold text-white shadow-md shadow-red-500/25 transition-all hover:bg-red-600 sm:w-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ya, Hapus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
