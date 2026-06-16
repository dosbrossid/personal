'use client';

import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Loader2,
  MoreHorizontal,
  Trash2,
  Users,
} from 'lucide-react';

import { CLASS_SESSION_STATUSES } from '@/core/constants';
import type { ClassSession } from '@/core/types';
import { cn } from '@/lib/utils';
import { formatSessionMoment } from '@/lib/classes-utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ClassesSessionTimelineProps {
  sessions: ClassSession[];
  isLoading: boolean;
  completingSessionId: string | null;
  onMarkCompleted: (session: ClassSession) => void;
  onEditSession: (session: ClassSession) => void;
  onDeleteSession: (session: ClassSession) => void;
}

export function ClassesSessionTimeline({
  sessions,
  isLoading,
  completingSessionId,
  onMarkCompleted,
  onEditSession,
  onDeleteSession,
}: ClassesSessionTimelineProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="ts-title text-foreground">Timeline Pertemuan</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Lihat progres nyata kelas per pertemuan.</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          {sessions.length} sesi
        </span>
      </div>

      <div className="max-h-[68vh] overflow-y-auto p-4">
        {isLoading ? (
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
                          onClick={() => onMarkCompleted(session)}
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
                            onClick={() => onEditSession(session)}
                            className="gap-2 rounded-lg text-[13px] focus:bg-muted"
                          >
                            <Edit3 className="h-4 w-4 text-muted-foreground" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border/40" />
                          <DropdownMenuItem
                            onClick={() => onDeleteSession(session)}
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
  );
}
