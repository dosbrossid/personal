'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ClassesDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
}

export function ClassesDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
}: ClassesDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !isDeleting) onClose();
    }}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 ts-title">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isDeleting} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
          <Button onClick={handleConfirm} disabled={isDeleting} className="h-9 gap-2 rounded-lg bg-red-500 text-[12px] font-semibold text-white shadow-md shadow-red-500/20 hover:bg-red-600">
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? 'Menghapus...' : 'Ya, hapus'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
