'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CheckSquare, Plus, Circle, CircleDot, CircleCheck, Search, Filter,
  MoreHorizontal, Trash2, Edit3, AlertTriangle, CheckCircle2,
  ArrowRight, Calendar, Flame, Clock, TrendingUp, Loader2, GripVertical, Archive, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks';
import { createTask, updateTask, deleteTask as deleteTaskAction } from '@/actions/tasks.actions';
import { toast } from 'sonner';
import { TASK_STATUSES, PRIORITIES, ROLES } from '@/core/constants';
import type { RoleContext, TaskStatus, Priority } from '@/core/constants';
import type { Task } from '@/core/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ───
// Toast is now handled by Sonner

// ─── Constants ───
const roleFilters = [
  { key: 'all', label: 'Semua', icon: '⚡' },
  { key: 'dosen', label: 'Dosen', icon: '🎓' },
  { key: 'creator', label: 'Kreator', icon: '🎨' },
  { key: 'affiliate', label: 'Afiliator', icon: '📱' },
  { key: 'consultant', label: 'Konsultan', icon: '💼' },
  { key: 'general', label: 'Umum', icon: '⭐' },
];

const statusIcons = { todo: Circle, in_progress: CircleDot, done: CircleCheck };
const DONE_VISIBLE_LIMIT = 5;
const DONE_HIDE_AFTER_DAYS = 7;



// ─── Task Editor Modal ───
function TaskEditorModal({ open, onClose, onSave, editTask }: {
  open: boolean; onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  editTask?: Task | null;
}) {
  const isEdit = !!editTask;
  const [title, setTitle] = useState(editTask?.title || '');
  const [desc, setDesc] = useState(editTask?.description || '');
  const [priority, setPriority] = useState<Priority>(editTask?.priority || 'medium');
  const [role, setRole] = useState<RoleContext>(editTask?.contextual_role || 'general');
  const [status, setStatus] = useState<TaskStatus>(editTask?.status || 'todo');
  const [dueDate, setDueDate] = useState(editTask?.due_date || '');

  const handleSave = () => {
    onSave({ title, description: desc || null, priority, contextual_role: role, status, due_date: dueDate || null });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 ts-h2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20">
              {isEdit ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            {isEdit ? 'Edit Task' : 'Task Baru'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Judul</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tulis judul task..." className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Deskripsi</label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Deskripsi opsional..." className="min-h-[80px] rounded-lg border-border/60 bg-background text-[13px] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prioritas</label>
              <div className="flex gap-1">
                {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                  <button key={p} onClick={() => setPriority(p)} className={cn(
                    'flex-1 py-2 rounded-lg text-[11px] font-medium transition-all duration-200',
                    priority === p ? 'text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )} style={priority === p ? { backgroundColor: PRIORITIES[p].color } : undefined}>
                    {PRIORITIES[p].icon} {PRIORITIES[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30">
                {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>{TASK_STATUSES[s].icon} {TASK_STATUSES[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Peran</label>
              <select value={role} onChange={e => setRole(e.target.value as RoleContext)} className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30">
                {Object.entries(ROLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 rounded-lg border-border/60 bg-background text-[12px]" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
            <Button onClick={handleSave} disabled={!title.trim()} className="h-9 gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[12px] font-semibold shadow-md shadow-blue-500/25 hover:opacity-90 transition-all disabled:opacity-40">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isEdit ? 'Simpan Perubahan' : 'Buat Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Modal ───
function DeleteModal({ task, onClose, onConfirm }: { task: Task | null; onClose: () => void; onConfirm: () => void; }) {
  if (!task) return null;
  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 ts-title">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500"><AlertTriangle className="h-4.5 w-4.5" /></div>
            Hapus Task?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground pt-2">
            Apakah yakin menghapus <span className="font-semibold text-foreground">&ldquo;{task.title}&rdquo;</span>?
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">Batal</Button>
          <Button onClick={onConfirm} className="h-9 gap-2 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 shadow-md shadow-red-500/25 transition-all">
            <Trash2 className="h-3.5 w-3.5" /> Ya, Hapus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview Modal ───
function TaskPreviewModal({ task, onClose, onEdit }: { task: Task | null; onClose: () => void; onEdit: (t: Task) => void }) {
  if (!task) return null;
  const pri = PRIORITIES[task.priority];
  const roleData = ROLES[task.contextual_role];
  const StatusIcon = statusIcons[task.status];
  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-border/60 bg-card">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20 shrink-0">
              <CheckSquare className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="ts-title leading-snug">{task.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${pri.color}15`, color: pri.color }}>{pri.icon} {pri.label}</span>
                <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', roleData.bgClass)}>{roleData.icon} {roleData.label}</span>
                <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: TASK_STATUSES[task.status].color }}><StatusIcon className="h-3 w-3" /> {TASK_STATUSES[task.status].label}</span>
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-3">
          {task.description && (
            <div className="rounded-xl bg-muted/20 border border-border/40 p-4 text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{task.description}</div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">Prioritas</p>
              <p className="text-[12px] font-semibold" style={{ color: pri.color }}>{pri.icon} {pri.label}</p>
            </div>
            <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">Due Date</p>
              <p className="text-[12px] font-medium text-foreground">{task.due_date ? new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
            </div>
            <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">Dibuat</p>
              <p className="text-[12px] font-medium text-foreground">{new Date(task.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">Tutup</Button>
          <Button onClick={() => { onClose(); onEdit(task); }} className="h-9 gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[12px] font-semibold shadow-md shadow-blue-500/25">
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function TasksPage() {
  const { tasks, isLoading, mutate } = useTasks();
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleContext | 'all'>('all');
  const [showDoneArchive, setShowDoneArchive] = useState(false);
  const [boardNow] = useState(() => Date.now());
  const [dragIntent, setDragIntent] = useState<{
    taskId: string;
    originStatus: TaskStatus;
    startX: number;
    startY: number;
  } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    taskId: string;
    originStatus: TaskStatus;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const dragJustEndedRef = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditTask] = useState<Task | null>(null);
  const [deletingTask, setDeleteTask] = useState<Task | null>(null);

  // ─── CRUD Handlers (Server Actions + SWR mutate) ───
  const handleCreate = async (data: Partial<Task>) => {
    const result = await createTask({
      title: data.title!,
      description: data.description || undefined,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      contextual_role: data.contextual_role || 'general',
      due_date: data.due_date || undefined,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${data.title}" berhasil dibuat`);
      mutate();
    }
  };

  const handleEdit = async (data: Partial<Task>) => {
    if (!editingTask) return;
    const result = await updateTask(editingTask.id, {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      contextual_role: data.contextual_role,
      due_date: data.due_date,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${data.title}" berhasil diupdate`);
      mutate();
    }
    setEditTask(null);
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    const result = await deleteTaskAction(deletingTask.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${deletingTask.title}" dihapus`);
      mutate();
    }
    setDeleteTask(null);
  };

  const handleToggle = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const result = await updateTask(task.id, { status: newStatus });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(newStatus === 'done' ? `"${task.title}" selesai ✓` : `"${task.title}" dibuka kembali`);
      mutate();
    }
  };

  const handleChangeStatus = async (task: Task, status: TaskStatus) => {
    const result = await updateTask(task.id, { status });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${task.title}" → ${TASK_STATUSES[status].label}`);
      mutate();
    }
  };

  const handleCardClick = (event: MouseEvent<HTMLDivElement>, task: Task) => {
    const target = event.target as HTMLElement;
    if (dragJustEndedRef.current || activeDrag || target.closest('[data-task-action="true"]')) return;
    setPreviewTask(task);
  };

  const resetDragState = () => {
    setDragIntent(null);
    setActiveDrag(null);
    setDropStatus(null);
  };

  const moveTaskToStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    resetDragState();

    if (!task || task.status === status) return;

    const optimisticTasks = tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            status,
            completed_at: status === 'done' ? new Date().toISOString() : null,
          }
        : item
    );

    setMovingTaskId(task.id);
    mutate(optimisticTasks, { revalidate: false });

    const result = await updateTask(task.id, { status });
    setMovingTaskId(null);

    if (result.error) {
      toast.error(result.error);
      mutate();
      return;
    }

    toast.success(`"${task.title}" dipindahkan ke ${TASK_STATUSES[status].label}`);
    mutate();
  }, [mutate, tasks]);

  const handleTaskPointerDown = (event: ReactPointerEvent<HTMLDivElement>, task: Task) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-task-action="true"]')) return;

    setPreviewTask(null);
    setDragIntent({
      taskId: task.id,
      originStatus: task.status,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  useEffect(() => {
    if (!dragIntent && !activeDrag) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      if (dragIntent && !activeDrag) {
        const deltaX = event.clientX - dragIntent.startX;
        const deltaY = event.clientY - dragIntent.startY;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance < 8) return;

        document.body.style.cursor = 'grabbing';
        setActiveDrag({
          taskId: dragIntent.taskId,
          originStatus: dragIntent.originStatus,
          pointerX: event.clientX,
          pointerY: event.clientY,
        });
        setDropStatus(dragIntent.originStatus);
        return;
      }

      if (!activeDrag) return;

      const nextDropStatus = (document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-status]') as HTMLElement | null)
        ?.dataset.dropStatus as TaskStatus | undefined;

      setActiveDrag({
        ...activeDrag,
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
      setDropStatus(nextDropStatus ?? null);
    };

    const clearDragJustEnded = () => {
      window.setTimeout(() => {
        dragJustEndedRef.current = false;
      }, 0);
    };

    const handlePointerUp = (event: PointerEvent) => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;

      if (activeDrag) {
        const nextDropStatus = (document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-status]') as HTMLElement | null)
          ?.dataset.dropStatus as TaskStatus | undefined;
        dragJustEndedRef.current = true;

        if (nextDropStatus) {
          void moveTaskToStatus(activeDrag.taskId, nextDropStatus);
        } else {
          resetDragState();
        }

        clearDragJustEnded();
        return;
      }

      resetDragState();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [activeDrag, dragIntent, moveTaskToStatus]);

  // ─── Filtering ───
  const filtered = tasks.filter((task) => {
    if (selectedRole !== 'all' && task.contextual_role !== selectedRole) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return task.title.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const sortPriority = (a: Task, b: Task) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  };

  const doneCutoffTime = boardNow - DONE_HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const allDoneTasks = filtered
    .filter((task) => task.status === 'done')
    .sort((a, b) => {
      const aTime = new Date(a.completed_at ?? a.updated_at ?? a.created_at).getTime();
      const bTime = new Date(b.completed_at ?? b.updated_at ?? b.created_at).getTime();
      return bTime - aTime;
    });
  const visibleDoneTasks = allDoneTasks
    .filter((task) => {
      const completedTime = new Date(task.completed_at ?? task.updated_at ?? task.created_at).getTime();
      return completedTime >= doneCutoffTime;
    })
    .slice(0, DONE_VISIBLE_LIMIT);
  const visibleDoneIds = new Set(visibleDoneTasks.map((task) => task.id));
  const archivedDoneTasks = allDoneTasks.filter((task) => !visibleDoneIds.has(task.id));

  const grouped = {
    todo: filtered.filter(t => t.status === 'todo'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    done: visibleDoneTasks,
  };
  const draggingTaskId = activeDrag?.taskId ?? null;
  const draggedTask = draggingTaskId ? tasks.find((task) => task.id === draggingTaskId) ?? null : null;

  // ─── Stats ───
  const statCards = [
    { label: 'Total Tasks', value: tasks.length, icon: CheckSquare, gradient: 'gradient-blue', glow: 'shadow-blue-500/20' },
    { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: Clock, gradient: 'gradient-violet', glow: 'shadow-violet-500/20' },
    { label: 'Urgent', value: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length, icon: Flame, gradient: 'gradient-rose', glow: 'shadow-rose-500/20' },
    { label: 'Selesai', value: tasks.filter(t => t.status === 'done').length, icon: CheckCircle2, gradient: 'gradient-emerald', glow: 'shadow-emerald-500/20' },
  ];

  const completionPct = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat tasks...</p>
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
            <h1 className="ts-display text-foreground flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
                <CheckSquare className="h-5 w-5" />
              </div>
              Task Management
            </h1>
            <p className="ts-sm text-muted-foreground mt-1">Todo list dengan prioritas dan role context</p>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700" style={{ width: `${completionPct}%` }} />
              </div>
              <span className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground"><TrendingUp className="h-3 w-3" />{completionPct}% selesai</span>
            </div>
          </div>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 text-background text-[13px] font-medium hover:opacity-90 transition-all duration-200 shadow-lg shadow-foreground/10 active:scale-[0.97]">
            <Plus className="h-4 w-4" /> Task Baru
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
                <p className="ts-h1 leading-none">{card.value}</p>
              </div>
            );
          })}
        </div>

        {/* ─── Search ─── */}
        <div className="rounded-xl border border-border/60 bg-card p-1 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari tugas..." className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg bg-muted/50">Clear</button>
            )}
          </div>
        </div>

        {/* ─── Filters ─── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground mr-1">
              <Filter className="h-4 w-4" /><span className="text-[12px] font-medium">Filter:</span>
            </div>
            {roleFilters.map((role) => (
              <button key={role.key} onClick={() => setSelectedRole(role.key as RoleContext | 'all')} className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200',
                selectedRole === role.key ? 'bg-foreground text-background shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}>
                <span>{role.icon}</span><span>{role.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Task Columns ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {(Object.keys(grouped) as TaskStatus[]).map((status) => {
            const items = grouped[status];
            const StatusIcon = statusIcons[status];
            const statusCount = status === 'done' ? allDoneTasks.length : items.length;
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl border border-border/50 bg-card shadow-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${TASK_STATUSES[status].color}15` }}>
                    <StatusIcon className="h-4 w-4" style={{ color: TASK_STATUSES[status].color }} />
                  </div>
                  <h2 className="text-[14px] font-semibold text-foreground">{TASK_STATUSES[status].label}</h2>
                  <span className="min-w-[22px] h-[22px] rounded-full text-[11px] text-white flex items-center justify-center font-semibold" style={{ backgroundColor: TASK_STATUSES[status].color }}>{statusCount}</span>
                  {status === 'done' && (
                    <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                      {Math.min(visibleDoneTasks.length, DONE_VISIBLE_LIMIT)} terbaru
                    </span>
                  )}
                </div>
                <div
                  data-drop-status={status}
                  className={cn(
                    'space-y-3 rounded-2xl border border-transparent p-2 transition-all duration-200 min-h-[220px]',
                    activeDrag && dropStatus === status && 'border-primary/35 bg-primary/5 shadow-inner'
                  )}
                >
                  {activeDrag && dropStatus === status && (
                    <div className="rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-2 text-[12px] font-medium text-primary">
                      Lepas di sini untuk pindah ke {TASK_STATUSES[status].label}
                    </div>
                  )}
                  {items.sort((a, b) => {
                    return status === 'done'
                      ? new Date(b.completed_at ?? b.updated_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.updated_at ?? a.created_at).getTime()
                      : sortPriority(a, b);
                  }).map((task) => {
                    const pri = PRIORITIES[task.priority];
                    const roleData = ROLES[task.contextual_role];
                    return (
                      <div
                        key={task.id}
                        onPointerDown={(event) => handleTaskPointerDown(event, task)}
                        onClick={(event) => handleCardClick(event, task)}
                        className={cn(
                          'group widget-card rounded-2xl border border-border/60 bg-card p-4 shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200',
                          draggingTaskId === task.id && 'opacity-45 scale-[0.98] ring-2 ring-primary/20',
                          movingTaskId === task.id && 'pointer-events-none opacity-70'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div data-task-action="true">
                            <Checkbox
                              checked={task.status === 'done'}
                              onClick={(event) => event.stopPropagation()}
                              onCheckedChange={() => handleToggle(task)}
                              className="mt-0.5 border-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="mt-0.5 text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors cursor-grab active:cursor-grabbing touch-none">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <p className={cn('text-[14px] font-medium leading-snug', task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground')}>{task.title}</p>
                              </div>
                              <div data-task-action="true">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all duration-200 shrink-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    className="w-48 border-border/60 bg-card shadow-xl rounded-xl"
                                  >
                                  <DropdownMenuItem
                                    onSelect={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      setPreviewTask(null);
                                      setEditTask(task);
                                    }}
                                    className="gap-2 text-[13px] focus:bg-muted rounded-lg"
                                  >
                                    <Edit3 className="h-4 w-4 text-muted-foreground" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-border/40" />
                                  {(Object.keys(TASK_STATUSES) as TaskStatus[]).filter(s => s !== task.status).map(s => (
                                    <DropdownMenuItem
                                      key={s}
                                      onSelect={(event) => event.stopPropagation()}
                                      onClick={() => handleChangeStatus(task, s)}
                                      className="gap-2 text-[13px] focus:bg-muted rounded-lg"
                                    >
                                      <ArrowRight className="h-4 w-4 text-muted-foreground" /> → {TASK_STATUSES[s].label}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator className="bg-border/40" />
                                  <DropdownMenuItem
                                    onSelect={(event) => event.stopPropagation()}
                                    onClick={() => {
                                      setPreviewTask(null);
                                      setDeleteTask(task);
                                    }}
                                    className="gap-2 text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" /> Hapus
                                  </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            {task.description && (
                              <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${pri.color}15`, color: pri.color }}>
                                {pri.icon} {pri.label}
                              </span>
                              <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', roleData.bgClass)}>
                                {roleData.icon} {roleData.label}
                              </span>
                              {task.due_date && (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {status === 'done' && archivedDoneTasks.length > 0 && (
                    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                      <button
                        onClick={() => setShowDoneArchive((current) => !current)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Archive className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-foreground">
                              {archivedDoneTasks.length} task selesai lainnya
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Board utama hanya menampilkan 5 task selesai terbaru dalam 7 hari terakhir.
                            </p>
                          </div>
                        </div>
                        {showDoneArchive ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {showDoneArchive && (
                        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                          {archivedDoneTasks.map((task) => (
                            <button
                              key={task.id}
                              onClick={() => setPreviewTask(task)}
                              className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3 text-left transition-colors hover:bg-muted/35"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-foreground">{task.title}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Selesai {new Date(task.completed_at ?? task.updated_at ?? task.created_at).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                              <span className={cn('shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium', ROLES[task.contextual_role].bgClass)}>
                                {ROLES[task.contextual_role].label}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {items.length === 0 && !(status === 'done' && archivedDoneTasks.length > 0) && (
                    <div className={cn(
                      'rounded-2xl border border-dashed p-8 text-center transition-colors',
                      activeDrag && dropStatus === status
                        ? 'border-primary/35 bg-primary/5'
                        : 'border-border/60'
                    )}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
                        <StatusIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-[13px] font-medium text-foreground mb-1">Tidak ada tugas</p>
                      <p className="text-[12px] text-muted-foreground mb-3">Belum ada item di kolom ini</p>
                      {status === 'todo' && (
                        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[11px] font-semibold shadow-md shadow-blue-500/20">
                          <Plus className="h-3 w-3" /> Buat Task
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Modals ─── */}
      {createOpen && (
        <TaskEditorModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
      )}
      {editingTask && (
        <TaskEditorModal key={editingTask.id} open={!!editingTask} onClose={() => setEditTask(null)} onSave={handleEdit} editTask={editingTask} />
      )}
      <DeleteModal task={deletingTask} onClose={() => setDeleteTask(null)} onConfirm={handleDelete} />
      <TaskPreviewModal task={previewTask} onClose={() => setPreviewTask(null)} onEdit={(t) => { setPreviewTask(null); setEditTask(t); }} />
      {activeDrag && draggedTask && (
        <div
          className="fixed top-0 left-0 z-50 pointer-events-none"
          style={{
            transform: `translate(${activeDrag.pointerX + 18}px, ${activeDrag.pointerY + 18}px)`,
          }}
        >
          <div className="max-w-[260px] rounded-2xl border border-primary/20 bg-card/95 px-4 py-3 shadow-2xl shadow-primary/15 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
              Pindahkan task
            </p>
            <p className="mt-1 text-[13px] font-medium text-foreground line-clamp-2">
              {draggedTask.title}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
