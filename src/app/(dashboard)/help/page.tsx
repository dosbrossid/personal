'use client';

import {
  Brain,
  CheckSquare,
  Flame,
  CalendarDays,
  BookOpenCheck,
  GraduationCap,
  PenSquare,
  Command,
  Keyboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ShortcutItem = {
  keys: string[];
  label: string;
};

type ModuleItem = {
  icon: LucideIcon;
  label: string;
  description: string;
};

const shortcuts: ShortcutItem[] = [
  { keys: ['⌘', 'K'], label: 'Buka pencarian global (Ctrl+K di Windows)' },
  { keys: ['↑', '↓'], label: 'Navigasi hasil pencarian' },
  { keys: ['↵'], label: 'Buka item yang dipilih' },
  { keys: ['Esc'], label: 'Tutup dialog atau pencarian' },
];

const modules: ModuleItem[] = [
  { icon: Brain, label: 'Catatan', description: 'Simpan ide, draft, dan referensi dengan dukungan pin.' },
  { icon: CheckSquare, label: 'Tugas', description: 'Kelola to-do dengan prioritas dan tanggal jatuh tempo.' },
  { icon: Flame, label: 'Kebiasaan', description: 'Lacak habit harian dan jaga streak tetap hidup.' },
  { icon: BookOpenCheck, label: 'Kelas', description: 'Atur jadwal kelas dan sesi pengajaran.' },
  { icon: CalendarDays, label: 'Kalender', description: 'Lihat agenda dan acara mendatang dalam satu tempat.' },
  { icon: GraduationCap, label: 'Vault', description: 'Penyimpanan file dan dokumen penting yang aman.' },
  { icon: PenSquare, label: 'Blog CMS', description: 'Tulis dan publikasikan artikel ke blog publik.' },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="ts-display text-foreground">Bantuan</h1>
        <p className="ts-body mt-2 max-w-2xl text-muted-foreground">
          Panduan singkat untuk memakai dashboard dengan lebih cepat dan nyaman.
        </p>
      </div>

      {/* Keyboard shortcuts */}
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Keyboard className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="ts-title text-foreground">Pintasan Keyboard</h2>
            <p className="ts-caption text-muted-foreground">Percepat navigasi tanpa mouse</p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {shortcuts.map((shortcut) => (
            <li
              key={shortcut.label}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3"
            >
              <span className="ts-sm text-foreground">{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="ts-label inline-flex min-w-7 items-center justify-center rounded-md border border-border bg-background px-2 py-1 font-mono font-medium text-muted-foreground shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="ts-sm mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Command className="h-4 w-4" />
          Coba pencarian global
        </button>
      </section>

      {/* Modules overview */}
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="ts-title text-foreground">Modul</h2>
          <p className="ts-caption text-muted-foreground">Ringkasan fitur yang tersedia di dashboard</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.label}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="ts-sm font-semibold text-foreground">{module.label}</p>
                  <p className="ts-caption mt-0.5 text-muted-foreground">{module.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
