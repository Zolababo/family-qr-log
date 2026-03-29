-- =============================================================================
-- household_memos RLS — 가족 메모(루틴·공지·장보기) 동일 household 구성원만
-- =============================================================================
-- 앱: HomeClient → supabase.from('household_memos').upsert(..., onConflict: 'household_id')
-- 선행(없으면 실행): scripts/add-household-memos-board-columns.sql
--                  scripts/household-memos-updated-at.sql (+ 트리거 권장)
--
-- 실행: Supabase SQL Editor에서 한 번(스테이징 먼저 권장). 백업 후 적용.
-- Realtime: Dashboard → Database → Replication 에서 household_memos 포함 여부 확인.
-- =============================================================================

ALTER TABLE public.household_memos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_memos TO authenticated;

-- upsert(onConflict: household_id) 는 household_id 에 UNIQUE 또는 PK 가 있어야 합니다(기존 스키마 확인).

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'household_memos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.household_memos', p.policyname);
  END LOOP;
END $$;

-- SELECT: 내가 속한 household의 행만
CREATE POLICY "household_memos_select_member"
ON public.household_memos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = household_memos.household_id
      AND m.user_id = auth.uid()
  )
);

-- INSERT: 본인 household에만 행 추가
CREATE POLICY "household_memos_insert_member"
ON public.household_memos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = household_memos.household_id
      AND m.user_id = auth.uid()
  )
);

-- UPDATE: 동일 household 구성원만
CREATE POLICY "household_memos_update_member"
ON public.household_memos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = household_memos.household_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = household_memos.household_id
      AND m.user_id = auth.uid()
  )
);

-- DELETE: 필요 시에만(앱은 주로 upsert). 정리·관리용.
CREATE POLICY "household_memos_delete_member"
ON public.household_memos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = household_memos.household_id
      AND m.user_id = auth.uid()
  )
);
