'use client';

import { useState } from 'react';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Clock, RotateCw, Filter,
  Trash2, Edit3, AlertTriangle, CheckCircle2, MoreHorizontal, Bell, Repeat, Loader2, ArrowUpRight, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalendarEvents } from '@/hooks/use-calendar';
import { createEvent, updateEvent, deleteEvent as deleteEventAction } from '@/actions/calendar.actions';
import { toast } from 'sonner';
import { ROLES } from '@/core/constants';
import type { RoleContext } from '@/core/constants';
import type { CalendarEvent } from '@/core/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isAfter, isToday, isTomorrow, isBefore } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';



const roleFilters = [
  { key: 'all', label: 'Semua', icon: '⚡' },
  { key: 'dosen', label: 'Dosen', icon: '🎓' },
  { key: 'creator', label: 'Kreator', icon: '🎨' },
  { key: 'affiliate', label: 'Afiliator', icon: '📱' },
  { key: 'consultant', label: 'Konsultan', icon: '💼' },
  { key: 'general', label: 'Umum', icon: '⭐' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'Tanpa reminder' },
  { value: 15, label: '15 menit sebelumnya' },
  { value: 30, label: '30 menit sebelumnya' },
  { value: 60, label: '1 jam sebelumnya' },
  { value: 1440, label: '1 hari sebelumnya' },
];

function sortEventsByStart(events: CalendarEvent[]) {
  return [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
}

function getDefaultDateTimeInput(defaultDate?: Date | null) {
  const baseDate = defaultDate ? new Date(defaultDate) : new Date();
  baseDate.setHours(9, 0, 0, 0);
  return format(baseDate, "yyyy-MM-dd'T'HH:mm");
}

function getUpcomingLabel(date: Date) {
  if (isToday(date)) return 'Hari ini';
  if (isTomorrow(date)) return 'Besok';
  return format(date, 'EEE, dd MMM', { locale: idLocale });
}

export default function CalendarPage() {
  const { events, isLoading, mutate } = useCalendarEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRole, setSelectedRole] = useState<RoleContext | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeleteEvent] = useState<CalendarEvent | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const filteredEvents = events.filter((e) => {
    if (selectedRole !== 'all' && e.contextual_role !== selectedRole) return false;
    return true;
  });
  const sortedFilteredEvents = sortEventsByStart(filteredEvents);

  const todayEvents = events.filter(e => isSameDay(new Date(e.start_at), new Date()));
  const upcomingEvents = events.filter(e => isAfter(new Date(e.start_at), new Date()));
  const recurringCount = events.filter(e => e.recurrence !== 'none').length;

  const handleCreate = async (data: Partial<CalendarEvent>) => {
    const result = await createEvent({
      title: data.title!,
      description: data.description || undefined,
      start_at: data.start_at!,
      end_at: data.end_at || undefined,
      is_all_day: data.is_all_day ?? false,
      reminder_minutes: data.reminder_minutes ?? null,
      contextual_role: data.contextual_role || 'general',
      recurrence: data.recurrence || 'none',
    });
    if (result.error) {
      toast.error(result.error);
      return false;
    } else {
      toast.success(`"${data.title}" ditambahkan`);
      mutate();
      return true;
    }
  };

  const handleEdit = async (data: Partial<CalendarEvent>) => {
    if (!editingEvent) return;
    const result = await updateEvent(editingEvent.id, {
      title: data.title,
      description: data.description,
      start_at: data.start_at,
      end_at: data.end_at,
      is_all_day: data.is_all_day,
      reminder_minutes: data.reminder_minutes ?? null,
      contextual_role: data.contextual_role,
      recurrence: data.recurrence,
    });
    if (result.error) {
      toast.error(result.error);
      return false;
    } else {
      toast.success(`"${data.title}" diperbarui`);
      mutate();
      setEditEvent(null);
      return true;
    }
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;
    const result = await deleteEventAction(deletingEvent.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${deletingEvent.title}" dihapus`);
      mutate();
    }
    setDeleteEvent(null);
  };

  const statCards = [
    { label: 'Total Event', value: events.length, icon: CalendarDays, gradient: 'gradient-emerald', glow: 'shadow-emerald-500/20' },
    { label: 'Hari Ini', value: todayEvents.length, icon: Clock, gradient: 'gradient-blue', glow: 'shadow-blue-500/20' },
    { label: 'Mendatang', value: upcomingEvents.length, icon: Bell, gradient: 'gradient-violet', glow: 'shadow-violet-500/20' },
    { label: 'Recurring', value: recurringCount, icon: Repeat, gradient: 'gradient-amber', glow: 'shadow-amber-500/20' },
  ];

  // Events for selected date
  const selectedDateEvents = selectedDate
    ? sortEventsByStart(sortedFilteredEvents.filter((e) => isSameDay(new Date(e.start_at), selectedDate)))
    : [];
  const upcomingTimeline = sortedFilteredEvents
    .filter((event) => {
      const eventStart = new Date(event.start_at);
      const eventEnd = event.end_at ? new Date(event.end_at) : eventStart;
      return !isBefore(eventEnd, new Date());
    })
    .slice(0, 5);

  function getEventsForDay(d: Date) {
    return sortEventsByStart(filteredEvents.filter((e) => isSameDay(new Date(e.start_at), d)));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat kalender...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20">
              <CalendarDays className="h-5 w-5" />
            </div>
            Kalender
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">Event dan jadwal terjadwal dengan reminder</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 text-background text-[13px] font-medium hover:opacity-90 transition-all duration-200 shadow-lg shadow-foreground/10 active:scale-[0.97]">
          <Plus className="h-4 w-4" /> Event Baru
        </button>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.gradient} rounded-2xl p-4 text-white shadow-lg ${card.glow} cursor-default relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200`}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-white/70">{card.label}</p>
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
              </div>
              <p className="text-[26px] font-bold leading-none">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* ─── Filters ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground mr-2">
          <Filter className="h-4 w-4" />
          <span className="text-[13px]">Filter:</span>
        </div>
        {roleFilters.map((role) => (
          <button
            key={role.key}
            onClick={() => setSelectedRole(role.key as RoleContext | 'all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all',
              selectedRole === role.key
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <span>{role.icon}</span>
            <span>{role.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        {/* Calendar Grid */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          {/* Month Navigation */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="text-center">
              <h2 className="text-[18px] font-bold text-foreground">
                {format(currentDate, 'MMMM yyyy', { locale: idLocale })}
              </h2>
              <p className="text-[11px] text-muted-foreground">Klik tanggal untuk detail agenda</p>
            </div>
            <button
              onClick={() => {
                const now = new Date();
                setCurrentDate(now);
                setSelectedDate(now);
              }}
              className="rounded-xl border border-border/60 bg-background px-3 py-2 text-[12px] font-medium text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
            >
              Hari ini
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
              <div key={d} className="py-3 text-center text-[12px] uppercase tracking-wider text-muted-foreground font-semibold">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const isCurrentMonth = isSameMonth(d, currentDate);
              const isToday = isSameDay(d, new Date());
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const dayEvents = getEventsForDay(d);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    'relative min-h-[100px] border-b border-r border-border/40 p-2 text-left transition-all hover:bg-muted/50',
                    !isCurrentMonth && 'opacity-30',
                    isSelected && 'bg-primary/10 ring-1 ring-inset ring-primary/30',
                    isToday && !isSelected && 'bg-emerald-500/5 dark:bg-emerald-500/10'
                  )}
                >
                  <span className={cn(
                    'text-[14px] font-semibold',
                    isToday
                      ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground'
                      : 'text-foreground',
                    isSelected && !isToday && 'text-primary'
                  )}>
                    {format(d, 'd')}
                  </span>

                  {dayEvents.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className="truncate rounded-md px-1.5 py-1 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${ROLES[ev.contextual_role].color}15`,
                            color: ROLES[ev.contextual_role].color,
                          }}
                        >
                          {format(new Date(ev.start_at), 'HH:mm')} {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2} lagi</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail */}
        <div className="space-y-4">
          <div className="h-fit overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-4">
              <h3 className="text-[16px] font-semibold text-foreground">
                {selectedDate ? format(selectedDate, 'EEEE, dd MMMM', { locale: idLocale }) : 'Pilih tanggal'}
              </h3>
              {selectedDate && (
                <span className="rounded-lg bg-muted px-2 py-1 text-[12px] text-muted-foreground">{selectedDateEvents.length} event</span>
              )}
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <CalendarDays className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="mb-1 text-[14px] font-medium text-foreground">Tidak ada event di tanggal ini</p>
                <p className="mb-4 text-[12px] text-muted-foreground">Pilih tanggal lain atau buat agenda baru langsung dari sini.</p>
                <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20">
                  <Plus className="h-3 w-3" /> Buat Event
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {selectedDateEvents.map((event) => (
                  <div key={event.id} className="group px-5 py-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between">
                      <p className="text-[15px] font-medium text-foreground">{event.title}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="shrink-0 rounded-lg p-1.5 opacity-0 transition-all duration-200 hover:bg-muted group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/60 bg-card shadow-xl">
                          <DropdownMenuItem onClick={() => setEditEvent(event)} className="gap-2 rounded-lg text-[13px] focus:bg-muted">
                            <Edit3 className="h-4 w-4 text-muted-foreground" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border/40" />
                          <DropdownMenuItem onClick={() => setDeleteEvent(event)} className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500">
                            <Trash2 className="h-4 w-4" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {event.description && (
                      <p className="mt-1 text-[13px] text-muted-foreground">{event.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 text-[12px] text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {event.is_all_day
                          ? 'Seharian'
                          : `${format(new Date(event.start_at), 'HH:mm')}${event.end_at ? ` - ${format(new Date(event.end_at), 'HH:mm')}` : ''}`}
                      </span>
                      {typeof event.reminder_minutes === 'number' && event.reminder_minutes > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <Bell className="h-3 w-3" /> {event.reminder_minutes} menit
                        </span>
                      )}
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLES[event.contextual_role].bgClass)}>
                        {ROLES[event.contextual_role].icon} {ROLES[event.contextual_role].label}
                      </span>
                      {event.recurrence !== 'none' && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <RotateCw className="h-3 w-3" /> {event.recurrence}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-4">
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">Agenda Terdekat</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Biar fokusmu tidak cuma berhenti di hari ini</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {upcomingTimeline.length} upcoming
              </span>
            </div>
            {upcomingTimeline.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <CalendarClock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-medium text-foreground">Belum ada agenda mendatang</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Kalendermu masih kosong setelah waktu sekarang.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {upcomingTimeline.map((event) => {
                  const startAt = new Date(event.start_at);
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedDate(startAt);
                        setCurrentDate(startAt);
                      }}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-[68px] rounded-xl bg-muted/40 px-2 py-2 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{getUpcomingLabel(startAt)}</p>
                        <p className="mt-1 text-[14px] font-bold text-foreground">{event.is_all_day ? 'All day' : format(startAt, 'HH:mm')}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-foreground">{event.title}</p>
                            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                              {event.description || 'Tidak ada deskripsi tambahan.'}
                            </p>
                          </div>
                          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLES[event.contextual_role].bgClass)}>
                            {ROLES[event.contextual_role].icon} {ROLES[event.contextual_role].label}
                          </span>
                          {typeof event.reminder_minutes === 'number' && event.reminder_minutes > 0 && (
                            <span className="text-[11px] text-muted-foreground">Reminder {event.reminder_minutes} menit</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Modals */}
    {createOpen && <EventEditorModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} defaultDate={selectedDate} />}
    {editingEvent && <EventEditorModal key={editingEvent.id} open={!!editingEvent} onClose={() => setEditEvent(null)} onSave={handleEdit} editEvent={editingEvent} />}
    {deletingEvent && (
      <Dialog open={!!deletingEvent} onOpenChange={() => setDeleteEvent(null)}>
        <DialogContent className="sm:max-w-md border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-[16px]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500"><AlertTriangle className="h-4.5 w-4.5" /></div>
              Hapus Event?
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground pt-2">
              Apakah yakin menghapus <span className="font-semibold text-foreground">&ldquo;{deletingEvent.title}&rdquo;</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteEvent(null)} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
            <Button onClick={handleDelete} className="h-9 gap-2 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 shadow-md shadow-red-500/25 transition-all">
              <Trash2 className="h-3.5 w-3.5" /> Ya, Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

// ─── Event Editor Modal ───
function EventEditorModal({ open, onClose, onSave, editEvent: ev, defaultDate }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CalendarEvent>) => Promise<boolean | void>;
  editEvent?: CalendarEvent | null;
  defaultDate?: Date | null;
}) {
  const isEdit = !!ev;
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(ev?.title || '');
  const [desc, setDesc] = useState(ev?.description || '');
  const [startAt, setStartAt] = useState(ev ? format(new Date(ev.start_at), "yyyy-MM-dd'T'HH:mm") : getDefaultDateTimeInput(defaultDate));
  const [endAt, setEndAt] = useState(ev?.end_at ? format(new Date(ev.end_at), "yyyy-MM-dd'T'HH:mm") : '');
  const [role, setRole] = useState<RoleContext>(ev?.contextual_role || 'general');
  const [recurrence, setRecurrence] = useState(ev?.recurrence || 'none');
  const [isAllDay, setIsAllDay] = useState(ev?.is_all_day || false);
  const [reminderMinutes, setReminderMinutes] = useState(ev?.reminder_minutes ?? 0);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Judul event wajib diisi');
      return;
    }

    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      toast.error('Waktu selesai tidak boleh lebih awal dari waktu mulai');
      return;
    }

    setIsSaving(true);
    const result = await onSave({
      title,
      description: desc || null,
      start_at: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      contextual_role: role,
      recurrence: recurrence as CalendarEvent['recurrence'],
      is_all_day: isAllDay,
      reminder_minutes: reminderMinutes || null,
    });
    setIsSaving(false);

    if (result !== false) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-[18px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-md shadow-emerald-500/20">
              {isEdit ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            {isEdit ? 'Edit Event' : 'Event Baru'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Judul</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul event..." className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Deskripsi</label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Deskripsi opsional..." className="min-h-[70px] rounded-lg border-border/60 bg-background text-[13px] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mulai</label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="h-9 rounded-lg border-border/60 bg-background text-[12px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Selesai</label>
              <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className="h-9 rounded-lg border-border/60 bg-background text-[12px]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Peran</label>
              <select value={role} onChange={e => setRole(e.target.value as RoleContext)} className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30">
                {Object.entries(ROLES).map(([key, val]) => (<option key={key} value={key}>{val.icon} {val.label}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pengulangan</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value as CalendarEvent['recurrence'])} className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30">
                <option value="none">Tidak Berulang</option>
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reminder</label>
            <select
              value={reminderMinutes}
              onChange={e => setReminderMinutes(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button onClick={() => setIsAllDay(!isAllDay)} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200', isAllDay ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
            <CalendarDays className="h-3.5 w-3.5" /> {isAllDay ? 'Seharian (All Day)' : 'Tandai sebagai all day'}
          </button>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSaving} className="h-9 gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[12px] font-semibold shadow-md shadow-emerald-500/25 hover:opacity-90 transition-all disabled:opacity-40">
              <CheckCircle2 className="h-3.5 w-3.5" /> {isSaving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Event'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
