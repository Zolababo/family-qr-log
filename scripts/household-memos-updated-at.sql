-- =============================================================================
-- household_memos.updated_at (원격 메모 동기화 순서용)
-- =============================================================================
-- 앱은 이 타임스탬프로 “원격이 더 최신인지” 판별합니다. 컬럼이 없으면 추가합니다.
-- (이미 있으면 ADD COLUMN 은 무시됩니다.)
-- =============================================================================

ALTER TABLE public.household_memos
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.household_memos SET updated_at = COALESCE(updated_at, NOW());

-- 행 수정 시마다 updated_at 자동 갱신(앱의 원격/로컬 순서 판별에 사용)
CREATE OR REPLACE FUNCTION public.touch_household_memos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_memos_touch_updated_at ON public.household_memos;
CREATE TRIGGER trg_household_memos_touch_updated_at
  BEFORE UPDATE ON public.household_memos
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_household_memos_updated_at();
