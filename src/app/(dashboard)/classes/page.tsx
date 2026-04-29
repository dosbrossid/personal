'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';

import {
  CLASS_COURSE_STATUSES,
  CLASS_SESSION_STATUSES,
  ROLES,
  SEMESTERS,
} from '@/core/constants';
import type { ClassCourseStatus, RoleContext } from '@/core/constants';
import type { ClassCourse, ClassSession } from '@/core/types';
import { cn } from '@/lib/utils';
import { useClass, useClasses, useClassSessions } from '@/hooks/use-classes';
import {
  createClassCourse,
  createClassSession,
  deleteClassCourse,
  deleteClassSession,
  markClassSessionCompleted,
  updateClassCourse,
  updateClassSession,
} from '@/actions/classes.actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toIsoString(value?: string | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatSessionMoment(session: ClassSession) {
  const start = new Date(session.start_at);
  return `${format(start, 'EEE, dd MMM yyyy', { locale: idLocale })} • ${format(start, 'HH:mm')}`;
}

function getUpcomingLabel(dateValue: string) {
  const date = new Date(dateValue);
  if (isToday(date)) return 'Hari ini';
  if (isTomorrow(date)) return 'Besok';
  return format(date, 'EEE, dd MMM', { locale: idLocale });
}

function getProgress(course: ClassCourse) {
  if (!course.meeting_target) return 0;
  return Math.min(100, Math.round((course.completed_meeting_count / course.meeting_target) * 100));
}

function getSemesterOptions(classes: ClassCourse[]) {
  const dynamicValues = classes
    .map((course) => course.semester_label)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...SEMESTERS, ...dynamicValues]));
}

function getAcademicSemesterLabel(dateValue?: string | null) {
  const baseDate = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();

  if (month === 0) {
    return `Ganjil ${year - 1}/${year}`;
  }

  if (month >= 1 && month <= 6) {
    return `Genap ${year - 1}/${year}`;
  }

  return `Ganjil ${year}/${year + 1}`;
}

function ClassCourseModal({
  open,
  onClose,
  onSave,
  editCourse,
}: {
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
}) {
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
          <DialogTitle className="flex items-center gap-2.5 text-[18px]">
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

function SessionModal({
  open,
  onClose,
  onSave,
  session,
  nextMeetingNumber,
}: {
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
}) {
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
          <DialogTitle className="flex items-center gap-2.5 text-[18px]">
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

function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
}) {
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
          <DialogTitle className="flex items-center gap-2.5 text-[16px]">
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

export default function ClassesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClassCourseStatus>('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<ClassCourse | null>(null);
  const [deleteCourseTarget, setDeleteCourseTarget] = useState<ClassCourse | null>(null);
  const [sessionModalState, setSessionModalState] = useState<{ open: boolean; session: ClassSession | null }>({
    open: false,
    session: null,
  });
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<ClassSession | null>(null);
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);

  const { classes, isLoading, mutate: mutateClasses } = useClasses({
    status: statusFilter === 'all' ? undefined : statusFilter,
    semester: semesterFilter === 'all' ? undefined : semesterFilter,
    query: searchQuery.trim() || undefined,
  });
  const resolvedSelectedClassId =
    selectedClassId && classes.some((course) => course.id === selectedClassId)
      ? selectedClassId
      : classes[0]?.id ?? null;
  const { classCourse, mutate: mutateClass } = useClass(resolvedSelectedClassId);
  const { sessions, isLoading: sessionsLoading, mutate: mutateSessions } = useClassSessions(resolvedSelectedClassId);

  const selectedCourse = classCourse ?? classes.find((course) => course.id === resolvedSelectedClassId) ?? null;
  const semesterOptions = getSemesterOptions(classes);
  const completedClasses = classes.filter((course) => course.status === 'completed').length;
  const activeClasses = classes.filter((course) => course.status === 'active').length;
  const totalStudents = classes.reduce((sum, course) => sum + course.student_count, 0);
  const totalAssignments = classes.reduce((sum, course) => sum + course.assignment_count, 0);
  const nextMeetingNumber = sessions.length > 0
    ? Math.max(...sessions.map((session) => session.meeting_number)) + 1
    : 1;

  const handleRefreshAll = async () => {
    await Promise.all([mutateClasses(), mutateClass(), mutateSessions()]);
  };

  const handleCreateCourse = async (payload: {
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
  }) => {
    const result = await createClassCourse({
      name: payload.name,
      course_code: payload.course_code,
      semester_label: payload.semester_label,
      meeting_target: payload.meeting_target ?? 16,
      student_count: payload.student_count,
      first_session_date: payload.first_session_date || '',
      default_day_of_week: payload.default_day_of_week,
      default_start_time: payload.default_start_time || '',
      default_end_time: payload.default_end_time,
      location: payload.location,
      contextual_role: payload.contextual_role,
      notes: payload.notes,
    });

    if (result.error) {
      toast.error(result.error);
      return false;
    }

    toast.success(`Kelas "${payload.name}" berhasil dibuat`);
    await mutateClasses();
    if (result.data?.id) {
      setSelectedClassId(result.data.id);
    }
    return true;
  };

  const handleUpdateCourse = async (payload: {
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
  }) => {
    if (!editingCourse) return false;

    const result = await updateClassCourse(editingCourse.id, {
      name: payload.name,
      course_code: payload.course_code ?? null,
      semester_label: payload.semester_label ?? null,
      student_count: payload.student_count ?? 0,
      default_day_of_week: payload.default_day_of_week ?? null,
      default_start_time: payload.default_start_time ?? null,
      default_end_time: payload.default_end_time ?? null,
      location: payload.location ?? null,
      contextual_role: payload.contextual_role,
      status: payload.status,
      notes: payload.notes ?? null,
    });

    if (result.error) {
      toast.error(result.error);
      return false;
    }

    toast.success(`Kelas "${payload.name}" diperbarui`);
    await Promise.all([mutateClasses(), mutateClass()]);
    setEditingCourse(null);
    return true;
  };

  const handleDeleteCourse = async () => {
    if (!deleteCourseTarget) return;

    const result = await deleteClassCourse(deleteCourseTarget.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Kelas "${deleteCourseTarget.name}" diarsipkan`);
    setDeleteCourseTarget(null);
    await Promise.all([mutateClasses(), mutateClass(), mutateSessions()]);
  };

  const handleCreateSession = async (payload: {
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
  }) => {
    if (!selectedCourse) return false;

    const result = await createClassSession({
      class_course_id: selectedCourse.id,
      ...payload,
    });

    if (result.error) {
      toast.error(result.error);
      return false;
    }

    toast.success(`Pertemuan ${payload.meeting_number} ditambahkan`);
    await handleRefreshAll();
    setSessionModalState({ open: false, session: null });
    return true;
  };

  const handleUpdateSession = async (payload: {
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
  }) => {
    if (!sessionModalState.session) return false;

    const result = await updateClassSession(sessionModalState.session.id, payload);
    if (result.error) {
      toast.error(result.error);
      return false;
    }

    toast.success(`Pertemuan ${payload.meeting_number} diperbarui`);
    await handleRefreshAll();
    setSessionModalState({ open: false, session: null });
    return true;
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionTarget) return;

    const result = await deleteClassSession(deleteSessionTarget.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Pertemuan ${deleteSessionTarget.meeting_number} dihapus`);
    setDeleteSessionTarget(null);
    await handleRefreshAll();
  };

  const handleMarkSessionCompleted = async (session: ClassSession) => {
    if (completingSessionId) return;

    setCompletingSessionId(session.id);
    try {
      const result = await markClassSessionCompleted(session.id, {
        attendance_count: session.attendance_count,
        assignment_given: session.assignment_given,
        assignment_title: session.assignment_title,
        assignment_due_at: session.assignment_due_at,
        reflection_note: session.reflection_note,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pertemuan ${session.meeting_number} ditandai selesai`);
      await handleRefreshAll();
    } finally {
      setCompletingSessionId(null);
    }
  };

  const statCards = [
    {
      label: 'Kelas Aktif',
      value: activeClasses,
      icon: BookOpenCheck,
      gradient: 'from-emerald-500 to-cyan-500',
    },
    {
      label: 'Kelas Selesai',
      value: completedClasses,
      icon: CheckCircle2,
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      label: 'Mahasiswa Dipantau',
      value: totalStudents,
      icon: Users,
      gradient: 'from-violet-500 to-fuchsia-500',
    },
    {
      label: 'Tugas Diberikan',
      value: totalAssignments,
      icon: FileText,
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-[28px] font-bold tracking-tight text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              Class Management
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Manajemen kelas yang cukup ringan buat dosen: progres pertemuan, tugas, mahasiswa, dan ritme kalender.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/calendar"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-10 rounded-xl border-border/60 text-[12px] font-medium'
              )}
            >
              Buka Kalender <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-10 gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-5 text-[12px] font-semibold text-background shadow-lg shadow-foreground/10"
            >
              <Plus className="h-4 w-4" />
              Kelas Baru
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={cn(
                  'rounded-2xl p-4 text-white shadow-lg',
                  `bg-gradient-to-br ${card.gradient}`
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-white/70">{card.label}</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[26px] font-bold leading-none">{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari nama kelas atau semester..."
                className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ClassCourseStatus)}
                className="h-10 rounded-xl border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none"
              >
                <option value="all">Semua status</option>
                {(Object.keys(CLASS_COURSE_STATUSES) as ClassCourseStatus[]).map((status) => (
                  <option key={status} value={status}>{CLASS_COURSE_STATUSES[status].label}</option>
                ))}
              </select>

              <select
                value={semesterFilter}
                onChange={(event) => setSemesterFilter(event.target.value)}
                className="h-10 rounded-xl border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none"
              >
                <option value="all">Semua semester</option>
                {semesterOptions.map((semester) => (
                  <option key={semester} value={semester}>{semester}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-[16px] font-semibold text-foreground">Daftar Kelas</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {classes.length} kelas ditemukan
              </p>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : classes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <BookOpenCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground">Belum ada kelas</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Buat kelas pertama supaya ritme mengajarmu bisa mulai dipantau.
                  </p>
                  <Button
                    onClick={() => setCreateOpen(true)}
                    size="sm"
                    className="mt-4 gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20"
                  >
                    <Plus className="h-3 w-3" />
                    Buat Kelas
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {classes.map((course) => {
                    const progress = getProgress(course);
                    const statusMeta = CLASS_COURSE_STATUSES[course.status];
                    const role = ROLES[course.contextual_role];

                    return (
                      <button
                        key={course.id}
                        onClick={() => setSelectedClassId(course.id)}
                        className={cn(
                          'w-full rounded-2xl border p-4 text-left transition-all',
                          course.id === resolvedSelectedClassId
                            ? 'border-primary/30 bg-primary/5 shadow-md shadow-primary/10'
                            : 'border-border/60 bg-card hover:bg-muted/30'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-foreground">{course.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {course.course_code && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {course.course_code}
                                </span>
                              )}
                              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${statusMeta.color}18`, color: statusMeta.color }}>
                                {statusMeta.label}
                              </span>
                              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', role.bgClass)}>
                                {role.icon} {role.label}
                              </span>
                            </div>
                          </div>
                          <span className="text-[12px] font-semibold text-foreground">{progress}%</span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div className="rounded-xl bg-muted/35 px-3 py-2">
                            <p>Pertemuan</p>
                            <p className="mt-0.5 font-semibold text-foreground">
                              {course.completed_meeting_count}/{course.meeting_target}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted/35 px-3 py-2">
                            <p>Tugas</p>
                            <p className="mt-0.5 font-semibold text-foreground">{course.assignment_count} kali</p>
                          </div>
                        </div>

                        {course.next_session && (
                          <div className="mt-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pertemuan berikutnya</p>
                            <p className="mt-1 text-[12px] font-medium text-foreground">
                              {getUpcomingLabel(course.next_session.start_at)} • {format(new Date(course.next_session.start_at), 'HH:mm')}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {!selectedCourse ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <CalendarClock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-[15px] font-semibold text-foreground">Pilih kelas dulu</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Di panel kanan ini nanti kamu bisa lihat progres, pertemuan, tugas, dan catatan kelas.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[22px] font-bold tracking-tight text-foreground">{selectedCourse.name}</h2>
                        {selectedCourse.course_code && (
                          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                            {selectedCourse.course_code}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                        {selectedCourse.semester_label && <span>{selectedCourse.semester_label}</span>}
                        {selectedCourse.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {selectedCourse.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {selectedCourse.student_count} mahasiswa
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditingCourse(selectedCourse)}
                        className="h-9 gap-2 rounded-lg border-border/60 text-[12px]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => setSessionModalState({ open: true, session: null })}
                        className="h-9 gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-[12px] font-semibold text-white shadow-md shadow-emerald-500/20"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Pertemuan
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-9 w-9 rounded-lg border-border/60 p-0')}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/60 bg-card shadow-xl">
                          <DropdownMenuItem
                            onClick={() => setDeleteCourseTarget(selectedCourse)}
                            className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                            Arsipkan kelas
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</p>
                      <p className="mt-1 text-[22px] font-bold text-foreground">{selectedCourse.completed_meeting_count}/{selectedCourse.meeting_target}</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                          style={{ width: `${getProgress(selectedCourse)}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mahasiswa</p>
                      <p className="mt-1 text-[22px] font-bold text-foreground">{selectedCourse.student_count}</p>
                      <p className="mt-2 text-[12px] text-muted-foreground">Terpantau untuk kelas ini</p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tugas</p>
                      <p className="mt-1 text-[22px] font-bold text-foreground">{selectedCourse.assignment_count}</p>
                      <p className="mt-2 text-[12px] text-muted-foreground">Pertemuan yang memberi tugas</p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="mt-1 text-[18px] font-bold text-foreground">{CLASS_COURSE_STATUSES[selectedCourse.status].label}</p>
                      {selectedCourse.next_session ? (
                        <p className="mt-2 text-[12px] text-muted-foreground">
                          Next: {getUpcomingLabel(selectedCourse.next_session.start_at)} • {format(new Date(selectedCourse.next_session.start_at), 'HH:mm')}
                        </p>
                      ) : (
                        <p className="mt-2 text-[12px] text-muted-foreground">Belum ada sesi mendatang</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
                  <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                      <div>
                        <h3 className="text-[16px] font-semibold text-foreground">Timeline Pertemuan</h3>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">Lihat progres nyata kelas per pertemuan.</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        {sessions.length} sesi
                      </span>
                    </div>

                    <div className="max-h-[68vh] overflow-y-auto p-4">
                      {sessionsLoading ? (
                        <div className="flex h-40 items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                            <CalendarDays className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-[13px] font-medium text-foreground">Belum ada sesi tambahan</p>
                          <p className="mt-1 text-[12px] text-muted-foreground">Kalau kamu hapus semua sesi default atau butuh sesi ekstra, tambahkan dari sini.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sessions.map((session) => {
                            const statusMeta = CLASS_SESSION_STATUSES[session.status];

                            return (
                              <div key={session.id} className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-[15px] font-semibold text-foreground">
                                        Pertemuan {session.meeting_number}
                                      </p>
                                      <span
                                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                        style={{ backgroundColor: `${statusMeta.color}18`, color: statusMeta.color }}
                                      >
                                        {statusMeta.label}
                                      </span>
                                      {session.assignment_given && (
                                        <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                          Ada tugas
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-[13px] font-medium text-foreground">
                                      {session.title}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                                      <span className="flex items-center gap-1.5">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {formatSessionMoment(session)}
                                      </span>
                                      <span className="flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        Hadir {session.attendance_count}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {session.status !== 'completed' && (
                                      <Button
                                        variant="outline"
                                        onClick={() => handleMarkSessionCompleted(session)}
                                        disabled={completingSessionId === session.id}
                                        className="h-8 gap-1.5 rounded-lg border-border/60 text-[11px]"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {completingSessionId === session.id ? 'Menyimpan...' : 'Selesai'}
                                      </Button>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-8 w-8 rounded-lg border-border/60 p-0')}>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/60 bg-card shadow-xl">
                                        <DropdownMenuItem
                                          onClick={() => setSessionModalState({ open: true, session })}
                                          className="gap-2 rounded-lg text-[13px] focus:bg-muted"
                                        >
                                          <Edit3 className="h-4 w-4 text-muted-foreground" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-border/40" />
                                        <DropdownMenuItem
                                          onClick={() => setDeleteSessionTarget(session)}
                                          className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Hapus
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>

                                {session.description && (
                                  <p className="mt-3 rounded-xl bg-muted/30 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
                                    {session.description}
                                  </p>
                                )}

                                {(session.assignment_title || session.reflection_note) && (
                                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    {session.assignment_title && (
                                      <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tugas</p>
                                        <p className="mt-1 text-[13px] font-medium text-foreground">{session.assignment_title}</p>
                                        {session.assignment_due_at && (
                                          <p className="mt-1 text-[12px] text-muted-foreground">
                                            Deadline {format(new Date(session.assignment_due_at), 'dd MMM yyyy • HH:mm', { locale: idLocale })}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {session.reflection_note && (
                                      <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Refleksi</p>
                                        <p className="mt-1 text-[13px] leading-relaxed text-foreground">{session.reflection_note}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                      <h3 className="text-[16px] font-semibold text-foreground">Catatan Kelas</h3>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Tempat menyimpan konteks singkat kelas ini tanpa ribet seperti LMS.
                      </p>
                      <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                          {selectedCourse.notes || 'Belum ada catatan kelas. Kamu bisa isi hal seperti ritme evaluasi, gaya kelas, atau pengingat administratif.'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                      <h3 className="text-[16px] font-semibold text-foreground">Agenda Berikutnya</h3>
                      {selectedCourse.next_session ? (
                        <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                            {getUpcomingLabel(selectedCourse.next_session.start_at)}
                          </p>
                          <p className="mt-1 text-[16px] font-semibold text-foreground">
                            Pertemuan {selectedCourse.next_session.meeting_number}
                          </p>
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            {selectedCourse.next_session.title}
                          </p>
                          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatSessionMoment(selectedCourse.next_session)}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-4 text-[13px] text-muted-foreground">
                          Belum ada sesi mendatang untuk kelas ini.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ClassCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateCourse}
      />
      {editingCourse && (
        <ClassCourseModal
          open={Boolean(editingCourse)}
          onClose={() => setEditingCourse(null)}
          onSave={handleUpdateCourse}
          editCourse={editingCourse}
        />
      )}
      <SessionModal
        open={sessionModalState.open}
        onClose={() => setSessionModalState({ open: false, session: null })}
        onSave={sessionModalState.session ? handleUpdateSession : handleCreateSession}
        session={sessionModalState.session}
        nextMeetingNumber={nextMeetingNumber}
      />
      <ConfirmDeleteModal
        open={Boolean(deleteCourseTarget)}
        onClose={() => setDeleteCourseTarget(null)}
        onConfirm={handleDeleteCourse}
        title="Arsipkan Kelas?"
        description={deleteCourseTarget ? `Kelas "${deleteCourseTarget.name}" beserta sesi dan event kalender terkait akan di-soft delete.` : ''}
      />
      <ConfirmDeleteModal
        open={Boolean(deleteSessionTarget)}
        onClose={() => setDeleteSessionTarget(null)}
        onConfirm={handleDeleteSession}
        title="Hapus Pertemuan?"
        description={deleteSessionTarget ? `Pertemuan ${deleteSessionTarget.meeting_number} akan di-soft delete dan event kalendernya ikut disembunyikan.` : ''}
      />
    </>
  );
}
