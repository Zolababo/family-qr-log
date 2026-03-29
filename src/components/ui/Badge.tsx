'use client';

import type { ButtonHTMLAttributes } from 'react';

export type LogTagBadgeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'type'> & {
  slug: string;
  children: React.ReactNode;
};

/** 로그 카드·검색 목록의 태그 칩 — `globals.css` `.log-tag-chip` + 슬러그별 색 */
export function LogTagBadge({ slug, children, style, ...rest }: LogTagBadgeProps) {
  return (
    <button type="button" className={`log-tag-chip ${slug}`} style={{ border: 'none', cursor: 'pointer', ...style }} {...rest}>
      {children}
    </button>
  );
}
