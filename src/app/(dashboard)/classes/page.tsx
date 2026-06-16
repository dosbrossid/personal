'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { CLASS_COURSE_STATUSES, ROLES } from '@/core/constants';
import type { ClassCourseStatus } from '@/core/constants';
import { StatCard } from '@/components/shared/StatCard';
import type { ClassCourse, ClassSession } from '@/core/types';
import { cn } from '@/lib/utils';
import {
  getProgress,
  getSemesterOptions,
  getUpcomingLabel,
} from '@/lib/classes-utils';
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
import { ClassesCourseDialog } from '@/components/modules/classes/ClassesCourseDialog';
import { ClassesSessionDialog } from '@/components/modules/classes/ClassesSessionDialog';
import { ClassesDeleteDialog } from '@/components/modules/classes/ClassesDeleteDialog';
import { ClassesDetailPanel } from '@/components/modules/classes/ClassesDetailPanel';

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
              <h1 className="flex items-center gap-2.5 ts-display text-foreground">
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
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              gradient={`bg-gradient-to-br ${card.gradient}`}
            />
          ))}
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
              <h2 className="ts-title text-foreground">Daftar Kelas</h2>
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
              <ClassesDetailPanel
                course={selectedCourse}
                sessions={sessions}
                sessionsLoading={sessionsLoading}
                completingSessionId={completingSessionId}
                onEditCourse={() => setEditingCourse(selectedCourse)}
                onAddSession={() => setSessionModalState({ open: true, session: null })}
                onDeleteCourse={() => setDeleteCourseTarget(selectedCourse)}
                onMarkSessionCompleted={handleMarkSessionCompleted}
                onEditSession={(session: ClassSession) => setSessionModalState({ open: true, session })}
                onDeleteSession={setDeleteSessionTarget}
              />
            )}
          </div>
        </div>
      </div>

      <ClassesCourseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateCourse}
      />
      {editingCourse && (
        <ClassesCourseDialog
          open={Boolean(editingCourse)}
          onClose={() => setEditingCourse(null)}
          onSave={handleUpdateCourse}
          editCourse={editingCourse}
        />
      )}
      <ClassesSessionDialog
        open={sessionModalState.open}
        onClose={() => setSessionModalState({ open: false, session: null })}
        onSave={sessionModalState.session ? handleUpdateSession : handleCreateSession}
        session={sessionModalState.session}
        nextMeetingNumber={nextMeetingNumber}
      />
      <ClassesDeleteDialog
        open={Boolean(deleteCourseTarget)}
        onClose={() => setDeleteCourseTarget(null)}
        onConfirm={handleDeleteCourse}
        title="Arsipkan Kelas?"
        description={deleteCourseTarget ? `Kelas "${deleteCourseTarget.name}" beserta sesi dan event kalender terkait akan di-soft delete.` : ''}
      />
      <ClassesDeleteDialog
        open={Boolean(deleteSessionTarget)}
        onClose={() => setDeleteSessionTarget(null)}
        onConfirm={handleDeleteSession}
        title="Hapus Pertemuan?"
        description={deleteSessionTarget ? `Pertemuan ${deleteSessionTarget.meeting_number} akan di-soft delete dan event kalendernya ikut disembunyikan.` : ''}
      />
    </>
  );
}
