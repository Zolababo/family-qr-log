-- =============================================================================
-- ledger_entries — 가족 가계부 (수입·지출)
-- =============================================================================
-- 실행: Supabase SQL Editor (스테이징 먼저 권장). 백업 후 적용.
-- 앱: HomeClient 가계부 탭 → supabase.from('ledger_entries')
--
-- 다음 단계(선택, 가족 간 즉시 동기화): 이 스크립트 적용 후
--   scripts/enable-ledger-realtime-publication.sql 실행
-- 문서: MIGRATION.md §2-6, DEPLOY.md §7
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  user_id UUID NOT NULL,
  occurred_on DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  amount_krw BIGINT NOT NULL CHECK (amount_krw > 0),
  category TEXT NOT NULL DEFAULT '기타',
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_household_occurred_idx
  ON public.ledger_entries (household_id, occurred_on DESC);

COMMENT ON TABLE public.ledger_entries IS 'Household ledger entries (KRW, income/expense)';

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO authenticated;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ledger_entries'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ledger_entries', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "ledger_entries_select_member"
ON public.ledger_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = ledger_entries.household_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "ledger_entries_insert_member"
ON public.ledger_entries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = ledger_entries.household_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "ledger_entries_update_member"
ON public.ledger_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = ledger_entries.household_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = ledger_entries.household_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "ledger_entries_delete_member"
ON public.ledger_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.household_id = ledger_entries.household_id
      AND m.user_id = auth.uid()
  )
);
