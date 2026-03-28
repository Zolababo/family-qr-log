-- =============================================================================
-- log_comments RLS 정책 정비 (수정/삭제 불가 이슈 대응)
-- =============================================================================
-- 목적:
-- 1) 본인 댓글은 본인만 INSERT / UPDATE / DELETE 가능
-- 2) 같은 household의 로그 댓글은 구성원 모두 SELECT 가능
--
-- 실행:
-- Supabase SQL Editor에서 전체 실행
-- =============================================================================

ALTER TABLE public.log_comments ENABLE ROW LEVEL SECURITY;

-- 권한 누락 방지 (RLS와 별개로 table privilege도 필요)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_comments TO authenticated;

-- 기존 정책명이 제각각일 수 있어 전체 정책을 먼저 정리
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'log_comments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.log_comments', p.policyname);
  END LOOP;
END $$;

-- SELECT: 댓글이 달린 로그가 내 household에 속하면 조회 허용
CREATE POLICY "log_comments_select_household"
ON public.log_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.logs l
    JOIN public.members m ON m.household_id = l.household_id
    WHERE l.id = log_comments.log_id
      AND m.user_id = auth.uid()
  )
);

-- INSERT: 본인 user_id + 대상 로그가 내 household 소속일 때만 (임의 log_id 삽입 방지)
CREATE POLICY "log_comments_insert_own"
ON public.log_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.logs l
    JOIN public.members m ON m.household_id = l.household_id
    WHERE l.id = log_comments.log_id
      AND m.user_id = auth.uid()
  )
);

-- UPDATE: 본인 댓글이며 해당 로그가 내 household 소속
CREATE POLICY "log_comments_update_own"
ON public.log_comments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.logs l
    JOIN public.members m ON m.household_id = l.household_id
    WHERE l.id = log_comments.log_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (user_id = auth.uid());

-- DELETE: 본인 댓글이며 해당 로그가 내 household 소속
CREATE POLICY "log_comments_delete_own"
ON public.log_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.logs l
    JOIN public.members m ON m.household_id = l.household_id
    WHERE l.id = log_comments.log_id
      AND m.user_id = auth.uid()
  )
);

-- 선택: 정책 목록 확인
-- SELECT policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'log_comments'
-- ORDER BY policyname;

