'use client';

import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  ArrowUpRight,
  Clock3,
  Edit3,
  MapPin,
  MoreHorizontal,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

import { CLASS_COURSE_STATUSES, CLASS_SESSION_STATUSES, ROLES } from '@/core/constants';
import type { ClassCourse, ClassSession } from '@/core/types';
import { cn } from '@/lib/utils';
import { getProgress, getUpcomingLabel, formatSessionMoment } from '@/lib/classes-utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ClassesSessionTimeline } from '@/components/modules/classes/ClassesSessionTimeline';

interface ClassesDetailPanelProps {
  course: ClassCourse;
  sessions: ClassSession[];
  sessionsLoading: boolean;
  completingSessionId: string | null;
  onEditCourse: () => void;
  onAddSession: () => void;
  onDeleteCourse: () => void;
  onMarkSessionCompleted: (session: ClassSession) => void;
  onEditSession: (session: ClassSession) => void;
  onDeleteSession: (session: ClassSession) => void;
}

export function ClassesDetailPanel({
  course,
  sessions,
  sessionsLoading,
  completingSessionId,
  onEditCourse,
  onAddSession,
  onDeleteCourse,
  onMarkSessionCompleted,
  onEditSession,
  onDeleteSession,
}: ClassesDetailPanelProps) {
  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ts-h2 text-foreground">{course.name}</h2>
              {course.course_code && (
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {course.course_code}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              {course.semester_label && <span>{course.semester_label}</span>}
              {course.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {course.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {course.student_count} mahasiswa
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={onEditCourse}
              className="h-9 gap-2 rounded-lg border-border/60 text-[12px]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              onClick={onAddSession}
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
                  onClick={onDeleteCourse}
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
            <p className="mt-1 ts-h2 text-foreground">{course.completed_meeting_count}/{course.meeting_target}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                style={{ width: `${getProgress(course)}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl bg-muted/35 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mahasiswa</p>
            <p className="mt-1 ts-h2 text-foreground">{course.student_count}</p>
            <p className="mt-2 text-[12px] text-muted-foreground">Terpantau untuk kelas ini</p>
          </div>
          <div className="rounded-2xl bg-muted/35 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tugas</p>
            <p className="mt-1 ts-h2 text-foreground">{course.assignment_count}</p>
            <p className="mt-2 text-[12px] text-muted-foreground">Pertemuan yang memberi tugas</p>
          </div>
          <div className="rounded-2xl bg-muted/35 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 ts-title text-foreground">{CLASS_COURSE_STATUSES[course.status].label}</p>
            {course.next_session ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Next: {getUpcomingLabel(course.next_session.start_at)} • {format(new Date(course.next_session.start_at), 'HH:mm')}
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-muted-foreground">Belum ada sesi mendatang</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
        <ClassesSessionTimeline
          sessions={sessions}
          isLoading={sessionsLoading}
          completingSessionId={completingSessionId}
          onMarkCompleted={onMarkSessionCompleted}
          onEditSession={onEditSession}
          onDeleteSession={onDeleteSession}
        />

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="ts-title text-foreground">Catatan Kelas</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Tempat menyimpan konteks singkat kelas ini tanpa ribet seperti LMS.
            </p>
            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                {course.notes || 'Belum ada catatan kelas. Kamu bisa isi hal seperti ritme evaluasi, gaya kelas, atau pengingat administratif.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="ts-title text-foreground">Agenda Berikutnya</h3>
            {course.next_session ? (
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {getUpcomingLabel(course.next_session.start_at)}
                </p>
                <p className="mt-1 ts-title text-foreground">
                  Pertemuan {course.next_session.meeting_number}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {course.next_session.title}
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatSessionMoment(course.next_session)}
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
  );
}
