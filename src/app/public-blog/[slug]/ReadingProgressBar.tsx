'use client';

import { useEffect, useRef } from 'react';

/**
 * Medium-like reading progress bar that sticks to the top of the page.
 * Shows how far the user has scrolled through the article.
 */
export function ReadingProgressBar() {
  const progressRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    function updateProgress() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight <= 0 ? 0 : Math.min((scrollTop / docHeight) * 100, 100);
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${pct / 100})`;
        progressRef.current.style.opacity = pct <= 0 ? '0' : '1';
      }
      frameRef.current = null;
    }

    function handleScroll() {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateProgress);
    }

    updateProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div
        ref={progressRef}
        className="h-full origin-left scale-x-0 bg-gradient-to-r from-primary via-primary/80 to-emerald-400 opacity-0 shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)] will-change-transform"
      />
    </div>
  );
}
