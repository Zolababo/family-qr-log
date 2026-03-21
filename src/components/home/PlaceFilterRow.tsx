'use client';

type PlaceKey = 'fridge' | 'table' | 'toilet' | 'all';

type PlaceFilterRowProps = {
  placeViewFilter: PlaceKey;
  setPlaceViewFilter: (v: PlaceKey) => void;
  t: (key: string) => string;
  highContrast: boolean;
};

export function PlaceFilterRow({
  placeViewFilter,
  setPlaceViewFilter,
  t,
  highContrast,
}: PlaceFilterRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
        marginBottom: 6,
        justifyContent: 'center',
      }}
    >
      {[
        { key: 'fridge' as const, labelKey: 'fridge' as const, bg: 'var(--place-fridge)', border: 'var(--place-fridge-icon)', color: 'var(--place-fridge-icon)' },
        { key: 'table' as const, labelKey: 'table' as const, bg: 'var(--place-table)', border: 'var(--place-table-icon)', color: 'var(--place-table-icon)' },
        { key: 'toilet' as const, labelKey: 'toilet' as const, bg: 'var(--place-toilet)', border: 'var(--place-toilet-icon)', color: 'var(--place-toilet-icon)' },
        { key: 'all' as const, labelKey: 'allPlaces' as const, bg: 'var(--bg-subtle)', border: 'var(--text-caption)', color: 'var(--text-secondary)' },
      ].map(({ key, labelKey, bg, border, color }) => {
        const active = placeViewFilter === key;
        return (
          <button
            className="log-filter-btn"
            key={key}
            type="button"
            onClick={() => setPlaceViewFilter(key)}
            style={{
              padding: '4px 10px',
              borderRadius: 10,
              border: `1px solid ${active ? border : '#e2e8f0'}`,
              background: active ? bg : highContrast ? '#1e1e1e' : '#f8fafc',
              color: active ? color : highContrast ? '#94a3b8' : '#64748b',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
