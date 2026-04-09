-- =============================================================================
-- ledger_entries.payment_method 추가
-- =============================================================================
-- 실행: Supabase SQL Editor
-- 목적: 가계부 결제수단(카드/현금/상품권/경기지역화폐/기타) 저장
-- =============================================================================

ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ledger_entries_payment_method_check'
      AND conrelid = 'public.ledger_entries'::regclass
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT ledger_entries_payment_method_check
      CHECK (payment_method IN ('card', 'cash', 'gift', 'gglocal', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.ledger_entries.payment_method
IS 'payment method: card|cash|gift|gglocal|other';
