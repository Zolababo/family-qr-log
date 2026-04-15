'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { LOG_SLUG } from '@/lib/logTags';

type SharedMemoSnapshot = {
  content?: string;
  family_notice?: string;
  shopping_list?: string;
};

type PersistResult =
  | { ok: true; mode: 'table' | 'content-only' | 'log-fallback' }
  | { ok: false; mode: 'skipped' | 'table' | 'content-only' | 'log-fallback'; errorMessage: string };

type UseHouseholdMemosArgs = {
  householdId: string | null;
  userId: string | null | undefined;
  familyNotesEditing: boolean;
  showMemoPanel: boolean;
  memoKey: string;
  sharedMemoLogPrefix: string;
  parseSharedMemoSnapshot: (action: string | null | undefined) => SharedMemoSnapshot | null;
  composeSharedMemoSnapshot: (snapshot: SharedMemoSnapshot) => string;
  onError: (message: string) => void;
};

export function useHouseholdMemos({
  householdId,
  userId,
  familyNotesEditing,
  showMemoPanel,
  memoKey,
  sharedMemoLogPrefix,
  parseSharedMemoSnapshot,
  composeSharedMemoSnapshot,
  onError,
}: UseHouseholdMemosArgs) {
  const [memoContent, setMemoContent] = useState('');
  const [familyNotice, setFamilyNotice] = useState('');
  const [shoppingList, setShoppingList] = useState('');
  const [memoSaving, setMemoSaving] = useState(false);
  const sharedMemoTypingUntilRef = useRef(0);
  const memoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSharedMemoSnapshotActionRef = useRef('');
  const lastAppliedRemoteMemoAtMsRef = useRef(0);
  const remoteMemoReqSeqRef = useRef(0);
  /** False until first household memo fetch for this session finishes — avoids upserting empty state before server data loads. */
  const memoServerStateKnownRef = useRef(false);

  const canApplyIncomingSharedMemo = useCallback(() => {
    const typing = Date.now() < sharedMemoTypingUntilRef.current;
    return !typing && !familyNotesEditing && !showMemoPanel;
  }, [familyNotesEditing, showMemoPanel]);

  const applyRemoteMemoSnapshot = useCallback(
    (snapshot: SharedMemoSnapshot, appliedMs: number) => {
      if (appliedMs > 0 && appliedMs <= lastAppliedRemoteMemoAtMsRef.current) return false;
      if (!canApplyIncomingSharedMemo()) return false;

      if (typeof snapshot.content === 'string') {
        setMemoContent(snapshot.content);
        try {
          localStorage.setItem(memoKey, snapshot.content);
        } catch {}
      }
      if (typeof snapshot.family_notice === 'string') {
        setFamilyNotice(snapshot.family_notice);
      }
      if (typeof snapshot.shopping_list === 'string') {
        setShoppingList(snapshot.shopping_list);
      }
      if (appliedMs > 0) {
        lastAppliedRemoteMemoAtMsRef.current = appliedMs;
      }
      return true;
    },
    [canApplyIncomingSharedMemo, memoKey]
  );

  useEffect(() => {
    memoServerStateKnownRef.current = false;
  }, [householdId, userId]);

  const refreshSharedMemos = useCallback(async () => {
    if (!householdId) return;

    const reqSeq = ++remoteMemoReqSeqRef.current;
    const { data, error } = await supabase
      .from('household_memos')
      .select('content, family_notice, shopping_list, updated_at')
      .eq('household_id', householdId)
      .maybeSingle();

    if (reqSeq !== remoteMemoReqSeqRef.current) return;

    if (!error && data) {
      const row = data as {
        content?: string;
        family_notice?: string;
        shopping_list?: string;
        updated_at?: string;
      };
      const remoteMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const applied = applyRemoteMemoSnapshot(row, remoteMs);
      if (applied) return;
      if (typeof row.family_notice !== 'string') {
        try {
          const n = localStorage.getItem('family_qr_log_notice');
          if (n) setFamilyNotice(n);
        } catch {}
      }
      if (typeof row.shopping_list !== 'string') {
        try {
          const s = localStorage.getItem('family_qr_log_shopping');
          if (s) setShoppingList(s);
        } catch {}
      }
      return;
    }

    if (error && /relation|schema cache|Could not find the table|household_memos/i.test(error.message ?? '')) {
      const fallbackReqSeq = ++remoteMemoReqSeqRef.current;
      const { data: fb } = await supabase
        .from('logs')
        .select('action, created_at')
        .eq('household_id', householdId)
        .like('action', `${sharedMemoLogPrefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (fallbackReqSeq !== remoteMemoReqSeqRef.current) return;
      const latest = fb?.[0];
      const parsed = parseSharedMemoSnapshot(latest?.action);
      if (!parsed) return;
      const logMs = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
      applyRemoteMemoSnapshot(parsed, logMs);
    }
  }, [householdId, sharedMemoLogPrefix, parseSharedMemoSnapshot, applyRemoteMemoSnapshot]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(memoKey);
      if (raw != null) setMemoContent(raw);
    } catch {}
  }, [memoKey]);

  useEffect(() => {
    if (!householdId || !userId) return;
    let cancelled = false;
    void (async () => {
      const loadFromSharedMemoLog = async (guardSeq: number) => {
        const { data: fallbackLogs } = await supabase
          .from('logs')
          .select('action, created_at')
          .eq('household_id', householdId)
          .like('action', `${sharedMemoLogPrefix}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (cancelled || guardSeq !== remoteMemoReqSeqRef.current) return;
        const latest = fallbackLogs?.[0];
        const parsed = parseSharedMemoSnapshot(latest?.action);
        if (!parsed) return;
        const logMs = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
        applyRemoteMemoSnapshot(parsed, logMs);
      };

      const reqSeq = ++remoteMemoReqSeqRef.current;
      try {
        const { data, error } = await supabase
          .from('household_memos')
          .select('content, family_notice, shopping_list, updated_at')
          .eq('household_id', householdId)
          .maybeSingle();
        if (cancelled || reqSeq !== remoteMemoReqSeqRef.current) return;

        if (error) {
          if (/relation|schema cache|Could not find the table|household_memos/i.test(error.message ?? '')) {
            await loadFromSharedMemoLog(reqSeq);
            return;
          }
          const { data: fallback } = await supabase.from('household_memos').select('content').eq('household_id', householdId).maybeSingle();
          if (!cancelled && fallback && typeof fallback.content === 'string') {
            setMemoContent(fallback.content);
            try {
              localStorage.setItem(memoKey, fallback.content);
            } catch {}
          }
          try {
            const n = localStorage.getItem('family_qr_log_notice');
            const s = localStorage.getItem('family_qr_log_shopping');
            if (n) setFamilyNotice(n);
            if (s) setShoppingList(s);
          } catch {}
          return;
        }

        if (!data) return;
        const row = data as {
          content?: string;
          family_notice?: string;
          shopping_list?: string;
          updated_at?: string;
        };
        const remoteMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        const applied = applyRemoteMemoSnapshot(row, remoteMs);
        if (applied) return;
        if (typeof row.family_notice !== 'string') {
          try {
            const n = localStorage.getItem('family_qr_log_notice');
            if (n) setFamilyNotice(n);
          } catch {}
        }
        if (typeof row.shopping_list !== 'string') {
          try {
            const s = localStorage.getItem('family_qr_log_shopping');
            if (s) setShoppingList(s);
          } catch {}
        }
      } finally {
        if (!cancelled && reqSeq === remoteMemoReqSeqRef.current) {
          memoServerStateKnownRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [householdId, userId, memoKey, sharedMemoLogPrefix, parseSharedMemoSnapshot, applyRemoteMemoSnapshot]);

  useEffect(() => {
    if (!householdId) return;

    const pull = async () => {
      const reqSeq = ++remoteMemoReqSeqRef.current;
      const { data } = await supabase
        .from('household_memos')
        .select('content, family_notice, shopping_list, updated_at')
        .eq('household_id', householdId)
        .maybeSingle();
      if (reqSeq !== remoteMemoReqSeqRef.current || !data) return;
      const row = data as {
        content?: string;
        family_notice?: string;
        shopping_list?: string;
        updated_at?: string;
      };
      const remoteMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      applyRemoteMemoSnapshot(row, remoteMs);
    };

    const pullFromSharedMemoLog = async () => {
      const reqSeq = ++remoteMemoReqSeqRef.current;
      const { data } = await supabase
        .from('logs')
        .select('action, created_at')
        .eq('household_id', householdId)
        .like('action', `${sharedMemoLogPrefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (reqSeq !== remoteMemoReqSeqRef.current) return;
      const latest = data?.[0];
      const logMs = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
      const parsed = parseSharedMemoSnapshot(latest?.action);
      if (!parsed) return;
      if (typeof latest?.action === 'string') {
        lastSavedSharedMemoSnapshotActionRef.current = latest.action;
      }
      applyRemoteMemoSnapshot(parsed, logMs);
    };

    const channel = supabase
      .channel(`household-memos-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_memos', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const next = payload.new as {
            content?: string;
            family_notice?: string;
            shopping_list?: string;
            updated_at?: string;
          } | null;
          if (!next) return;
          const nextMs = next.updated_at ? new Date(next.updated_at).getTime() : 0;
          applyRemoteMemoSnapshot(next, nextMs);
        }
      )
      .subscribe();

    const timer = window.setInterval(() => {
      void pull();
      void pullFromSharedMemoLog();
    }, 5000);

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, sharedMemoLogPrefix, parseSharedMemoSnapshot, applyRemoteMemoSnapshot]);

  const persistSharedMemos = useCallback(async (): Promise<PersistResult> => {
    if (!householdId || !userId) {
      return { ok: false, mode: 'skipped', errorMessage: '로그인이 필요합니다.' };
    }
    if (!memoServerStateKnownRef.current) {
      return { ok: false, mode: 'skipped', errorMessage: '메모를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.' };
    }

    const full = {
      household_id: householdId,
      content: memoContent,
      family_notice: familyNotice,
      shopping_list: shoppingList,
    };

    let mode: 'table' | 'content-only' | 'log-fallback' = 'table';
    let { data: upsertRow, error } = await supabase
      .from('household_memos')
      .upsert(full, { onConflict: 'household_id' })
      .select('updated_at')
      .maybeSingle();

    if (error && /family_notice|shopping_list|schema|column/i.test(error.message ?? '')) {
      mode = 'content-only';
      const res = await supabase
        .from('household_memos')
        .upsert({ household_id: householdId, content: memoContent }, { onConflict: 'household_id' })
        .select('updated_at')
        .maybeSingle();
      upsertRow = res.data;
      error = res.error;
    }

    const savedAt =
      upsertRow && typeof (upsertRow as { updated_at?: string }).updated_at === 'string'
        ? new Date((upsertRow as { updated_at: string }).updated_at).getTime()
        : 0;
    if (!error && savedAt > 0) lastAppliedRemoteMemoAtMsRef.current = savedAt;

    if (error && /relation|does not exist|schema cache|Could not find the table|household_memos/i.test(error.message ?? '')) {
      mode = 'log-fallback';
      const snapshotAction = composeSharedMemoSnapshot({
        content: memoContent,
        family_notice: familyNotice,
        shopping_list: shoppingList,
      });
      if (snapshotAction === lastSavedSharedMemoSnapshotActionRef.current) {
        return { ok: true, mode };
      }
      const res = await supabase.from('logs').insert({
        household_id: householdId,
        place_slug: LOG_SLUG.general,
        action: snapshotAction,
        actor_user_id: userId,
      });
      error = res.error;
      if (!error) {
        lastSavedSharedMemoSnapshotActionRef.current = snapshotAction;
        lastAppliedRemoteMemoAtMsRef.current = Date.now();
      }
    }

    if (error) {
      return { ok: false, mode, errorMessage: error.message };
    }
    return { ok: true, mode };
  }, [householdId, userId, memoContent, familyNotice, shoppingList, composeSharedMemoSnapshot]);

  useEffect(() => {
    try {
      localStorage.setItem(memoKey, memoContent);
    } catch {}
    try {
      localStorage.setItem('family_qr_log_notice', familyNotice);
      localStorage.setItem('family_qr_log_shopping', shoppingList);
    } catch {}
    if (!householdId || !userId) return;
    if (!memoServerStateKnownRef.current) return;
    if (memoSaveTimerRef.current) clearTimeout(memoSaveTimerRef.current);
    memoSaveTimerRef.current = setTimeout(async () => {
      const result = await persistSharedMemos();
      if (!result.ok) {
        onError(`메모 저장 실패: ${result.errorMessage}`);
        return;
      }
      if (result.mode === 'content-only') {
        onError('가족 공지/장보기 메모는 서버 컬럼이 없어 완전히 저장되지 않았습니다. Supabase 컬럼 설정을 확인해 주세요.');
        return;
      }
      if (result.mode === 'log-fallback') {
        onError('가족 메모가 예비 방식으로 저장되었습니다. 앱 재설치 전 Supabase 메모 테이블 설정을 확인해 주세요.');
      }
    }, 900);
    return () => {
      if (memoSaveTimerRef.current) clearTimeout(memoSaveTimerRef.current);
    };
  }, [memoContent, familyNotice, shoppingList, householdId, userId, memoKey, persistSharedMemos, onError]);

  const saveSharedMemos = useCallback(async () => {
    setMemoSaving(true);
    const result = await persistSharedMemos();
    setMemoSaving(false);
    return result;
  }, [persistSharedMemos]);

  return {
    memoContent,
    setMemoContent,
    familyNotice,
    setFamilyNotice,
    shoppingList,
    setShoppingList,
    memoSaving,
    sharedMemoTypingUntilRef,
    canApplyIncomingSharedMemo,
    saveSharedMemos,
    refreshSharedMemos,
    lastAppliedRemoteMemoAtMsRef,
  };
}
