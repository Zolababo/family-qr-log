export type Log = {
  id: string;
  household_id: string;
  /** DB 컬럼명(레거시). 저장 값은 로그 태그 슬러그(`LogSlug`). */
  place_slug: string;
  action: string;
  actor_user_id: string;
  created_at: string;
  image_url?: string | null;
  image_urls?: string | string[] | null;
  video_url?: string | null;
};
