'use client';

import { useEffect, useState, useTransition } from 'react';
import { Settings, User as UserIcon, Bell, HardDrive, Zap, MessageCircle, CheckCircle2, Save, Send, LogOut, MoonStar, Sun, MonitorSmartphone, Activity, Download } from 'lucide-react';
import { mutate as mutateGlobal } from 'swr';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  connectTelegramChat,
  createTestNotification,
  disconnectTelegram,
  sendTelegramTestMessage,
  updateProfileSettings,
} from '@/actions/settings.actions';
import { cn, formatFileSize } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { useVaultItems } from '@/hooks/use-vault';
import { useAIUsage } from '@/hooks/use-ai-usage';
import { useDashboardActivity } from '@/hooks/use-dashboard-activity';
import { ROLES } from '@/core/constants';
import type { RoleContext } from '@/core/constants';
import type { AcademicVaultItem, AIUsageStats, User as AppUser, UserPreferences } from '@/core/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/actions/auth.actions';

const DEFAULT_NOTIFICATION_PREFS: NonNullable<UserPreferences['notifications']> = {
  task_deadline: true,
  habit_daily: true,
  calendar_event: true,
  weekly_digest_telegram: false,
  telegram_enabled: false,
  push_enabled: true,
};

const DEFAULT_ACTIVE_ROLES: RoleContext[] = ['dosen', 'creator', 'affiliate', 'consultant', 'general'];
const TELEGRAM_BOT_HANDLE = '@zmaula_dashboard_bot';
const TELEGRAM_BOT_URL = 'https://t.me/zmaula_dashboard_bot';
const PWA_INSTALL_AVAILABLE_EVENT = 'zmaula:pwa-install-available';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

declare global {
  interface Window {
    __zmaulaPwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const NOTIFICATION_OPTIONS: Array<{
  key: keyof NonNullable<UserPreferences['notifications']>;
  label: string;
  desc: string;
}> = [
  { key: 'task_deadline', label: 'Task deadline reminder', desc: '1 hari sebelum due date' },
  { key: 'habit_daily', label: 'Habit daily reminder', desc: 'Jam 20:00 setiap hari' },
  { key: 'calendar_event', label: 'Calendar event reminder', desc: 'Sesuai setting per-event' },
  { key: 'weekly_digest_telegram', label: 'Weekly digest via Telegram', desc: 'Rangkuman mingguan setiap Senin' },
  { key: 'push_enabled', label: 'In-app notification', desc: 'Tampilkan notifikasi di dashboard' },
];

function mergeNotificationPrefs(preferences?: UserPreferences | null) {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(preferences?.notifications ?? {}),
  };
}

function getActiveRoles(preferences?: UserPreferences | null) {
  return preferences?.active_roles?.length ? preferences.active_roles : DEFAULT_ACTIVE_ROLES;
}

function getStandaloneStatus() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

type MutateUser = ReturnType<typeof useUser>['mutate'];

interface SettingsContentProps {
  user: AppUser;
  vaultItems: AcademicVaultItem[];
  aiUsage: AIUsageStats;
  mutateUser: MutateUser;
}

export default function SettingsPage() {
  const { user, isLoading: isUserLoading, mutate: mutateUser } = useUser();
  const { items: vaultItems, isLoading: isVaultLoading } = useVaultItems();
  const { stats: aiUsage, isLoading: isAIUsageLoading } = useAIUsage();

  const isLoading = isUserLoading || isVaultLoading || isAIUsageLoading;

  if (isLoading || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsContent
      key={`${user.id}-${user.updated_at}`}
      user={user}
      vaultItems={vaultItems}
      aiUsage={aiUsage}
      mutateUser={mutateUser}
    />
  );
}

function SettingsContent({ user, vaultItems, aiUsage, mutateUser }: SettingsContentProps) {
  const { setTheme: setRuntimeTheme } = useTheme();
  const { items: recentActivity } = useDashboardActivity({ limit: 5, refreshInterval: 120000 });
  const [fullName, setFullName] = useState(user.full_name);
  const [timezone, setTimezone] = useState(user.preferences?.timezone ?? 'Asia/Jakarta');
  const [locale, setLocale] = useState(user.preferences?.locale ?? 'id');
  const [theme, setTheme] = useState<UserPreferences['theme']>(user.preferences?.theme ?? 'light');
  const [activeRoles, setActiveRoles] = useState<RoleContext[]>(getActiveRoles(user.preferences));
  const [notificationPrefs, setNotificationPrefs] = useState(mergeNotificationPrefs(user.preferences));
  const [telegramChatId, setTelegramChatId] = useState(user.telegram_chat_id ?? '');
  const [isSaving, startSaving] = useTransition();
  const [isTelegramBusy, startTelegram] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [pwaInstallAvailable, setPwaInstallAvailable] = useState(false);
  const [pwaStandalone, setPwaStandalone] = useState(false);
  const [pwaServiceWorkerReady, setPwaServiceWorkerReady] = useState(false);

  const totalStorage = vaultItems.reduce((sum, item) => sum + (item.file_size_bytes ?? 0), 0);
  const maxStorage = 1024 * 1024 * 1024;
  const storagePercent = (totalStorage / maxStorage) * 100;
  const isTelegramConnected = Boolean(user.telegram_chat_id);
  const currentActiveRoles = getActiveRoles(user.preferences);
  const currentNotificationPrefs = mergeNotificationPrefs(user.preferences);
  const hasUnsavedChanges =
    fullName !== user.full_name ||
    timezone !== (user.preferences?.timezone ?? 'Asia/Jakarta') ||
    locale !== (user.preferences?.locale ?? 'id') ||
    theme !== (user.preferences?.theme ?? 'light') ||
    JSON.stringify([...activeRoles].sort()) !== JSON.stringify([...currentActiveRoles].sort()) ||
    JSON.stringify(notificationPrefs) !== JSON.stringify(currentNotificationPrefs) ||
    telegramChatId !== (user.telegram_chat_id ?? '');

  useEffect(() => {
    const refreshPwaStatus = () => {
      setPwaInstallAvailable(Boolean(window.__zmaulaPwaInstallPrompt));
      setPwaStandalone(getStandaloneStatus());
    };

    refreshPwaStatus();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setPwaServiceWorkerReady(true))
        .catch(() => setPwaServiceWorkerReady(false));
    }

    window.addEventListener(PWA_INSTALL_AVAILABLE_EVENT, refreshPwaStatus);
    window.addEventListener('appinstalled', refreshPwaStatus);

    return () => {
      window.removeEventListener(PWA_INSTALL_AVAILABLE_EVENT, refreshPwaStatus);
      window.removeEventListener('appinstalled', refreshPwaStatus);
    };
  }, []);

  const toggleRole = (role: RoleContext) => {
    setActiveRoles((current) => {
      if (current.includes(role)) {
        const next = current.filter((item) => item !== role);
        return next.length ? next : current;
      }
      return [...current, role];
    });
  };

  const toggleNotif = (key: keyof NonNullable<UserPreferences['notifications']>) => {
    setNotificationPrefs((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await updateProfileSettings({
        full_name: fullName,
        preferences: {
          timezone,
          locale,
          theme,
          active_roles: activeRoles,
          notifications: notificationPrefs,
        },
      });

      if (result.error || !result.data) {
        toast.error(result.error ?? 'Gagal menyimpan pengaturan');
        mutateUser();
        return;
      }

      setRuntimeTheme(theme);
      toast.success('Pengaturan berhasil disimpan');
      mutateUser(result.data, { revalidate: false });
    });
  };

  const handleConnectTelegram = () => {
    startTelegram(async () => {
      const result = await connectTelegramChat(telegramChatId);

      if (result.error || !result.data) {
        toast.error(result.error ?? 'Gagal menghubungkan Telegram');
        mutateUser();
        return;
      }

      toast.success('Telegram berhasil dihubungkan');
      mutateUser(result.data, { revalidate: false });
    });
  };

  const handleDisconnectTelegram = () => {
    startTelegram(async () => {
      const result = await disconnectTelegram();

      if (result.error || !result.data) {
        toast.error(result.error ?? 'Gagal memutuskan Telegram');
        mutateUser();
        return;
      }

      toast.success('Telegram diputuskan');
      mutateUser(result.data, { revalidate: false });
      setTelegramChatId('');
    });
  };

  const handleTestNotification = () => {
    startTesting(async () => {
      const result = await createTestNotification();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Test notifikasi dibuat');
      mutateGlobal('/api/notifications');
    });
  };

  const handleTestTelegram = () => {
    startTesting(async () => {
      const result = await sendTelegramTestMessage();

      if (result.error) {
        toast.error(result.error);
        mutateGlobal('/api/notifications');
        return;
      }

      toast.success('Test Telegram terkirim');
      mutateGlobal('/api/notifications');
    });
  };

  const openTelegramBot = () => {
    if (typeof window === 'undefined') return;
    window.open(TELEGRAM_BOT_URL, '_blank', 'noopener,noreferrer');
  };

  const copyChatId = async () => {
    const value = (telegramChatId || user.telegram_chat_id || '').trim();
    if (!value) {
      toast.error('Chat ID belum tersedia');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success('Chat ID berhasil disalin');
    } catch {
      toast.error('Gagal menyalin Chat ID');
    }
  };

  const handleInstallPwa = async () => {
    if (pwaStandalone) {
      toast.success('Dashboard sudah berjalan sebagai PWA.');
      return;
    }

    const installPrompt = window.__zmaulaPwaInstallPrompt;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      window.__zmaulaPwaInstallPrompt = null;
      setPwaInstallAvailable(false);

      if (choice?.outcome === 'accepted') {
        toast.success('Install PWA dimulai.');
      } else {
        toast('Install dibatalkan', {
          description: 'Kalau mau coba lagi, buka ulang dashboard lalu masuk Settings.',
        });
      }
      return;
    }

    toast('Install manual dari Chrome', {
      description: 'Buka menu ⋮ di Chrome, lalu pilih Install app. Kalau belum ada, tunggu deploy/service worker selesai lalu refresh halaman.',
      duration: 16000,
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-[28px] font-bold tracking-tight text-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/20 dark:from-slate-400 dark:to-slate-600">
              <Settings className="h-5 w-5" />
            </div>
            Pengaturan
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Kelola profil, preferensi, dan integrasi</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-5 py-2.5 text-[13px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {isSaving ? 'Menyimpan...' : hasUnsavedChanges ? 'Simpan Perubahan' : 'Tersimpan'}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {hasUnsavedChanges ? 'Ada perubahan yang belum disimpan' : 'Semua preferensi sudah sinkron'}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <UserIcon className="h-4 w-4 text-blue-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Profil</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nama Lengkap</label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
            <Input value={user?.email || ''} disabled className="h-10 rounded-lg border-border/60 bg-muted text-[14px] text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timezone</label>
            <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[14px] font-medium text-foreground">
              <option value="Asia/Jakarta">Asia/Jakarta</option>
              <option value="Asia/Makassar">Asia/Makassar</option>
              <option value="Asia/Jayapura">Asia/Jayapura</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Locale</label>
              <select value={locale} onChange={(event) => setLocale(event.target.value)} className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-[14px] font-medium text-foreground">
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light' as const, label: 'Light', icon: Sun },
                  { value: 'dark' as const, label: 'Dark', icon: MoonStar },
                  { value: 'system' as const, label: 'System', icon: MonitorSmartphone },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all',
                        isSelected
                          ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                          : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <label className="mb-2.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Peran Aktif</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROLES) as RoleContext[]).map((role) => {
              const isActive = activeRoles.includes(role);
              return (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all hover:-translate-y-0.5',
                    isActive ? `${ROLES[role].bgClass} border-current/20` : 'border-border/60 bg-muted/20 text-muted-foreground'
                  )}
                >
                  <span>{ROLES[role].icon}</span> {ROLES[role].label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Download className="h-4 w-4 text-emerald-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Install PWA</h2>
          <span className={cn('ml-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium', pwaStandalone ? 'bg-emerald-500/10 text-emerald-500' : pwaInstallAvailable ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500')}>
            {pwaStandalone ? 'Sudah app' : pwaInstallAvailable ? 'Siap install' : 'Manual'}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
            <p className="text-[13px] font-semibold text-foreground">Status dashboard app</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Mode PWA', value: pwaStandalone ? 'Standalone' : 'Browser' },
                { label: 'Install prompt', value: pwaInstallAvailable ? 'Tersedia' : 'Belum tersedia' },
                { label: 'Service worker', value: pwaServiceWorkerReady ? 'Aktif' : 'Memuat' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border/60 bg-background/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-[13px] font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              Kalau kamu pernah membuat shortcut lalu menghapusnya, Android kadang menahan prompt native. Tombol ini akan memakai prompt asli kalau Chrome menyediakannya; kalau tidak, pakai menu Chrome ⋮ → Install app.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
            <div>
              <p className="text-[12px] font-semibold text-foreground">Aksi cepat</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Buka dari Chrome di <span className="font-medium text-foreground">app.zmaula.web.id</span>.
              </p>
            </div>
            <Button onClick={handleInstallPwa} className="h-10 rounded-lg text-[12px]" disabled={pwaStandalone}>
              <Download className="mr-2 h-3.5 w-3.5" />
              {pwaStandalone ? 'Sudah Terinstall' : pwaInstallAvailable ? 'Install PWA' : 'Lihat Cara Install'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <MessageCircle className="h-4 w-4 text-blue-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Telegram Bot</h2>
          <span className={cn('ml-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium', isTelegramConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
            {isTelegramConnected ? 'Terhubung' : 'Belum terhubung'}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Status koneksi</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Bot aktif: <span className="font-medium text-foreground">{TELEGRAM_BOT_HANDLE}</span>
                </p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', isTelegramConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                {isTelegramConnected ? 'Sinkron ke akun ini' : 'Butuh chat id'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chat ID aktif</p>
                <p className="mt-2 break-all text-[14px] font-semibold text-foreground">
                  {user.telegram_chat_id ?? 'Belum terhubung'}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notifikasi Telegram</p>
                <p className="mt-2 text-[14px] font-semibold text-foreground">
                  {notificationPrefs.telegram_enabled ? 'Aktif' : 'Nonaktif'}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-background/60 p-3">
              <p className="text-[12px] font-semibold text-foreground">Langkah cepat</p>
              <ol className="mt-2 space-y-1 text-[12px] text-muted-foreground">
                <li>1. Buka bot Telegram lalu kirim <span className="font-medium text-foreground">/start</span>.</li>
                <li>2. Salin chat id yang dibalas bot.</li>
                <li>3. Tempel di kolom kanan lalu klik <span className="font-medium text-foreground">Hubungkan</span>.</li>
              </ol>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={openTelegramBot} className="rounded-lg text-[12px]">
                <MessageCircle className="mr-2 h-3.5 w-3.5" /> Buka Bot
              </Button>
              <Button type="button" variant="outline" onClick={copyChatId} disabled={!telegramChatId.trim() && !user.telegram_chat_id} className="rounded-lg text-[12px]">
                Salin Chat ID
              </Button>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chat ID</label>
              <Input value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} placeholder="Contoh: 240659909" className="h-11 rounded-lg border-border/60 bg-background text-[14px]" />
              <p className="text-[11px] text-muted-foreground">
                Isi dengan chat id hasil balasan <span className="font-medium text-foreground">/start</span> dari bot.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={handleConnectTelegram} disabled={isTelegramBusy || !telegramChatId.trim()} className="h-10 rounded-lg text-[12px]">
                {isTelegramConnected ? 'Update Chat ID' : 'Hubungkan'}
              </Button>
              <Button variant="outline" onClick={handleDisconnectTelegram} disabled={isTelegramBusy || !isTelegramConnected} className="h-10 rounded-lg border-red-500/20 text-[12px] text-red-500 hover:bg-red-500/5 disabled:opacity-40">
                Putuskan
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
              <p className="text-[12px] font-semibold text-foreground">Verifikasi koneksi</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Setelah terhubung, kirim test untuk memastikan dispatcher aplikasi benar-benar bisa mengirim ke chat ini.
              </p>
              <div className="mt-3">
                <Button variant="outline" onClick={handleTestTelegram} disabled={isTesting || !isTelegramConnected} className="rounded-lg text-[12px]">
                  <Send className="mr-2 h-3.5 w-3.5" /> Test Telegram
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Bell className="h-4 w-4 text-amber-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Notifikasi</h2>
        </div>
        <div className="space-y-1">
          {NOTIFICATION_OPTIONS.map((item) => (
            <div key={item.key} className="-mx-3 flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-muted/30">
              <div>
                <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
              <button onClick={() => toggleNotif(item.key)} className={cn('relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-200', notificationPrefs[item.key] ? 'bg-emerald-500' : 'bg-muted')}>
                <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200', notificationPrefs[item.key] ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" onClick={handleTestNotification} disabled={isTesting} className="rounded-lg text-[12px]">
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Buat Test Notifikasi
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Pulse Pemakaian</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[12px] font-semibold text-foreground">Ringkas minggu ini</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[24px] font-bold text-emerald-500">{recentActivity.length}</p>
                <p className="text-[11px] text-muted-foreground">aktivitas terbaru tertangkap</p>
              </div>
              <div>
                <p className="text-[24px] font-bold text-violet-500">{aiUsage.totalRequests.toLocaleString('id-ID')}</p>
                <p className="text-[11px] text-muted-foreground">permintaan AI total</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
                <p className="text-[13px] font-medium text-foreground">Belum ada jejak aktivitas terbaru</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Begitu kamu mulai membuat task, agenda, atau catatan, ringkasannya akan muncul di sini.</p>
              </div>
            ) : (
              recentActivity.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground ring-1 ring-border/50">
                    {item.table_name.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <Zap className="h-4 w-4 text-violet-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">AI Usage</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { val: aiUsage.totalRequests.toLocaleString('id-ID'), label: 'Total Requests', color: 'text-violet-500' },
            { val: aiUsage.totalTokens.toLocaleString('id-ID'), label: 'Tokens Used', color: 'text-blue-500' },
            { val: `${(aiUsage.avgLatencyMs / 1000).toFixed(1)}s`, label: 'Avg Latency', color: 'text-emerald-500' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center transition-transform duration-200 hover:-translate-y-0.5">
              <p className={cn('text-[24px] font-bold', item.color)}>{item.val}</p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Penyimpanan</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-foreground">{formatFileSize(totalStorage)} digunakan</span>
            <span className="text-muted-foreground">1 GB tersedia</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${Math.min(storagePercent, 100)}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">Untuk file besar (&gt;5MB), gunakan Google Drive link sebagai alternatif.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
            <LogOut className="h-4 w-4 text-red-500" />
          </div>
          <h2 className="text-[14px] font-semibold text-foreground">Session</h2>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-foreground">Logout dari dashboard ini</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Gunakan ini kalau kamu selesai bekerja atau ingin berganti akun.</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="rounded-lg border-red-500/20 text-[12px] text-red-500 hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-300">
              <LogOut className="mr-2 h-3.5 w-3.5" /> Logout
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
