export type LedgerDirection = 'income' | 'expense';

export type LedgerEntry = {
  id: string;
  household_id: string;
  user_id: string;
  occurred_on: string;
  direction: LedgerDirection;
  amount_krw: number;
  category: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};
