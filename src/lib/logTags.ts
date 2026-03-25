/** DB `logs.place_slug` + UI 필터용 슬러그 (v2) */
export const LOG_SLUG = {
  general: 'general',
  notice: 'notice',
  daddy: 'daddy',
  mommy: 'mommy',
  bamtoli: 'bamtoli',
  eomniAbuji: 'eomni_abuji',
  motheriPpadeori: 'motheri_ppadeori',
  danine: 'danine',
  uchacha: 'uchacha',
  ttolMorning: 'ttol_morning',
  todo: 'todo',
} as const;

export type LogSlug = (typeof LOG_SLUG)[keyof typeof LOG_SLUG];
export type LogFilterKey = LogSlug | 'all';

/** 목록 필터·피드 상단 5개 멤버 태그 */
export const TOPIC_SLUGS: LogSlug[] = ['daddy', 'mommy', 'bamtoli', 'eomni_abuji', 'motheri_ppadeori'];

/**
 * 예전 배포에서 저장된 레거시 place_slug를
 * 현재 멤버 태그 체계로 정규화합니다.
 */
export function normalizeLogSlug(slug: string | null | undefined): LogSlug {
  switch (slug) {
    case LOG_SLUG.general:
    case LOG_SLUG.notice:
    case LOG_SLUG.daddy:
    case LOG_SLUG.mommy:
    case LOG_SLUG.bamtoli:
    case LOG_SLUG.eomniAbuji:
    case LOG_SLUG.motheriPpadeori:
    case LOG_SLUG.danine:
    case LOG_SLUG.uchacha:
    case LOG_SLUG.ttolMorning:
    case LOG_SLUG.todo:
      return slug;
    // legacy member-like topics
    case 'health':
      return LOG_SLUG.daddy;
    case 'diet':
      return LOG_SLUG.mommy;
    case 'kid':
      return LOG_SLUG.bamtoli;
    case 'outing':
      return LOG_SLUG.eomniAbuji;
    case 'parking':
      return LOG_SLUG.motheriPpadeori;
    // legacy place-like topics
    case 'fridge':
      return LOG_SLUG.danine;
    case 'table':
      return LOG_SLUG.uchacha;
    case 'toilet':
      return LOG_SLUG.ttolMorning;
    default:
      return LOG_SLUG.general;
  }
}

/** 현재 시각 기준 추천 태그 (선택만, 강제 아님) */
export function getSuggestedSlugsByHour(): { slug: LogSlug; reason: 'morning' | 'evening' | 'night' }[] {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return [{ slug: 'uchacha', reason: 'morning' }];
  if (h >= 18 && h < 23) return [{ slug: 'uchacha', reason: 'evening' }];
  if (h >= 23 || h < 6) return [{ slug: 'general', reason: 'night' }];
  return [];
}

export function filterSlugForQuery(filter: LogFilterKey): string | undefined {
  if (filter === 'all') return undefined;
  return filter;
}
