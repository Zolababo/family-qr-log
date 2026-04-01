'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

type UsePullToRefreshArgs = {
  scrollRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onRefresh: () => Promise<void>;
};

export function usePullToRefresh({ scrollRef, enabled, onRefresh }: UsePullToRefreshArgs) {
  const pullRefreshBusyRef = useRef(false);
  const pullRafRef = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const [pullRefreshOffset, setPullRefreshOffset] = useState(0);
  const [pullRefreshRefreshing, setPullRefreshRefreshing] = useState(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const THRESHOLD = 42;
    let startY = 0;
    let tracking = false;
    let pendingOffset = 0;

    const flushOffset = () => {
      if (pullRafRef.current != null) cancelAnimationFrame(pullRafRef.current);
      pullRafRef.current = requestAnimationFrame(() => {
        pullRafRef.current = null;
        setPullRefreshOffset(pendingOffset);
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshBusyRef.current) return;
      if (el.scrollTop > 2) return;
      const node = e.target;
      // 프로필 칩 자체 탭은 보존하되, 상단 영역의 빈 공간에서 당김은 허용
      if (node instanceof Element && node.closest('.profile-chip-btn')) {
        return;
      }
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const PULL_MOVE_GUARD_PX = 14;

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || pullRefreshBusyRef.current) return;
      if (el.scrollTop > 2) {
        tracking = false;
        pendingOffset = 0;
        flushOffset();
        return;
      }
      const dy = e.touches[0].clientY - startY;
      if (dy > PULL_MOVE_GUARD_PX) {
        e.preventDefault();
        pendingOffset = Math.min((dy - PULL_MOVE_GUARD_PX) * 0.48, 88);
        flushOffset();
      } else if (dy > 0) {
        pendingOffset = 0;
        flushOffset();
      } else if (dy < -8) {
        tracking = false;
        pendingOffset = 0;
        flushOffset();
      }
    };

    const endPull = () => {
      if (!tracking) return;
      tracking = false;
      const dist = pendingOffset;
      pendingOffset = 0;
      if (pullRefreshBusyRef.current) {
        flushOffset();
        return;
      }
      if (dist < THRESHOLD) {
        flushOffset();
        return;
      }
      pullRefreshBusyRef.current = true;
      pendingOffset = 44;
      setPullRefreshRefreshing(true);
      flushOffset();
      void (async () => {
        try {
          await onRefreshRef.current();
        } finally {
          pullRefreshBusyRef.current = false;
          setPullRefreshRefreshing(false);
          pendingOffset = 0;
          setPullRefreshOffset(0);
        }
      })();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', endPull);
    el.addEventListener('touchcancel', endPull);
    return () => {
      if (pullRafRef.current != null) cancelAnimationFrame(pullRafRef.current);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', endPull);
      el.removeEventListener('touchcancel', endPull);
    };
  }, [scrollRef, enabled]);

  return {
    pullRefreshOffset,
    pullRefreshRefreshing,
  };
}
