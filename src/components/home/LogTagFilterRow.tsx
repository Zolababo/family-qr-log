'use client';

type LogTagFilterRowProps = {
  filter: string;
  setFilter: (v: string) => void;
  options: { key: string; label: string }[];
  t: (key: string) => string;
  highContrast: boolean;
  /** 보조 설명 문단 `id` — 스크린 리더 연결용 */
  ariaDescribedBy?: string;
};

const chip = (active: boolean, highContrast: boolean) => ({
  flexShrink: 0,
  padding: '6px 12px',
  borderRadius: 999,
  border: active ? '1px solid var(--accent)' : '1px solid var(--divider)',
  background: active ? 'var(--accent-light)' : highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
  color: active ? 'var(--accent)' : highContrast ? '#94a3b8' : 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
});

/** 피드 상단: 전체 / 로그 태그 슬러그별 필터 칩 */
export function LogTagFilterRow({ filter, setFilter, options, t: _t, highContrast, ariaDescribedBy }: LogTagFilterRowProps) {
  return (
    <div style={{ marginTop: 0, marginBottom: 4, width: '100%' }}>
      <div
        className="horizontal-scroll-hide home-chip-scroll-snap"
        {...(ariaDescribedBy ? ({ role: 'group' as const, 'aria-describedby': ariaDescribedBy } as const) : {})}
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          gap: 6,
          justifyContent: 'flex-start',
          alignItems: 'center',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 2,
        }}
      >
        {options.map((tag) => (
          <button
            key={tag.key}
            type="button"
            className="log-filter-btn"
            onClick={() => setFilter(tag.key)}
            style={chip(filter === tag.key, highContrast)}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
