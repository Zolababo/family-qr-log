'use client';

import type { LogFilterKey } from '../../lib/logTags';
import { LOG_SLUG, PLACE_SLUGS, TOPIC_SLUGS } from '../../lib/logTags';

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

export function PlaceFilterRow({ filter, setFilter, t, highContrast }: PlaceFilterRowProps) {
  const placeStyle = (slug: string) => {
    switch (slug) {
      case 'fridge':
        return { bg: 'var(--place-fridge)', border: 'var(--place-fridge-icon)', color: 'var(--place-fridge-icon)' };
      case 'table':
        return { bg: 'var(--place-table)', border: 'var(--place-table-icon)', color: 'var(--place-table-icon)' };
      case 'toilet':
        return { bg: 'var(--place-toilet)', border: 'var(--place-toilet-icon)', color: 'var(--place-toilet-icon)' };
      default:
        return { bg: 'var(--bg-subtle)', border: 'var(--text-caption)', color: 'var(--text-secondary)' };
    }
  };

  const topicStyle = (slug: string) => ({
    bg: 'var(--accent-light)',
    border: 'var(--accent)',
    color: 'var(--accent)',
  });

  return (
    <div style={{ marginTop: 4, marginBottom: 6, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          className="log-filter-btn"
          onClick={() => setFilter('all')}
          style={chip(filter === 'all', 'var(--text-caption)', 'var(--bg-subtle)', 'var(--text-secondary)', highContrast)}
        >
          {t('allPlaces')}
        </button>
        <button
          type="button"
          className="log-filter-btn"
          onClick={() => setFilter(LOG_SLUG.general)}
          style={chip(filter === LOG_SLUG.general, 'var(--accent)', 'var(--accent-light)', 'var(--accent)', highContrast)}
        >
          {t('logGeneral')}
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: 'center',
          marginTop: 6,
        }}
      >
        {TOPIC_SLUGS.map((slug) => {
          const st = topicStyle(slug);
          const labelKey =
            slug === 'health'
              ? 'topicHealth'
              : slug === 'diet'
                ? 'topicDiet'
                : slug === 'kid'
                  ? 'topicKid'
                  : slug === 'pet'
                    ? 'topicPet'
                    : 'topicTodo';
          return (
            <button
              key={slug}
              type="button"
              className="log-filter-btn"
              onClick={() => setFilter(slug)}
              style={chip(filter === slug, st.border, st.bg, st.color, highContrast)}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: 'center',
          marginTop: 6,
        }}
      >
        {PLACE_SLUGS.map((slug) => {
          const st = placeStyle(slug);
          const labelKey = slug === 'fridge' ? 'fridge' : slug === 'table' ? 'table' : 'toilet';
          return (
            <button
              key={slug}
              type="button"
              className="log-filter-btn"
              onClick={() => setFilter(slug)}
              style={chip(filter === slug, st.border, st.bg, st.color, highContrast)}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
