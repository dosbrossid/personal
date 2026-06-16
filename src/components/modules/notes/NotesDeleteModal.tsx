'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BrainNote } from '@/core/types';

function DeleteConfirmModal({
  note,
  onClose,
  onConfirm,
}: {
  note: BrainNote | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!note) return null;
  return (
    <Dialog open={!!note} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 ts-title">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            Hapus Catatan?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground pt-2">
            Apakah Anda yakin ingin menghapus <span className="font-semibold text-foreground">&ldquo;{note.title}&rdquo;</span>? Aksi ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            className="h-9 gap-2 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 shadow-md shadow-red-500/25 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ya, Hapus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteConfirmModal };
