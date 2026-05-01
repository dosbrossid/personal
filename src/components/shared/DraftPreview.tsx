'use client';

import { useState } from 'react';
import { Check, X, Edit3, CalendarDays, CheckSquare, Brain, GraduationCap, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES } from '@/core/constants';
import type { RoleContext } from '@/core/constants';
import type { AIResponseItem } from '@/core/types';
import { executeConfirmedDraft } from '@/actions/ai.actions';
import { toast } from 'sonner';

export interface DraftItem {
    action: AIResponseItem['action'];
    title: string;
    role: RoleContext;
    detail: string;
    rawItem: AIResponseItem;
}

interface DraftPreviewProps {
    items: DraftItem[];
    onDismiss: () => void;
    onSuccess: () => void;
}

const actionIcons = {
    TASK: CheckSquare,
    NOTE: Brain,
    CALENDAR: CalendarDays,
    ACADEMIC: GraduationCap,
    CLASS: BookOpen,
};

const actionColors = {
    TASK: 'text-blue-400 bg-blue-500/10',
    NOTE: 'text-violet-400 bg-violet-500/10',
    CALENDAR: 'text-emerald-400 bg-emerald-500/10',
    ACADEMIC: 'text-amber-400 bg-amber-500/10',
    CLASS: 'text-cyan-400 bg-cyan-500/10',
};

export function DraftPreview({ items, onDismiss, onSuccess }: DraftPreviewProps) {
    const [localItems, setLocalItems] = useState<DraftItem[]>(items);
    const [confirming, setConfirming] = useState(false);

    function removeItem(index: number) {
        setLocalItems((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleConfirmAll() {
        if (localItems.length === 0) {
            onDismiss();
            return;
        }

        setConfirming(true);

        try {
            const result = await executeConfirmedDraft(localItems.map((item) => item.rawItem));

            if (result.error) {
                toast.error(result.error);
                setConfirming(false);
                return;
            }

            const { created, errors } = result.data!;

            if (errors.length > 0) {
                toast.warning(`${created.length} item disimpan, ${errors.length} gagal`);
                errors.forEach((err) => toast.error(err));
            } else {
                toast.success(`${created.length} item berhasil disimpan!`);
            }

            onSuccess();
        } catch {
            toast.error('Gagal menyimpan draft. Silakan coba lagi.');
        } finally {
            setConfirming(false);
        }
    }

    if (localItems.length === 0) return null;

    return (
        <div className="mx-4 mb-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md bg-primary/20 flex items-center justify-center">
                        <Edit3 className="h-3 w-3 text-primary" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Draft Preview — {localItems.length} item
                    </p>
                </div>
                <button onClick={onDismiss} className="text-muted-foreground hover:text-muted-foreground transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="space-y-2">
                {localItems.map((item, i) => {
                    const Icon = actionIcons[item.action];
                    return (
                        <div
                            key={i}
                            className="flex items-center gap-3 rounded-lg bg-muted border border-border px-3 py-2.5 group"
                        >
                            <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', actionColors[item.action])}>
                                <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">{item.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', ROLES[item.role].bgClass)}>
                                        {ROLES[item.role].icon} {ROLES[item.role].label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">{item.detail}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => removeItem(i)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    onClick={handleConfirmAll}
                    disabled={confirming}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                    <Check className="h-3.5 w-3.5" />
                    {confirming ? 'Menyimpan...' : 'Simpan Semua'}
                </button>
                <button
                    onClick={onDismiss}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
                >
                    Batal
                </button>
            </div>
        </div>
    );
}
