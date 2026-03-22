-- Supabase SQL Editor에서 한 번 실행: 가족 공지·장보기 메모를 가족 전체와 동기화
-- household_memos 테이블이 이미 있고 content 컬럼만 있을 때

ALTER TABLE household_memos ADD COLUMN IF NOT EXISTS family_notice TEXT;
ALTER TABLE household_memos ADD COLUMN IF NOT EXISTS shopping_list TEXT;
