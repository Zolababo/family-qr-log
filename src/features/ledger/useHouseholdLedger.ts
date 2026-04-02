'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { normalizeLedgerCategory } from './ledgerCategoryLabels';
import type { LedgerDirection, LedgerEntry } from './ledgerTypes';

export type { LedgerCategorySlug } from './ledgerCategoryLabels';
export { LEDGER_CATEGORY_SLUGS } from './ledgerCategoryLabels';

type LedgerInput = {
  occurred_on: string;
  direction: LedgerDirection;
  amount_krw: number;
  category: string;
  memo: string;
};

type UseHouseholdLedgerArgs = {
  householdId: string | null;
  userId: string | null | undefined;
  onError: (message: string) => void;
  /** For localized save/delete/update error messages */
  t?: (key: string) => string;
};

export function useHouseholdLedger({ householdId, userId, onError, t }: UseHouseholdLedgerArgs) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const tRef = useRef(t);
  tRef.current = t;

  const tr = useCallback((key: string, fallback: string) => {
    const fn = tRef.current;
    return fn ? fn(key) : fallback;
  }, []);

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
    async (input: LedgerInput) => {
      if (!householdId || !userId) return false;
      if (!Number.isFinite(input.amount_krw) || input.amount_krw <= 0) {
        onErrorRef.current(tr('ledgerInvalidAmount', 'Invalid amount'));
        return false;
      }
      const category = normalizeLedgerCategory(input.category);
      const payload = {
        household_id: householdId,
        user_id: userId,
        occurred_on: input.occurred_on,
        direction: input.direction,
        amount_krw: Math.round(input.amount_krw),
        category,
        memo: input.memo.trim() || null,
      };
      const { data, error } = await supabase.from('ledger_entries').insert(payload).select('*').maybeSingle();
      if (error) {
        onErrorRef.current(`${tr('ledgerErrorSave', 'Save failed')}: ${error.message}`);
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
    [householdId, userId, loadEntries, tr]
  );

  const updateEntry = useCallback(
    async (id: string, input: LedgerInput) => {
      if (!householdId) return false;
      if (!Number.isFinite(input.amount_krw) || input.amount_krw <= 0) {
        onErrorRef.current(tr('ledgerInvalidAmount', 'Invalid amount'));
        return false;
      }
      const category = normalizeLedgerCategory(input.category);
      const patch = {
        occurred_on: input.occurred_on,
        direction: input.direction,
        amount_krw: Math.round(input.amount_krw),
        category,
        memo: input.memo.trim() || null,
      };
      const { data, error } = await supabase
        .from('ledger_entries')
        .update(patch)
        .eq('id', id)
        .eq('household_id', householdId)
        .select('*')
        .maybeSingle();

      if (error) {
        onErrorRef.current(`${tr('ledgerErrorUpdate', 'Update failed')}: ${error.message}`);
        return false;
      }
      if (data) {
        const row = data as LedgerEntry;
        setEntries((prev) => {
          const next = prev.map((e) => (e.id === id ? row : e));
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
    [householdId, loadEntries, tr]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!householdId) return false;
      const { error } = await supabase.from('ledger_entries').delete().eq('id', id).eq('household_id', householdId);
      if (error) {
        onErrorRef.current(`${tr('ledgerErrorDelete', 'Delete failed')}: ${error.message}`);
        return false;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      return true;
    },
    [householdId, tr]
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
    updateEntry,
    deleteEntry,
    monthSummary,
  };
}
