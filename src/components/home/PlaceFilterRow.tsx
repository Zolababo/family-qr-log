'use client';

import type { LogFilterKey } from '../../lib/logTags';
import { LOG_SLUG, TOPIC_SLUGS } from '../../lib/logTags';

type PlaceFilterRowProps = {
  filter: LogFilterKey;
  setFilter: (v: LogFilterKey) => void;
  t: (key: string) => string;
  highContrast: boolean;
};

const chip = (
  active: boolean,
  border: string,
  bg: string,
  color: string,
  highContrast: boolean
) => ({
  padding: '5px 10px',
  borderRadius: 10,
  border: `1px solid ${active ? border : '#e2e8f0'}`,
  background: active ? bg : highContrast ? '#1e1e1e' : '#f8fafc',
  color: active ? color : highContrast ? '#94a3b8' : '#64748b',
  fontSize: 11,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
});

export function PlaceFilterRow({ filter, setFilter, t: _t, highContrast }: PlaceFilterRowProps) {
  const memberLikeTags: { key: LogFilterKey; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: LOG_SLUG.general, label: '다같이' },
    { key: TOPIC_SLUGS[0], label: '밤톨대디' },
    { key: TOPIC_SLUGS[1], label: '밤톨맘' },
    { key: TOPIC_SLUGS[2], label: '밤톨이' },
    { key: TOPIC_SLUGS[3], label: '엄니아부지' },
    { key: TOPIC_SLUGS[4], label: '마더리빠더리' },
    { key: LOG_SLUG.fridge, label: '단이네 우차차' },
    { key: LOG_SLUG.table, label: '똘모닝' },
  ];

  return (
    <div style={{ marginTop: 4, marginBottom: 6, width: '100%' }}>
      <div
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
        {memberLikeTags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            className="log-filter-btn"
            onClick={() => setFilter(tag.key)}
            style={chip(filter === tag.key, 'var(--accent)', 'var(--accent-light)', 'var(--accent)', highContrast)}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
