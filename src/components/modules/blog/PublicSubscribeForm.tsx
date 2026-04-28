'use client';

import { useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const INTEREST_OPTIONS = [
  'Bisnis',
  'Digital Marketing',
  'Sistem Integrator',
  'Web App Bisnis',
  'Catatan Belajar',
] as const;

export function PublicSubscribeForm({
  sourcePath,
  compact = false,
}: {
  sourcePath: string;
  compact?: boolean;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState<string>(INTEREST_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          interest,
          source_path: sourcePath,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Gagal menyimpan subscriber');
      }

      toast.success(payload.message || 'Email berhasil disimpan');
      setFullName('');
      setEmail('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan subscriber');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'grid gap-3 border border-border/70 bg-background p-4',
        compact ? 'grid-cols-1 rounded-[22px]' : 'rounded-[28px] shadow-xl shadow-slate-900/6 backdrop-blur-xl md:grid-cols-[1fr_1fr_180px_auto]'
      )}
    >
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nama</label>
        <Input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Ziaul Maula"
          className="h-11 rounded-xl border-border/60 bg-background"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@email.com"
          className="h-11 rounded-xl border-border/60 bg-background"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Minat</label>
        <select
          value={interest}
          onChange={(event) => setInterest(event.target.value)}
          className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
        >
          {INTEREST_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full rounded-xl bg-foreground text-background hover:opacity-90"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Simpan
        </Button>
      </div>
      <div className={compact ? undefined : 'md:col-span-4'}>
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          Subscriber masuk ke database dulu, jadi siap kamu sambungkan ke autoresponder atau email sequence berikutnya.
        </p>
      </div>
    </form>
  );
}
