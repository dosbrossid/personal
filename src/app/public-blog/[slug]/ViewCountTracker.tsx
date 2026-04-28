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

    // Fire-and-forget — no need to await
    fetch(`/api/public/blog/${postId}/view`, {
      method: 'POST',
    }).catch(() => {
      // Silently fail — view count is not critical
    });
  }, [postId]);

  return null;
}
