'use client';

import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CommentTarget, LogComment } from '../../features/logs/commentTypes';
import { formatDateTime } from '../../lib/formatDateTime';

type CommentSheetProps = {
  commentTarget: CommentTarget;
  commentSheetAnimated: boolean;
  commentSheetDragY: number;
  commentSheetDragActive: boolean;
  headerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  comments: LogComment[];
  user: User;
  isSameUserId: (a: string, b: string) => boolean;
  getMemberName: (userId: string) => string;
  editingCommentId: string | null;
  setEditingCommentId: (v: string | null) => void;
  editingCommentValue: string;
  setEditingCommentValue: (v: string) => void;
  updateComment: (commentId: string, logId: string, content: string, commentUserId?: string) => void | Promise<void>;
  deleteComment: (commentId: string, logId: string, commentUserId?: string) => void | Promise<void>;
  commentDraft: Record<string, string>;
  setCommentDraft: Dispatch<SetStateAction<Record<string, string>>>;
  addComment: (logId: string, content: string, parentId: string | null) => void | Promise<void>;
  commentSending: boolean;
  highContrast: boolean;
};

/** 하단 댓글/답글 시트 — 표시·스와이프만 담당, 데이터 로직은 부모(HomeClient) */
export function CommentSheet({
  commentTarget,
  commentSheetAnimated,
  commentSheetDragY,
  commentSheetDragActive,
  headerRef,
  onClose,
  comments,
  user,
  isSameUserId,
  getMemberName,
  editingCommentId,
  setEditingCommentId,
  editingCommentValue,
  setEditingCommentValue,
  updateComment,
  deleteComment,
  commentDraft,
  setCommentDraft,
  addComment,
  commentSending,
  highContrast,
}: CommentSheetProps) {
  return (
    <>
      <div
        role="presentation"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 42,
          transition: 'opacity 0.25s ease-out',
        }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={commentTarget.parentId ? '답글 입력' : '댓글 입력'}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 480,
          margin: '0 auto',
          zIndex: 43,
          background: 'var(--bg-card)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: '0 -10px 28px rgba(67,50,33,0.16)',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          transform: commentSheetAnimated ? `translateY(${commentSheetDragY}px)` : 'translateY(100%)',
          transition: commentSheetDragActive ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={headerRef}
          style={{
            touchAction: 'none',
            paddingBottom: 4,
            cursor: 'grab',
          }}
        >
          <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--divider)' }} aria-hidden />
          </div>
          <h3 style={{ margin: '0 0 12px', padding: '0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {commentTarget.parentId ? '답글' : '댓글'}
          </h3>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10, paddingRight: 2 }}>
            {comments.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-caption)', padding: '8px 2px' }}>아직 댓글이 없어요.</div>
            ) : (
              comments.map((c) => (
                <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{getMemberName(c.user_id)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-caption)' }}>{formatDateTime(c.created_at)}</div>
                  </div>
                  {editingCommentId === c.id ? (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={editingCommentValue}
                        onChange={(e) => setEditingCommentValue(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid var(--divider)',
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updateComment(c.id, commentTarget.logId, editingCommentValue, c.user_id)}
                        disabled={!editingCommentValue.trim()}
                        style={{ border: 'none', borderRadius: 10, padding: '8px 10px', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingCommentValue('');
                        }}
                        style={{ border: '1px solid var(--divider)', borderRadius: 10, padding: '8px 10px', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>{c.content}</div>
                  )}
                  {isSameUserId(c.user_id, user.id) && editingCommentId !== c.id && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditingCommentValue(c.content);
                        }}
                        style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12, color: 'var(--text-caption)', cursor: 'pointer' }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id, commentTarget.logId, c.user_id)}
                        style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12, color: '#ef4444', cursor: 'pointer' }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder={commentTarget.parentId ? '답글 입력...' : '댓글 입력...'}
              value={(commentTarget.parentId ? commentDraft[`${commentTarget.logId}_reply_${commentTarget.parentId}`] : commentDraft[commentTarget.logId]) ?? ''}
              onChange={(e) => {
                const key = commentTarget.parentId ? `${commentTarget.logId}_reply_${commentTarget.parentId}` : commentTarget.logId;
                setCommentDraft((prev) => ({ ...prev, [key]: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const key = commentTarget.parentId ? `${commentTarget.logId}_reply_${commentTarget.parentId}` : commentTarget.logId;
                  const draft = (commentDraft[key] ?? '').trim();
                  if (draft) {
                    void addComment(commentTarget.logId, draft, commentTarget.parentId);
                    setCommentDraft((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    });
                    onClose();
                  }
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: 12,
                border: highContrast ? '2px solid #ffc107' : '1px solid var(--bg-subtle)',
                background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                color: highContrast ? '#fff' : '#0f172a',
                fontSize: 16,
                outline: 'none',
              }}
              aria-label={commentTarget.parentId ? '답글 입력' : '댓글 입력'}
            />
            <button
              type="button"
              onClick={() => {
                const key = commentTarget.parentId ? `${commentTarget.logId}_reply_${commentTarget.parentId}` : commentTarget.logId;
                const draft = (commentDraft[key] ?? '').trim();
                if (draft) {
                  void addComment(commentTarget.logId, draft, commentTarget.parentId);
                  setCommentDraft((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                  onClose();
                }
              }}
              disabled={commentSending || !((commentTarget.parentId ? commentDraft[`${commentTarget.logId}_reply_${commentTarget.parentId}`] : commentDraft[commentTarget.logId]) ?? '').trim()}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: commentSending ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
            >
              {commentTarget.parentId ? '답글' : '전송'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--divider)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
