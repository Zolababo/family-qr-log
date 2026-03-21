'use client';

import { Snowflake, Utensils, Bath, Plus } from 'lucide-react';

export type PlaceItem = {
  id: string;
  labelKey: string;
  icon?: string;
  color: string;
};

const ICON_SIZE = 17;
const STROKE = 1.5;

type PlaceButtonsProps = {
  places?: PlaceItem[];
  onSelectPlace: (id: string) => void;
  t: (key: string) => string;
  highContrast?: boolean;
  isAdmin?: boolean;
};

const DEFAULT_PLACES: PlaceItem[] = [
  { id: 'fridge', labelKey: 'fridge', color: 'var(--place-1)' },
  { id: 'table', labelKey: 'table', color: 'var(--place-2)' },
  { id: 'toilet', labelKey: 'toilet', color: 'var(--place-3)' },
];

function PlaceIcon({ placeId }: { placeId: string }) {
  switch (placeId) {
    case 'fridge':
      return <Snowflake size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />;
    case 'table':
      return <Utensils size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />;
    case 'toilet':
      return <Bath size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />;
    default:
      return null;
  }
}

const pillButtonStyle = (backgroundColor: string, highContrast?: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  borderRadius: 999,
  border: 'none',
  background: highContrast ? 'var(--bg-subtle)' : backgroundColor,
  color: highContrast ? 'var(--text-primary)' : 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

export function PlaceButtons({
  places = DEFAULT_PLACES,
  onSelectPlace,
  t,
  highContrast,
  isAdmin,
}: PlaceButtonsProps) {
  return (
    <section style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          overflowX: 'auto',
          flexWrap: 'nowrap',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {places.map((place) => (
          <button
            className="place-pill-btn"
            key={place.id}
            type="button"
            style={pillButtonStyle(place.color, highContrast)}
            onClick={() => onSelectPlace(place.id)}
          >
            <PlaceIcon placeId={place.id} />
            <span>{t(place.labelKey)}</span>
          </button>
        ))}
        {isAdmin && (
          <button
            className="place-pill-btn"
            type="button"
            style={pillButtonStyle('var(--bg-subtle)', highContrast)}
            aria-label="장소 추가"
          >
            <Plus size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
            <span>추가</span>
          </button>
        )}
      </div>
    </section>
  );
}
