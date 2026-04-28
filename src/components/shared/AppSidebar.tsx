'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Brain,
  CheckSquare,
  Flame,
  CalendarDays,
  BookOpenCheck,
  GraduationCap,
  PenSquare,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Bell,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { logoutAction } from '@/actions/auth.actions';
import { useUser } from '@/hooks/use-user';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

type SidebarMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
};

type SidebarMenuGroup = {
  title: string;
  items: SidebarMenuItem[];
};

const menuGroups: SidebarMenuGroup[] = [
  {
    title: 'MAIN MENU',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/notes', label: 'Catatan', icon: Brain },
      { href: '/tasks', label: 'Tugas', icon: CheckSquare },
      { href: '/habits', label: 'Kebiasaan', icon: Flame },
    ],
  },
  {
    title: 'FEATURES',
    items: [
      { href: '/classes', label: 'Classes', icon: BookOpenCheck },
      { href: '/calendar', label: 'Kalender', icon: CalendarDays },
      { href: '/vault', label: 'Vault', icon: GraduationCap },
      { href: '/blog', label: 'Blog CMS', icon: PenSquare },
    ],
  },
];

const bottomItems = [
  { href: '/settings', label: 'Pengaturan', icon: Settings },
  { href: '#', label: 'Bantuan', icon: HelpCircle },
];



export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { stats } = useDashboardStats();
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || 'Authenticated';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  const resolvedMenuGroups = menuGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (!stats) return item;

      if (item.href === '/notes') {
        return { ...item, count: stats.totalNotes };
      }

      if (item.href === '/tasks') {
        return { ...item, count: stats.activeTasks };
      }

      if (item.href === '/calendar') {
        return { ...item, count: stats.upcomingEvents };
      }

      return item;
    }),
  }));

  const renderSidebarBody = (mobile = false) => (
    <>
      <div className="gradient-accent-line h-[2px] w-full shrink-0" />

      <div className="flex h-16 items-center gap-3 px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/25">
          <Brain className="h-5 w-5" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-400">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold tracking-tight text-sidebar-foreground">SecondBrain</h1>
          <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" /> AI-Powered
          </p>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-4 px-4">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-3 py-2.5 shadow-sm shadow-black/5 transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 dark:border-white/[0.07] dark:bg-white/[0.04] dark:shadow-none dark:focus-within:border-primary/35 dark:focus-within:bg-white/[0.055]">
          <Search className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 dark:placeholder:text-slate-500"
          />
          <kbd className="rounded-md border border-border/50 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3">
        {resolvedMenuGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/65 dark:text-slate-400/70">
              {group.title}
            </p>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={mobile ? () => setMobileOpen(false) : undefined}
                      className={cn(
                        'group relative flex items-center justify-between rounded-xl border border-transparent px-3 py-2.5 transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10 dark:border-white/[0.05] dark:bg-primary/14 dark:text-emerald-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:hover:border-white/[0.04] dark:hover:bg-white/[0.055]'
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-200" />
                      )}
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px] transition-all duration-200',
                            isActive && 'drop-shadow-[0_0_6px_rgba(16,185,129,0.4)] dark:drop-shadow-[0_0_8px_rgba(67,197,159,0.35)]'
                          )}
                          strokeWidth={isActive ? 2 : 1.5}
                        />
                        <span className={cn('text-[13px]', isActive ? 'font-semibold' : 'font-medium')}>
                          {item.label}
                        </span>
                      </div>
                      {typeof item.count === 'number' && item.count > 0 && (
                        <span className={cn(
                          'min-w-[22px] rounded-lg px-2 py-0.5 text-center text-[11px] font-semibold transition-all duration-200',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 dark:bg-emerald-400/18 dark:text-emerald-200 dark:shadow-none'
                            : 'bg-muted text-muted-foreground dark:bg-white/[0.06] dark:text-slate-300'
                        )}>
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/65 dark:text-slate-400/70">
            GENERAL
          </p>
          <nav className="space-y-0.5">
            {bottomItems.map((item) => {
              const isActive = pathname.startsWith(item.href) && item.href !== '#';
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={mobile ? () => setMobileOpen(false) : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10 dark:border-white/[0.05] dark:bg-primary/14 dark:text-emerald-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:hover:border-white/[0.04] dark:hover:bg-white/[0.055]'
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  <span className={cn('text-[13px]', isActive ? 'font-semibold' : 'font-medium')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-500/12 dark:hover:text-red-300"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
                <span className="text-[13px] font-medium">Log out</span>
              </button>
            </form>
          </nav>
        </div>
      </div>

      <div className="border-t border-border/50 p-3 dark:border-sidebar-border/80">
        <div className="flex items-center justify-between rounded-xl bg-muted/30 p-2 shadow-sm shadow-black/5 transition-colors duration-200 hover:bg-muted/60 dark:bg-white/[0.045] dark:shadow-none dark:ring-1 dark:ring-white/[0.04] dark:hover:bg-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-600 text-xs font-bold text-white shadow-md shadow-primary/20">
              {initials}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-[1.5px] border-sidebar bg-emerald-400" />
            </div>
            <div>
              <p className="max-w-[118px] truncate text-[13px] font-semibold leading-tight text-foreground">
                {displayName}
              </p>
              <p className="max-w-[118px] truncate text-[11px] text-muted-foreground">
                {displayEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="relative rounded-lg p-2 transition-colors hover:bg-muted dark:hover:bg-white/[0.07]">
              <Bell className="h-4 w-4 text-muted-foreground dark:text-slate-300" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-border/60 bg-background/92 backdrop-blur-xl md:hidden">
        <div className="gradient-accent-line h-[2px] w-full" />
        <div className="flex h-16 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card text-foreground shadow-sm shadow-black/5 transition hover:bg-muted"
            aria-label="Buka menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/25">
              <Brain className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
              </span>
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-tight text-foreground">SecondBrain</p>
              <p className="text-[10px] text-muted-foreground">Workspace pribadi</p>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[290px] border-r border-border/60 bg-sidebar p-0 text-sidebar-foreground sm:max-w-none"
        >
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <div className="flex h-full flex-col overflow-hidden bg-sidebar/98 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(21,27,36,0.98)_0%,rgba(17,23,31,1)_100%)]">
            {renderSidebarBody(true)}
          </div>
        </SheetContent>
      </Sheet>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[260px] flex-col overflow-hidden border-r border-border/50 bg-sidebar/95 backdrop-blur-xl dark:border-sidebar-border/80 dark:bg-[linear-gradient(180deg,rgba(21,27,36,0.96)_0%,rgba(17,23,31,0.98)_100%)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)] md:flex">
        {renderSidebarBody()}
      </aside>
    </>
  );
}
