'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Brain, CheckSquare, CalendarDays, GraduationCap, ArrowRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ROLES } from '@/core/constants';
import type { RoleContext } from '@/core/constants';
import { useRouter } from 'next/navigation';

interface SearchItem {
  id: string;
  type: 'note' | 'task' | 'vault' | 'calendar';
  title: string;
  description: string | null;
  role: RoleContext;
}

const typeIcons = {
  note: Brain,
  task: CheckSquare,
  calendar: CalendarDays,
  vault: GraduationCap,
};

const typeColors = {
  note: 'text-violet-700 dark:text-violet-400',
  task: 'text-blue-700 dark:text-blue-400',
  calendar: 'text-emerald-700 dark:text-emerald-400',
  vault: 'text-amber-700 dark:text-amber-400',
};

const typeLabels = {
  note: 'Catatan',
  task: 'Tugas',
  calendar: 'Kalender',
  vault: 'Vault',
};

const typeRoutes = {
  note: '/notes',
  task: '/tasks',
  calendar: '/calendar',
  vault: '/vault',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Keyboard shortcut to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Open via custom event (e.g. from sidebar search trigger)
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('open-command-palette', onOpen);
    return () => window.removeEventListener('open-command-palette', onOpen);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigateToItem = useCallback((item: SearchItem) => {
    setOpen(false);
    const route = typeRoutes[item.type];
    router.push(route);
  }, [router]);

  // Arrow navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[activeIndex]) {
          navigateToItem(results[activeIndex]);
        }
      }
    },
    [results, activeIndex, navigateToItem]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden rounded-2xl border border-border bg-card/95 p-0 shadow-2xl shadow-slate-900/12 backdrop-blur-xl dark:shadow-black/60">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-primary shrink-0 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Cari di semua modul..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2">
          {/* Empty query state */}
          {!query.trim() && (
            <div className="py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Ketik minimal 2 karakter untuk mencari...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Cari di catatan, tugas, kalender, dan vault</p>
            </div>
          )}

          {/* Loading state */}
          {query.trim().length >= 2 && isSearching && results.length === 0 && (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 text-primary mx-auto animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Mencari...</p>
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 2 && !isSearching && results.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Tidak ada hasil untuk &quot;{query}&quot;</p>
            </div>
          )}

          {/* Results list */}
          {results.map((item, i) => {
            const Icon = typeIcons[item.type];
            const roleData = ROLES[item.role as RoleContext];
            return (
              <button
                key={`${item.type}-${item.id}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => navigateToItem(item)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  i === activeIndex ? 'bg-muted' : ''
                )}
              >
                <div className={cn('h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0', typeColors[item.type])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{typeLabels[item.type]}</span>
                    {roleData && (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', roleData.bgClass)}>
                        {roleData.icon} {roleData.label}
                      </span>
                    )}
                  </div>
                </div>
                {i === activeIndex && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
            navigasi
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>
            buka
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">esc</kbd>
            tutup
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
