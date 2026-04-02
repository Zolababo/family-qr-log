-- =============================================================================
-- ledger_entries — Supabase Realtime (다른 가족 구성원 변경 즉시 반영)
-- =============================================================================
-- 가계부 탭에서 postgres_changes 구독이 동작하려면 테이블이 realtime publication에
-- 포함되어 있어야 합니다. 한 번만 실행하면 됩니다.
-- (이미 포함돼 있으면 아래 DO 블록은 아무 작업도 하지 않습니다.)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ledger_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
  END IF;
END $$;
