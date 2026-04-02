'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import type { LedgerDirection, LedgerEntry } from './ledgerTypes';

export const LEDGER_CATEGORY_PRESETS = ['식비', '교통', '쇼핑', '의료', '교육', '구독', '급여', '기타'] as const;

type UseHouseholdLedgerArgs = {
  householdId: string | null;
  userId: string | null | undefined;
  onError: (message: string) => void;
};

export function useHouseholdLedger({ householdId, userId, onError }: UseHouseholdLedgerArgs) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const loadEntries = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('household_id', householdId)
        .order('occurred_on', { ascending: false })
        .limit(300);

      if (error) {
        onErrorRef.current(error.message);
        setEntries([]);
        return;
      }
      const rows = (data ?? []) as LedgerEntry[];
      rows.sort((a, b) => {
        const d = b.occurred_on.localeCompare(a.occurred_on);
        if (d !== 0) return d;
        return b.created_at.localeCompare(a.created_at);
      });
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const addEntry = useCallback(
    async (input: {
      occurred_on: string;
      direction: LedgerDirection;
      amount_krw: number;
      category: string;
      memo: string;
    }) => {
      if (!householdId || !userId) return false;
      if (!Number.isFinite(input.amount_krw) || input.amount_krw <= 0) {
        onErrorRef.current('금액을 확인해 주세요.');
        return false;
      }
      const payload = {
        household_id: householdId,
        user_id: userId,
        occurred_on: input.occurred_on,
        direction: input.direction,
        amount_krw: Math.round(input.amount_krw),
        category: input.category.trim() || '기타',
        memo: input.memo.trim() || null,
      };
      const { data, error } = await supabase.from('ledger_entries').insert(payload).select('*').maybeSingle();
      if (error) {
        onErrorRef.current(`가계부 저장 실패: ${error.message}`);
        return false;
      }
      if (data) {
        setEntries((prev) => {
          const next = [data as LedgerEntry, ...prev];
          next.sort((a, b) => {
            const d = b.occurred_on.localeCompare(a.occurred_on);
            if (d !== 0) return d;
            return b.created_at.localeCompare(a.created_at);
          });
          return next;
        });
      } else {
        await loadEntries();
      }
      return true;
    },
    [householdId, userId, loadEntries]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!householdId) return false;
      const { error } = await supabase.from('ledger_entries').delete().eq('id', id).eq('household_id', householdId);
      if (error) {
        onErrorRef.current(`삭제 실패: ${error.message}`);
        return false;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      return true;
    },
    [householdId]
  );

  const monthSummary = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const prefix = `${y}-${String(m).padStart(2, '0')}`;
    let income = 0;
    let expense = 0;
    for (const e of entries) {
      if (!e.occurred_on.startsWith(prefix)) continue;
      if (e.direction === 'income') income += e.amount_krw;
      else expense += e.amount_krw;
    }
    return { income, expense, balance: income - expense, year: y, month: m };
  }, [entries]);

  return {
    entries,
    loading,
    loadEntries,
    addEntry,
    deleteEntry,
    monthSummary,
  };
}
