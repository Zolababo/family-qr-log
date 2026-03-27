-- =============================================================================
-- 프로덕션 RLS 점검 체크리스트 (코드 리뷰용 — 실행 전 백업)
-- =============================================================================
-- 목적: Supabase 대시보드에서 정책이 “최소 권한”인지 빠르게 확인합니다.
-- 실제 정책은 프로젝트 스키마에 맞게 조정해야 합니다.
--
-- 이미 적용한 스크립트:
--   scripts/enable-log-comments-rls-policies.sql  → log_comments
--
-- 확인 순서:
-- 1) 아래 쿼리로 RLS 활성화·정책 목록 확인
-- 2) members: 임의 household_id 자가 가입 INSERT 차단 여부
-- 3) logs / household_memos: household_id 스코프
-- 4) storage.objects: 공개 읽기 의도 여부
-- =============================================================================

-- RLS 켜진 테이블
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 정책 요약
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 위험 신호: USING (true) / WITH CHECK (true) 만 있는 overly-broad 정책은 수동 검토
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND (qual::text = 'true' OR with_check::text = 'true');

-- =============================================================================
-- 권장 방향 (요약)
-- =============================================================================
-- members:
--   - SELECT: 본인 household 구성원 조회
--   - INSERT: 서비스 롤 또는 초대 토큰 검증 후에만 (클라이언트 직접 INSERT는 제한 검토)
-- logs:
--   - SELECT/INSERT/UPDATE/DELETE: 동일 household 내, RLS로 household_id 제한
-- household_memos:
--   - SELECT/UPSERT: 동일 household
-- storage:
--   - bucket별 path에 household_id 또는 user_id 포함, SELECT/INSERT 제한
-- =============================================================================
