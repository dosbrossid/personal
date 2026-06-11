'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StatCard — kartu statistik gradient yang dipakai di header tiap modul dashboard.
 *
 * Aksesibilitas: gradient terang (amber/emerald) membuat teks putih berisiko
 * gagal kontras WCAG AA. Untuk itu kartu ini memasang overlay gelap tipis
 * (`bg-black/15`) yang mendalamkan SEMUA gradient secara seragam, ditambah
 * `text-shadow` halus pada teks. Hasilnya teks putih jauh lebih terbaca tanpa
 * mengubah identitas warna kartu.
 *
 * Catatan: angka kontras pasti tetap perlu diverifikasi dengan contrast checker
 * (Lighthouse/axe) pada tiap gradient.
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  glow,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  /** Class background gradient, mis. "gradient-emerald" atau "bg-gradient-to-br from-... to-...". */
  gradient: string;
  /** Class shadow opsional, mis. "shadow-emerald-500/20". */
  glow?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-4 text-white shadow-lg',
        'transition-transform duration-200 hover:-translate-y-0.5',
        gradient,
        glow,
        className
      )}
    >
      {/* Overlay kontras: mendalamkan gradient agar teks putih memenuhi kontras */}
      <div className="pointer-events-none absolute inset-0 bg-black/15" aria-hidden="true" />

      <div className="relative">
        <div className="mb-2 flex items-center justify-between">
          <p className="ts-label font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.28)]">
            {label}
          </p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
        </div>
        <p className="ts-h1 leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.28)]">
          {value}
        </p>
        {sub && (
          <p className="ts-micro mt-1 font-medium text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.28)]">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
