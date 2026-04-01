'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import type { CommentTarget, LogComment } from './commentTypes';

type UseLogCommentsArgs = {
  logIds: string[];
  userId: string | null | undefined;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export function useLogComments({
  logIds,
  userId,
  onError,
  onSuccess,
}: UseLogCommentsArgs) {
  const [commentsByLogId, setCommentsByLogId] = useState<Record<string, LogComment[]>>({});
  const [replyingTo, setReplyingTo] = useState<{ logId: string; commentId: string } | null>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const [commentSheetAnimated, setCommentSheetAnimated] = useState(false);
  const [commentSheetDragY, setCommentSheetDragY] = useState(0);
  const [commentSheetDragActive, setCommentSheetDragActive] = useState(false);
  const commentSheetHeaderRef = useRef<HTMLDivElement | null>(null);
  const commentSheetDragYRef = useRef(0);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentValue, setEditingCommentValue] = useState('');

  const loadComments = useCallback(async (targetLogIds: string[]) => {
    if (targetLogIds.length === 0) return;
    const { data, error } = await supabase
      .from('log_comments')
      .select('*')
      .in('log_id', targetLogIds)
      .order('created_at', { ascending: true });
    if (error) return;
    const byLog: Record<string, LogComment[]> = {};
    (data ?? []).forEach((c: LogComment) => {
      if (!byLog[c.log_id]) byLog[c.log_id] = [];
      byLog[c.log_id].push(c);
    });
    setCommentsByLogId((prev) => ({ ...prev, ...byLog }));
  }, []);

  useEffect(() => {
    if (logIds.length > 0) {
      void loadComments(logIds);
    }
  }, [logIds, loadComments]);

  const addComment = useCallback(
    async (logId: string, content: string, parentId: string | null) => {
      if (!userId || !content.trim() || commentSending) return;
      setCommentSending(true);
      const { error } = await supabase.from('log_comments').insert({
        log_id: logId,
        parent_id: parentId,
        user_id: userId,
        content: content.trim(),
      });
      setCommentSending(false);
      if (error) {
        onError(`댓글 저장 실패: ${error.message}`);
        return;
      }
      await loadComments([logId]);
      setCommentDraft((prev) => {
        const next = { ...prev, [logId]: '' };
        if (parentId) next[`${logId}_reply_${parentId}`] = '';
        return next;
      });
      setReplyingTo(null);
    },
    [userId, commentSending, loadComments, onError]
  );

  const updateComment = useCallback(
    async (commentId: string, logId: string, content: string, _commentUserId?: string) => {
      if (!userId || !content.trim()) return;
      const { data, error } = await supabase
        .from('log_comments')
        .update({ content: content.trim() })
        .eq('id', commentId)
        .select('id')
        .maybeSingle();
      if (error) {
        const hint = /policy|row-level|rls|permission|not allowed|forbidden/i.test(error.message ?? '')
          ? ' (DB RLS 정책 점검 필요: scripts/enable-log-comments-rls-policies.sql 실행)'
          : '';
        onError(`댓글 수정 실패: ${error.message}${hint}`);
        return;
      }
      if (!data) {
        onError('댓글 수정 실패: 권한 또는 정책 문제로 반영되지 않았습니다. (RLS 정책 확인)');
        return;
      }
      await loadComments([logId]);
      setEditingCommentId(null);
      setEditingCommentValue('');
    },
    [userId, loadComments, onError]
  );

  const deleteComment = useCallback(
    async (commentId: string, logId: string, _commentUserId?: string) => {
      if (!userId) return;
      if (typeof window !== 'undefined' && !window.confirm('댓글을 삭제할까요?')) return;
      const { data: delRows, error } = await supabase
        .from('log_comments')
        .delete()
        .eq('id', commentId)
        .select('id');
      const deleted = Array.isArray(delRows) ? delRows[0] : delRows;
      if (error) {
        const msg = String(error.message ?? '');
        const isFkBlocked = error.code === '23503' || /foreign key|constraint|violates/i.test(msg);
        if (isFkBlocked) {
          const fallback = await supabase
            .from('log_comments')
            .update({ content: '삭제된 댓글입니다.' })
            .eq('id', commentId)
            .select('id');
          const fb = Array.isArray(fallback.data) ? fallback.data[0] : fallback.data;
          if (!fallback.error && fb) {
            await loadComments([logId]);
            if (editingCommentId === commentId) {
              setEditingCommentId(null);
              setEditingCommentValue('');
            }
            onSuccess?.('답글이 있어 댓글 내용만 삭제되었습니다.');
            return;
          }
        }
        const hint = /policy|row-level|rls|permission|not allowed|forbidden/i.test(error.message ?? '')
          ? ' (DB RLS 정책 점검 필요: scripts/enable-log-comments-rls-policies.sql 실행)'
          : '';
        onError(`댓글 삭제 실패: ${error.message}${hint}`);
        return;
      }
      if (!deleted) {
        onError('댓글 삭제 실패: 반영된 행이 없습니다. Supabase SQL Editor에서 scripts/enable-log-comments-rls-policies.sql 을 다시 실행해 주세요.');
        return;
      }
      await loadComments([logId]);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentValue('');
      }
    },
    [userId, loadComments, editingCommentId, onError, onSuccess]
  );

  const closeCommentSheet = useCallback(() => {
    setCommentSheetDragActive(false);
    setCommentSheetDragY(0);
    commentSheetDragYRef.current = 0;
    setCommentSheetAnimated(false);
    window.setTimeout(() => {
      setCommentTarget(null);
      setReplyingTo(null);
    }, 250);
  }, []);

  useEffect(() => {
    if (commentTarget) {
      setCommentSheetDragActive(false);
      setCommentSheetDragY(0);
      commentSheetDragYRef.current = 0;
      setCommentSheetAnimated(false);
      const id = requestAnimationFrame(() => setCommentSheetAnimated(true));
      return () => cancelAnimationFrame(id);
    }
    setCommentSheetAnimated(false);
    setCommentSheetDragActive(false);
    setCommentSheetDragY(0);
    commentSheetDragYRef.current = 0;
  }, [commentTarget]);

  useEffect(() => {
    const el = commentSheetHeaderRef.current;
    if (!el || !commentTarget) return;
    let startY: number | null = null;
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      setCommentSheetDragActive(true);
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        e.preventDefault();
        const capped = Math.min(dy, 240);
        commentSheetDragYRef.current = capped;
        setCommentSheetDragY(capped);
      }
    };
    const onEnd = () => {
      if (startY == null) return;
      startY = null;
      const d = commentSheetDragYRef.current;
      if (d > 72) {
        closeCommentSheet();
      } else {
        setCommentSheetDragActive(false);
        commentSheetDragYRef.current = 0;
        setCommentSheetDragY(0);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [commentTarget, closeCommentSheet]);

  const currentSheetComments = commentTarget ? (commentsByLogId[commentTarget.logId] ?? []) : [];

  return {
    commentsByLogId,
    replyingTo,
    setReplyingTo,
    commentTarget,
    setCommentTarget,
    commentSheetAnimated,
    commentSheetDragY,
    commentSheetDragActive,
    commentSheetHeaderRef,
    commentDraft,
    setCommentDraft,
    commentSending,
    editingCommentId,
    setEditingCommentId,
    editingCommentValue,
    setEditingCommentValue,
    addComment,
    updateComment,
    deleteComment,
    closeCommentSheet,
    currentSheetComments,
  };
}
