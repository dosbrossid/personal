'use client';

import { useState } from 'react';
import { CheckCircle2, Edit3, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { CLASS_SESSION_STATUSES } from '@/core/constants';
import type { ClassSession } from '@/core/types';
import { toDateInput, toDateTimeLocal, toIsoString } from '@/lib/classes-utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ClassesSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    meeting_number: number;
    title?: string;
    description?: string | null;
    session_date: string;
    start_at: string;
    end_at?: string | null;
    status?: 'planned' | 'completed' | 'canceled' | 'rescheduled';
    attendance_count?: number;
    assignment_given?: boolean;
    assignment_title?: string | null;
    assignment_due_at?: string | null;
    reflection_note?: string | null;
  }) => Promise<boolean>;
  session?: ClassSession | null;
  nextMeetingNumber: number;
}

export function ClassesSessionDialog({
  open,
  onClose,
  onSave,
  session,
  nextMeetingNumber,
}: ClassesSessionDialogProps) {
  const isEdit = Boolean(session);
  const [isSaving, setIsSaving] = useState(false);
  const [meetingNumber, setMeetingNumber] = useState(String(session?.meeting_number ?? nextMeetingNumber));
  const [title, setTitle] = useState(session?.title ?? '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [sessionDate, setSessionDate] = useState(toDateInput(session?.session_date));
  const [startAt, setStartAt] = useState(toDateTimeLocal(session?.start_at));
  const [endAt, setEndAt] = useState(toDateTimeLocal(session?.end_at));
  const [status, setStatus] = useState<'planned' | 'completed' | 'canceled' | 'rescheduled'>(session?.status ?? 'planned');
  const [attendanceCount, setAttendanceCount] = useState(String(session?.attendance_count ?? 0));
  const [assignmentGiven, setAssignmentGiven] = useState(session?.assignment_given ?? false);
  const [assignmentTitle, setAssignmentTitle] = useState(session?.assignment_title ?? '');
  const [assignmentDueAt, setAssignmentDueAt] = useState(toDateTimeLocal(session?.assignment_due_at));
  const [reflectionNote, setReflectionNote] = useState(session?.reflection_note ?? '');

  const handleSave = async () => {
    if (isSaving) return;

    if (!sessionDate || !startAt) {
      toast.error('Tanggal sesi dan jam mulai wajib diisi');
      return;
    }
    if (Number(meetingNumber) < 1) {
      toast.error('Nomor pertemuan minimal 1');
      return;
    }
    if (endAt && endAt <= startAt) {
      toast.error('Jam selesai pertemuan harus setelah jam mulai');
      return;
    }
    if (assignmentGiven && assignmentDueAt && assignmentDueAt <= startAt) {
      toast.error('Deadline tugas harus setelah jam mulai pertemuan');
      return;
    }

    setIsSaving(true);
    const ok = await onSave({
      meeting_number: Number(meetingNumber),
      title: title.trim() || undefined,
      description: description.trim() || null,
      session_date: sessionDate,
      start_at: toIsoString(startAt) || new Date().toISOString(),
      end_at: toIsoString(endAt),
      status,
      attendance_count: Number(attendanceCount || 0),
      assignment_given: assignmentGiven,
      assignment_title: assignmentGiven ? assignmentTitle.trim() || null : null,
      assignment_due_at: assignmentGiven ? toIsoString(assignmentDueAt) : null,
      reflection_note: reflectionNote.trim() || null,
    }).finally(() => setIsSaving(false));

    if (ok) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !isSaving) onClose();
    }}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden border-border/60 bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2.5 ts-h2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20">
              {isEdit ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            {isEdit ? 'Edit Pertemuan' : 'Tambah Pertemuan'}
          </DialogTitle>
          <DialogDescription>
            Sesi ini otomatis tetap tersambung ke kalender, jadi perubahan jadwal tidak perlu dicatat dua kali.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pertemuan ke-</label>
            <Input type="number" min="1" value={meetingNumber} onChange={(event) => setMeetingNumber(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'planned' | 'completed' | 'canceled' | 'rescheduled')}
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none"
            >
              {(Object.keys(CLASS_SESSION_STATUSES) as Array<'planned' | 'completed' | 'canceled' | 'rescheduled'>).map((value) => (
                <option key={value} value={value}>{CLASS_SESSION_STATUSES[value].label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Judul Sesi</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Opsional. Jika kosong, sistem pakai 'Pertemuan X'" className="h-10 rounded-lg border-border/60 bg-background" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tanggal</label>
            <Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jumlah Hadir</label>
            <Input type="number" min="0" value={attendanceCount} onChange={(event) => setAttendanceCount(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mulai</label>
            <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Selesai</label>
            <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deskripsi / agenda</label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Pokok bahasan, agenda kelas, atau pengingat kecil untuk pertemuan ini." className="min-h-[80px] rounded-lg border-border/60 bg-background resize-none" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="flex items-center gap-2 text-[12px] font-medium text-foreground">
              <input type="checkbox" checked={assignmentGiven} onChange={(event) => setAssignmentGiven(event.target.checked)} />
              Ada tugas pada pertemuan ini
            </label>
          </div>

          {assignmentGiven && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Judul Tugas</label>
                <Input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="Ringkas dan jelas" className="h-10 rounded-lg border-border/60 bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deadline Tugas</label>
                <Input type="datetime-local" value={assignmentDueAt} onChange={(event) => setAssignmentDueAt(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
              </div>
            </>
          )}

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Refleksi Dosen</label>
            <Textarea value={reflectionNote} onChange={(event) => setReflectionNote(event.target.value)} placeholder="Catatan kecil setelah kelas selesai: respons mahasiswa, apa yang perlu diperbaiki, atau follow-up." className="min-h-[90px] rounded-lg border-border/60 bg-background resize-none" />
          </div>
        </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/40 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
          <Button onClick={handleSave} disabled={isSaving || !sessionDate || !startAt} className="h-9 gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-[12px] font-semibold text-white shadow-md shadow-blue-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSaving ? 'Menyimpan...' : isEdit ? 'Simpan Pertemuan' : 'Tambah Pertemuan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
