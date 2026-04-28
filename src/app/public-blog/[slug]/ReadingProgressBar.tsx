'use client';

import { useEffect, useState } from 'react';

/**
 * Medium-like reading progress bar that sticks to the top of the page.
 * Shows how far the user has scrolled through the article.
 */
export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setProgress(0);
        return;
      }
      const pct = Math.min((scrollTop / docHeight) * 100, 100);
      setProgress(pct);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (progress <= 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-primary via-primary/80 to-emerald-400 transition-[width] duration-100 ease-out shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
