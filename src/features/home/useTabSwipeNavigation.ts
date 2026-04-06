'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { BOTTOM_TAB_ORDER, type TabId } from '../../components/layout/BottomTabBar';

/** 오른쪽 가장자리 — FamilyMemoPanel 엣지 스와이프와 겹치지 않게 탭 스와이프 비활성 (px) */
const RIGHT_EDGE_EXCLUDE_PX = 42;
const MIN_HORIZONTAL_PX = 72;
/** 가로 이동이 세로보다 충분히 커야 탭 전환 (세로 스크롤·당겨서 새로고침과 구분) */
const HORIZONTAL_DOMINANCE = 1.45;

function shouldIgnoreSwipeStart(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        'input',
        'textarea',
        'select',
        '[data-tab-swipe-ignore]',
        '.member-filter-scroll',
        '.home-chip-scroll-snap',
        '.calendar-tag-filter-row',
      ].join(', ')
    )
  );
}

type UseTabSwipeNavigationArgs = {
  scrollRef: RefObject<HTMLDivElement | null>;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  enabled: boolean;
};

/**
 * 메인 세로 스크롤 영역에서 좌·우 스와이프로 하단 탭 순서대로 이동.
 * 오른쪽 끝 가장자리 터치는 메모 패널 열기 제스처에 맡김.
 */
export function useTabSwipeNavigation({ scrollRef, activeTab, onTabChange, enabled }: UseTabSwipeNavigationArgs) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const activeTabRef = useRef(activeTab);
  const onTabChangeRef = useRef(onTabChange);
  activeTabRef.current = activeTab;
  onTabChangeRef.current = onTabChange;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) {
      startRef.current = null;
      return;
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > window.innerWidth - RIGHT_EDGE_EXCLUDE_PX) return;
      if (shouldIgnoreSwipeStart(e.target)) return;
      startRef.current = { x: t.clientX, y: t.clientY };
    };

    const onEnd = (e: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < MIN_HORIZONTAL_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return;

      const current = activeTabRef.current;
      const idx = BOTTOM_TAB_ORDER.indexOf(current);
      if (idx < 0) return;

      if (dx < 0) {
        if (idx < BOTTOM_TAB_ORDER.length - 1) onTabChangeRef.current(BOTTOM_TAB_ORDER[idx + 1]!);
      } else {
        if (idx > 0) onTabChangeRef.current(BOTTOM_TAB_ORDER[idx - 1]!);
      }
    };

    const onCancel = () => {
      startRef.current = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [enabled, scrollRef]);
}
