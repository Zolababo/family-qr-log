'use client';

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { composeActionWithMeta, parseLogMeta, type LogMeta } from '@/lib/logActionMeta';
import type { Log } from './logTypes';

type UseLogStickersArgs = {
  userId: string | null | undefined;
  householdId: string | null | undefined;
  logs: Log[];
  setLogs: Dispatch<SetStateAction<Log[]>>;
  onReloadLogs: (householdId: string) => Promise<void> | void;
  onError: (message: string) => void;
};

type UseLogStickersResult = {
  stickerPickerOpen: boolean;
  stickerPickerLogId: string | null;
  stickerSaving: boolean;
  openStickerPicker: (logId: string | null) => void;
  closeStickerPicker: () => void;
  pickSticker: (sticker: string | null) => void;
  selectedStickerLogOwnSticker: string | null;
};

export function useLogStickers({
  userId,
  householdId,
  logs,
  setLogs,
  onReloadLogs,
  onError,
}: UseLogStickersArgs): UseLogStickersResult {
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerPickerLogId, setStickerPickerLogId] = useState<string | null>(null);
  const [stickerSaving, setStickerSaving] = useState(false);

  const closeStickerPicker = useCallback(() => {
    setStickerPickerOpen(false);
    setStickerPickerLogId(null);
  }, []);

  const openStickerPicker = useCallback((logId: string | null) => {
    setStickerPickerLogId(logId);
    setStickerPickerOpen(true);
  }, []);

  const applyStickerToLog = useCallback(
    async (logId: string, sticker: string | null) => {
      if (!userId || !householdId || stickerSaving) return;
      const targetLog = logs.find((l) => l.id === logId);
      if (!targetLog) return;

      const parsed = parseLogMeta(targetLog.action);
      const nextMeta: LogMeta = { ...parsed.meta };
      const byUser = { ...(nextMeta.stickerByUser ?? {}) };
      if (sticker) byUser[userId] = sticker;
      else delete byUser[userId];
      nextMeta.stickerByUser = Object.keys(byUser).length > 0 ? byUser : undefined;
      delete nextMeta.stickers;
      const nextAction = composeActionWithMeta(parsed.text, nextMeta);

      const prevAction = targetLog.action;
      setLogs((prev) => prev.map((log) => (log.id === logId ? { ...log, action: nextAction } : log)));
      setStickerSaving(true);

      const { error } = await supabase
        .from('logs')
        .update({ action: nextAction })
        .eq('id', logId);

      if (error) {
        setLogs((prev) => prev.map((log) => (log.id === logId ? { ...log, action: prevAction } : log)));
        setStickerSaving(false);
        onError(`스티커 저장 실패: ${error.message}`);
        return;
      }

      await onReloadLogs(householdId);
      setStickerSaving(false);
      closeStickerPicker();
    },
    [userId, householdId, logs, setLogs, onReloadLogs, onError, closeStickerPicker, stickerSaving]
  );

  const pickSticker = useCallback(
    (sticker: string | null) => {
      if (!stickerPickerLogId) return;
      void applyStickerToLog(stickerPickerLogId, sticker);
    },
    [applyStickerToLog, stickerPickerLogId]
  );

  const selectedStickerLogOwnSticker = useMemo(() => {
    if (!userId || !stickerPickerLogId) return null;
    const targetLog = logs.find((log) => log.id === stickerPickerLogId);
    if (!targetLog) return null;
    const { meta } = parseLogMeta(targetLog.action);
    return meta.stickerByUser?.[userId] ?? null;
  }, [logs, stickerPickerLogId, userId]);

  return {
    stickerPickerOpen,
    stickerPickerLogId,
    stickerSaving,
    openStickerPicker,
    closeStickerPicker,
    pickSticker,
    selectedStickerLogOwnSticker,
  };
}
