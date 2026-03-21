/** DB `logs.place_slug` + UI 필터용 슬러그 (v2) */
export const LOG_SLUG = {
  general: 'general',
  fridge: 'fridge',
  table: 'table',
  toilet: 'toilet',
  health: 'health',
  diet: 'diet',
  kid: 'kid',
  pet: 'pet',
  todo: 'todo',
  outing: 'outing',
  parking: 'parking',
} as const;

export type LogSlug = (typeof LOG_SLUG)[keyof typeof LOG_SLUG];
export type LogFilterKey = LogSlug | 'all';

/** 목록 필터·피드: 장소 칩 제거 후 주제 + 외출/주차 */
export const TOPIC_SLUGS: LogSlug[] = ['health', 'diet', 'kid', 'outing', 'parking'];

/** 레거시 로그 표시용 (냉장고 등) */
export const PLACE_SLUGS: LogSlug[] = ['fridge', 'table', 'toilet'];

/** 현재 시각 기준 추천 태그 (선택만, 강제 아님) */
export function getSuggestedSlugsByHour(): { slug: LogSlug; reason: 'morning' | 'evening' | 'night' }[] {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return [{ slug: 'table', reason: 'morning' }];
  if (h >= 18 && h < 23) return [{ slug: 'table', reason: 'evening' }];
  if (h >= 23 || h < 6) return [{ slug: 'general', reason: 'night' }];
  return [];
}

export function filterSlugForQuery(filter: LogFilterKey): string | undefined {
  if (filter === 'all') return undefined;
  return filter;
}
