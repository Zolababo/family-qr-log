'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { normalizeLedgerCategory } from './ledgerCategoryLabels';
import type { LedgerDirection, LedgerEntry } from './ledgerTypes';

export type { LedgerCategorySlug } from './ledgerCategoryLabels';

const LEDGER_INITIAL_LIMIT = 300;
/** 병합된 로컬 캐시 상한 (나중에 조정 가능) */
const LEDGER_MERGED_MAX = 5000;

function sortLedger(rows: LedgerEntry[]): LedgerEntry[] {
  const next = [...rows];
  next.sort((a, b) => {
    const d = b.occurred_on.localeCompare(a.occurred_on);
    if (d !== 0) return d;
    return b.created_at.localeCompare(a.created_at);
  });
  return next.slice(0, LEDGER_MERGED_MAX);
}

function mergeMonthIntoEntries(prev: LedgerEntry[], y: number, m: number, monthRows: LedgerEntry[]): LedgerEntry[] {
  const prefix = `${y}-${String(m).padStart(2, '0')}`;
  const rest = prev.filter((e) => !e.occurred_on.startsWith(prefix));
  const byId = new Map<string, LedgerEntry>();
  for (const e of rest) byId.set(e.id, e);
  for (const e of monthRows) byId.set(e.id, e);
  return sortLedger([...byId.values()]);
}

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
  const [ledgerReady, setLedgerReady] = useState(false);
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
        .limit(LEDGER_INITIAL_LIMIT);

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
      setLedgerReady(true);
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      setEntries([]);
      setLedgerReady(false);
      return;
    }
    setLedgerReady(false);
    void loadEntries();
  }, [householdId, loadEntries]);

  const loadMonthEntries = useCallback(
    async (y: number, m: number) => {
      if (!householdId) return;
      const prefix = `${y}-${String(m).padStart(2, '0')}`;
      const start = `${prefix}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${prefix}-${String(lastDay).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('household_id', householdId)
        .gte('occurred_on', start)
        .lte('occurred_on', end)
        .order('occurred_on', { ascending: false })
        .limit(LEDGER_MERGED_MAX);

      if (error) {
        onErrorRef.current(error.message);
        return;
      }
      const monthRows = (data ?? []) as LedgerEntry[];
      setEntries((prev) => mergeMonthIntoEntries(prev, y, m, monthRows));
    },
    [householdId]
  );

  useEffect(() => {
    if (!householdId) return;

    const applyRow = (row: LedgerEntry) => {
      setEntries((prev) => {
        const map = new Map(prev.map((e) => [e.id, e]));
        map.set(row.id, row);
        return sortLedger([...map.values()]);
      });
    };

    const channel = supabase
      .channel(`ledger-entries-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ledger_entries',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string } | null)?.id;
            if (id) {
              setEntries((prev) => sortLedger(prev.filter((e) => e.id !== id)));
            }
            return;
          }
          const row = payload.new as LedgerEntry | null;
          if (row?.id) applyRow(row);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId]);

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
        const row = data as LedgerEntry;
        setEntries((prev) => {
          const map = new Map(prev.map((e) => [e.id, e]));
          map.set(row.id, row);
          return sortLedger([...map.values()]);
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
        setEntries((prev) => sortLedger(prev.map((e) => (e.id === id ? row : e))));
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

  return {
    entries,
    loading,
    ledgerReady,
    loadEntries,
    loadMonthEntries,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
