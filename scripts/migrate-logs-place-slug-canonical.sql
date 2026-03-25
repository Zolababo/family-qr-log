-- =============================================================================
-- logs.place_slug 레거시 → canonical 일괄 마이그레이션
-- =============================================================================
-- 목적: DB에 남아 있는 옛 slug(health, fridge 등)를 앱의 canonical slug로 고정합니다.
-- 매핑은 src/lib/logTags.ts 의 normalizeLogSlug 와 동일해야 합니다.
--
-- 실행: Supabase 대시보드 → SQL Editor → 아래 전체 실행 (한 번이면 충분, 재실행해도 무방)
--
-- 주의: RLS가 UPDATE를 막으면 postgres/service role로 실행하거나, 정책에서 본인 household
--       로그 수정이 허용되는지 확인하세요. SQL Editor는 보통 충분한 권한으로 동작합니다.
-- =============================================================================

-- 멤버형 레거시 토픽
UPDATE public.logs SET place_slug = 'daddy' WHERE place_slug = 'health';
UPDATE public.logs SET place_slug = 'mommy' WHERE place_slug = 'diet';
UPDATE public.logs SET place_slug = 'bamtoli' WHERE place_slug = 'kid';
UPDATE public.logs SET place_slug = 'eomni_abuji' WHERE place_slug = 'outing';
UPDATE public.logs SET place_slug = 'motheri_ppadeori' WHERE place_slug = 'parking';

-- 장소형 레거시(단이네/우차차/똘모닝에 대응하던 값)
UPDATE public.logs SET place_slug = 'danine' WHERE place_slug = 'fridge';
UPDATE public.logs SET place_slug = 'uchacha' WHERE place_slug = 'table';
UPDATE public.logs SET place_slug = 'ttol_morning' WHERE place_slug = 'toilet';

-- 예전 앱에만 있던 토픽(현재 canonical에 없음 → 다같이)
UPDATE public.logs SET place_slug = 'general' WHERE place_slug = 'pet';

-- =============================================================================
-- (선택) 위 매핑에 없는 이상값을 general 로 모을 때만 사용. 실행 전 백업 권장.
-- =============================================================================
-- UPDATE public.logs
-- SET place_slug = 'general'
-- WHERE place_slug IS NOT NULL
--   AND place_slug NOT IN (
--     'general', 'notice', 'daddy', 'mommy', 'bamtoli', 'eomni_abuji', 'motheri_ppadeori',
--     'danine', 'uchacha', 'ttol_morning', 'todo'
--   );

-- 검증용 (실행 후 남은 레거시 개수 확인 — 모두 0이면 성공)
-- SELECT place_slug, COUNT(*) AS n
-- FROM public.logs
-- WHERE place_slug IN (
--   'health','diet','kid','outing','parking','fridge','table','toilet','pet'
-- )
-- GROUP BY place_slug;
