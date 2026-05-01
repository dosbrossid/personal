'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function PublicBlogNavigationFeedback() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const resetId = window.setTimeout(() => setPending(false), 0);
    return () => window.clearTimeout(resetId);
  }, [pathname]);

  useEffect(() => {
    if (!pending) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = window.setTimeout(() => setPending(false), 8000);
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pending]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (isModifiedClick(event) || event.defaultPrevented) return;

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.hash) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;

      setPending(true);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80]" aria-live="polite" aria-atomic="true">
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        <div className="h-full w-1/2 animate-[blog-route-progress_1.1s_ease-in-out_infinite] rounded-r-full bg-gradient-to-r from-[#100f12] via-[#14b8a6] to-[#62d8b1] shadow-[0_0_18px_rgba(20,184,166,0.35)]" />
      </div>
      <div className="mx-auto mt-3 flex max-w-[1400px] justify-center px-4 sm:justify-end sm:px-6">
        <div className="rounded-full border border-[#eee9df] bg-white/95 px-4 py-2 text-[12px] font-semibold text-[#242424] shadow-lg shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-[#100f12]/95 dark:text-[#f7f3ea]">
          Membuka halaman...
        </div>
      </div>
    </div>
  );
}
