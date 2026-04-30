'use client';

import { useEffect, useRef } from 'react';

interface ViewCountTrackerProps {
  postId: string;
}

/**
 * Client component that increments view count once per page visit.
 * Uses a ref to prevent double-counting in React strict mode.
 */
export function ViewCountTracker({ postId }: ViewCountTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || !postId) return;
    tracked.current = true;

    const trackView = () => {
      fetch(`/api/public/blog/${postId}/view`, {
        method: 'POST',
      }).catch(() => {
        // Silently fail — view count is not critical.
      });
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(trackView, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(trackView, 1200);
    return () => clearTimeout(timeoutId);
  }, [postId]);

  return null;
}
