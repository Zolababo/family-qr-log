'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { normalizeLogSlug } from '@/lib/logTags';
import type { Log } from './logTypes';

type UseHouseholdLogsArgs = {
  householdId: string | null;
  userId: string | null | undefined;
  excludedActionPrefixes: string[];
  onError: (message: string) => void;
};

type UseHouseholdLogsResult = {
  logs: Log[];
  setLogs: Dispatch<SetStateAction<Log[]>>;
  logsInitialLoading: boolean;
  loadLogs: (householdId: string, slug?: string, actorUserId?: string) => Promise<void>;
  refreshLogs: () => void;
};

export function useHouseholdLogs({
  householdId,
  userId,
  excludedActionPrefixes,
  onError,
}: UseHouseholdLogsArgs): UseHouseholdLogsResult {
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsInitialLoading, setLogsInitialLoading] = useState(false);
  const loadLogsReqSeqRef = useRef(0);
  const initialLogsLoadGenRef = useRef(0);

  const loadLogs = useCallback(
    async (hid: string, _slug?: string, actorUserId?: string) => {
      const reqSeq = ++loadLogsReqSeqRef.current;
      let query = supabase.from('logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(5000);

      for (const prefix of excludedActionPrefixes) {
        query = query.not('action', 'like', `${prefix}%`);
      }

      // place_slug 서버 필터 대신 항상 전체 로그를 가져온 뒤 클라이언트에서 필터링합니다.
      if (actorUserId) {
        query = query.eq('actor_user_id', actorUserId);
      }

      const { data, error } = await query;
      if (reqSeq !== loadLogsReqSeqRef.current) return;

      if (error) {
        onError(`logs 조회 실패: ${error.message}`);
        return;
      }

      const rows = (data ?? []).map((row) => ({
        ...(row as Log),
        place_slug: normalizeLogSlug((row as Log).place_slug),
      }));
      setLogs(rows);
    },
    [excludedActionPrefixes, onError]
  );

  useEffect(() => {
    if (!householdId || !userId) {
      setLogsInitialLoading(false);
      return;
    }

    const gen = ++initialLogsLoadGenRef.current;
    setLogsInitialLoading(true);
    void (async () => {
      try {
        await loadLogs(householdId, undefined, undefined);
      } finally {
        if (gen === initialLogsLoadGenRef.current) {
          setLogsInitialLoading(false);
        }
      }
    })();
  }, [householdId, userId, loadLogs]);

  const refreshLogs = useCallback(() => {
    if (!householdId || !userId) return;
    void loadLogs(householdId, undefined, undefined);
  }, [householdId, userId, loadLogs]);

  return {
    logs,
    setLogs,
    logsInitialLoading,
    loadLogs,
    refreshLogs,
  };
}
