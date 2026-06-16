'use client';

import { useState } from 'react';
import { CheckCircle2, Edit3, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  CLASS_COURSE_STATUSES,
  ROLES,
} from '@/core/constants';
import type { RoleContext } from '@/core/constants';
import type { ClassCourse } from '@/core/types';
import { getAcademicSemesterLabel } from '@/lib/classes-utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ClassesCourseDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    course_code?: string | null;
    semester_label?: string | null;
    meeting_target?: 8 | 16;
    student_count?: number;
    first_session_date?: string;
    default_day_of_week?: number | null;
    default_start_time?: string | null;
    default_end_time?: string | null;
    location?: string | null;
    contextual_role?: string;
    status?: 'active' | 'completed' | 'archived';
    notes?: string | null;
  }) => Promise<boolean>;
  editCourse?: ClassCourse | null;
}

export function ClassesCourseDialog({
  open,
  onClose,
  onSave,
  editCourse,
}: ClassesCourseDialogProps) {
  const isEdit = Boolean(editCourse);
  const [semesterTouched, setSemesterTouched] = useState(Boolean(editCourse?.semester_label));
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(editCourse?.name ?? '');
  const [courseCode, setCourseCode] = useState(editCourse?.course_code ?? '');
  const [semesterLabel, setSemesterLabel] = useState(editCourse?.semester_label ?? getAcademicSemesterLabel());
  const [meetingTarget, setMeetingTarget] = useState<8 | 16>(editCourse?.meeting_target ?? 16);
  const [studentCount, setStudentCount] = useState(String(editCourse?.student_count ?? 0));
  const [firstSessionDate, setFirstSessionDate] = useState('');
  const [defaultDay, setDefaultDay] = useState(String(editCourse?.default_day_of_week ?? 1));
  const [defaultStartTime, setDefaultStartTime] = useState(editCourse?.default_start_time ?? '08:00');
  const [defaultEndTime, setDefaultEndTime] = useState(editCourse?.default_end_time ?? '09:40');
  const [location, setLocation] = useState(editCourse?.location ?? '');
  const [role, setRole] = useState<RoleContext>(editCourse?.contextual_role ?? 'dosen');
  const [status, setStatus] = useState<'active' | 'completed' | 'archived'>(
    editCourse?.status ?? 'active'
  );
  const [notes, setNotes] = useState(editCourse?.notes ?? '');

  const recommendedSemesterLabel = getAcademicSemesterLabel(firstSessionDate || null);

  const handleSave = async () => {
    if (isSaving) return;

    if (!name.trim()) {
      toast.error('Nama kelas wajib diisi');
      return;
    }

    if (!isEdit && !firstSessionDate) {
      toast.error('Tanggal pertemuan pertama wajib diisi');
      return;
    }

    if (!defaultStartTime) {
      toast.error('Jam mulai default wajib diisi');
      return;
    }
    if (defaultEndTime && defaultEndTime <= defaultStartTime) {
      toast.error('Jam selesai default harus setelah jam mulai');
      return;
    }

    setIsSaving(true);
    const ok = await onSave({
      name: name.trim(),
      course_code: courseCode.trim() || null,
      semester_label: semesterLabel.trim() || null,
      meeting_target: meetingTarget,
      student_count: Number(studentCount || 0),
      first_session_date: firstSessionDate,
      default_day_of_week: Number(defaultDay),
      default_start_time: defaultStartTime || null,
      default_end_time: defaultEndTime || null,
      location: location.trim() || null,
      contextual_role: role,
      status,
      notes: notes.trim() || null,
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-md shadow-emerald-500/20">
              {isEdit ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            {isEdit ? 'Edit Kelas' : 'Kelas Baru'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Rapikan metadata kelas dan ritme default pertemuannya.'
              : 'Sekali buat kelas, sistem akan generate 8 atau 16 pertemuan dan langsung menghubungkannya ke kalender.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nama Kelas</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="cth: Pemasaran Digital A" className="h-10 rounded-lg border-border/60 bg-background" />
            </div>
            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kode</label>
            <Input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="MKU-301" className="h-10 rounded-lg border-border/60 bg-background" />
            </div>

            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Semester</label>
            <Input
              value={semesterLabel}
              onChange={(event) => {
                setSemesterTouched(true);
                setSemesterLabel(event.target.value);
              }}
              placeholder="Genap 2025/2026"
              className="h-10 rounded-lg border-border/60 bg-background"
            />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>Saran sistem: {recommendedSemesterLabel}</span>
                {!semesterTouched || semesterLabel !== recommendedSemesterLabel ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSemesterTouched(true);
                      setSemesterLabel(recommendedSemesterLabel);
                    }}
                    className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground transition hover:bg-muted/80"
                  >
                    Pakai saran
                  </button>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jumlah Mahasiswa</label>
            <Input type="number" min="0" value={studentCount} onChange={(event) => setStudentCount(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
            </div>

            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Target Pertemuan</label>
            <select
              value={meetingTarget}
              onChange={(event) => setMeetingTarget(Number(event.target.value) as 8 | 16)}
              disabled={isEdit}
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none disabled:opacity-60"
            >
              <option value={8}>8 Pertemuan</option>
              <option value={16}>16 Pertemuan</option>
            </select>
            </div>
            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Peran</label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as RoleContext)}
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none"
            >
              {Object.entries(ROLES).map(([key, value]) => (
                <option key={key} value={key}>{value.icon} {value.label}</option>
              ))}
            </select>
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pertemuan Pertama</label>
                <Input
                  type="date"
                  value={firstSessionDate}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFirstSessionDate(nextValue);
                    if (!semesterTouched || !semesterLabel.trim() || semesterLabel === recommendedSemesterLabel) {
                      setSemesterLabel(getAcademicSemesterLabel(nextValue || null));
                    }
                  }}
                  className="h-10 rounded-lg border-border/60 bg-background"
                />
              </div>
            )}
            {isEdit && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status Kelas</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as 'active' | 'completed' | 'archived')}
                  className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none"
                >
                  {(Object.keys(CLASS_COURSE_STATUSES) as Array<'active' | 'completed' | 'archived'>).map((value) => (
                    <option key={value} value={value}>{CLASS_COURSE_STATUSES[value].label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hari Default</label>
            <select
              value={defaultDay}
              onChange={(event) => setDefaultDay(event.target.value)}
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none"
            >
              <option value="1">Senin</option>
              <option value="2">Selasa</option>
              <option value="3">Rabu</option>
              <option value="4">Kamis</option>
              <option value="5">Jumat</option>
              <option value="6">Sabtu</option>
              <option value="0">Minggu</option>
            </select>
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jam Mulai Default</label>
              <Input type="time" value={defaultStartTime} onChange={(event) => setDefaultStartTime(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
              </div>
              <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jam Selesai Default</label>
              <Input type="time" value={defaultEndTime} onChange={(event) => setDefaultEndTime(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background" />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lokasi</label>
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ruang 203 / Zoom / Hybrid" className="h-10 rounded-lg border-border/60 bg-background" />
            </div>

            <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Catatan Kelas</label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan singkat tentang ritme kelas, gaya evaluasi, atau hal penting lainnya..." className="min-h-[100px] rounded-lg border-border/60 bg-background resize-none" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/40 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="h-9 gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-[12px] font-semibold text-white shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSaving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Kelas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
