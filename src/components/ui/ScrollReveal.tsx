'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

type ScrollRevealProps = {
  scrollRootRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * 스크롤 컨테이너 기준으로 섹션이 들어올 때만 아주 약하게 페이드 + 살짝 위로 이동.
 * prefers-reduced-motion 이면 즉시 표시(전환 없음).
 */
export function ScrollReveal({ scrollRootRef, children, className, style }: ScrollRevealProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (prefersReducedMotion) setShown(true);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const root = scrollRootRef.current;
    const el = innerRef.current;
    if (!root || !el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      {
        root,
        threshold: [0, 0.08, 0.15],
        rootMargin: '0px 0px -8px 0px',
      }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRootRef, prefersReducedMotion]);

  const instant = prefersReducedMotion;
  const revealStyle: CSSProperties = {
    opacity: shown ? 1 : instant ? 1 : 0,
    transform: shown ? 'translateY(0)' : instant ? 'none' : 'translateY(10px)',
    transition: instant ? 'none' : 'opacity 0.42s ease-out, transform 0.42s ease-out',
    ...style,
  };

  return (
    <div ref={innerRef} className={className} style={revealStyle}>
      {children}
    </div>
  );
}
