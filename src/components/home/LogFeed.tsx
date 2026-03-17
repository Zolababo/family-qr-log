'use client';

import type { RefObject } from 'react';
import { Calendar } from 'lucide-react';

export type Log = {
  id: string;
  household_id: string;
  place_slug: string;
  action: string;
  actor_user_id: string;
  created_at: string;
  image_url?: string | null;
  image_urls?: string | null;
  video_url?: string | null;
};

export type LogComment = {
  id: string;
  log_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
};

type LogGroup = { dateKey: string; dateLabel: string; items: Log[] };

type Theme = {
  radiusLg: number;
  border: string;
  card: string;
  cardShadow: string;
  textSecondary: string;
};

type LogFeedProps = {
  activeTab: 'home' | 'calendar' | 'qr' | 'search';
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  placeViewFilter: 'fridge' | 'table' | 'toilet' | 'all';
  setPlaceViewFilter: (v: 'fridge' | 'table' | 'toilet' | 'all') => void;
  t: (key: string) => string;
  theme: Theme;
  highContrast: boolean;
  logs: Log[];
  logsByDate: LogGroup[];
  user: { id: string } | null;
  editingLogId: string | null;
  setEditingLogId: (v: string | null) => void;
  editingAction: string;
  setEditingAction: (v: string) => void;
  onUpdateLog: (logId: string, newAction: string) => void | Promise<void>;
  getMemberName: (userId: string) => string;
  getLogMedia: (log: Log) => { imageUrls: string[]; videoUrl: string | null };
  formatDateTime: (iso: string) => string;
  getPlaceLabelKey: (slug: string) => string;
  commentsByLogId: Record<string, LogComment[]>;
  replyingTo: { logId: string; commentId: string } | null;
  setReplyingTo: (v: { logId: string; commentId: string } | null) => void;
  commentDraft: Record<string, string>;
  setCommentDraft: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  commentSending: boolean;
  addComment: (logId: string, content: string, parentId: string | null) => void | Promise<void>;
  longPressTimerRef: RefObject<NodeJS.Timeout | null>;
  setActionPopupLogId: (v: string | null) => void;
};

export function LogFeed({
  activeTab,
  searchQuery,
  setSearchQuery,
  placeViewFilter,
  setPlaceViewFilter,
  t,
  theme,
  highContrast,
  logs,
  logsByDate,
  user,
  editingLogId,
  setEditingLogId,
  editingAction,
  setEditingAction,
  onUpdateLog,
  getMemberName,
  getLogMedia,
  formatDateTime,
  getPlaceLabelKey,
  commentsByLogId,
  replyingTo,
  setReplyingTo,
  commentDraft,
  setCommentDraft,
  commentSending,
  addComment,
  longPressTimerRef,
  setActionPopupLogId,
}: LogFeedProps) {
  return (
    (activeTab === 'home' || activeTab === 'search') && (
      <section aria-label={t('recentLogs')}>
        {activeTab === 'search' && (
          <input
            type="search"
            placeholder="로그 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 12,
              border: highContrast ? '2px solid #ffc107' : '1px solid var(--bg-subtle)',
              background: highContrast ? '#1e1e1e' : '#f8fafc',
              color: highContrast ? '#fff' : '#0f172a',
              fontSize: 15,
              marginBottom: 12,
              outline: 'none',
            }}
            aria-label="로그 검색"
          />
        )}
        <div style={{ fontSize: 11, letterSpacing: '0.05em', color: highContrast ? '#ffffff' : '#94a3b8', marginBottom: 10 }}>
          {activeTab === 'search' ? (searchQuery ? `검색: ${searchQuery}` : t('recentLogs')) : t('recentLogs')}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {[
            { key: 'fridge' as const, labelKey: 'fridge' as const, bg: 'var(--place-fridge)', border: 'var(--place-fridge-icon)', color: 'var(--place-fridge-icon)' },
            { key: 'table' as const, labelKey: 'table' as const, bg: 'var(--place-table)', border: 'var(--place-table-icon)', color: 'var(--place-table-icon)' },
            { key: 'toilet' as const, labelKey: 'toilet' as const, bg: 'var(--place-toilet)', border: 'var(--place-toilet-icon)', color: 'var(--place-toilet-icon)' },
            { key: 'all' as const, labelKey: 'allPlaces' as const, bg: 'var(--bg-subtle)', border: 'var(--text-caption)', color: 'var(--text-secondary)' },
          ].map(({ key, labelKey, bg, border, color }) => {
            const active = placeViewFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPlaceViewFilter(key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: active ? `2px solid ${border}` : '1px solid #e2e8f0',
                  background: active ? bg : '#f8fafc',
                  color: active ? color : '#64748b',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        <div
          style={{
            maxHeight: '55vh',
            overflowY: 'auto',
            padding: '0 4px',
          }}
        >
          {logs.length === 0 && (
            <div
              style={{
                padding: 32,
                fontSize: 14,
                color: theme.textSecondary,
                textAlign: 'center',
              }}
            >
              {t('noLogsYet')}
            </div>
          )}

          {logsByDate.map((group) => (
            <div key={group.dateKey} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginBottom: 10,
                  padding: '6px 0',
                  letterSpacing: '0.02em',
                }}
              >
                <Calendar size={20} strokeWidth={1.5} aria-hidden />
                {group.dateLabel} · {group.items.length}건
              </div>
              {group.items.map((log) => {
                const isMine = user && log.actor_user_id === user.id;
                const isEditing = editingLogId === log.id;
                return (
                  <div
                    key={log.id}
                    role={isMine ? 'button' : undefined}
                    tabIndex={isMine ? 0 : undefined}
                    onPointerDown={() => {
                      if (!isMine) return;
                      longPressTimerRef.current = setTimeout(() => setActionPopupLogId(log.id), 500);
                    }}
                    onPointerUp={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                    onPointerLeave={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                    style={{
                      padding: '14px 0',
                      borderBottom: '1px solid var(--divider)',
                      cursor: isMine ? 'pointer' : 'default',
                      ...(highContrast ? { borderBottomColor: 'rgba(255,193,7,0.3)' } : {}),
                    }}
                  >
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingAction}
                          onChange={(e) => setEditingAction(e.target.value)}
                          rows={2}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            resize: 'none',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            padding: 8,
                            fontSize: 13,
                            background: '#f8fafc',
                            color: '#0f172a',
                            outline: 'none',
                            marginBottom: 8,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => onUpdateLog(log.id, editingAction)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: 'none',
                              background: 'var(--accent)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {t('save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLogId(null);
                              setEditingAction('');
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#64748b',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span className={`log-place-tag ${log.place_slug}`}>{t(getPlaceLabelKey(log.place_slug))}</span>
                          <span style={{ fontSize: 12, color: highContrast ? '#94a3b8' : 'var(--text-caption)' }}>
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: highContrast ? '#fff' : 'var(--text-primary)', marginBottom: 4 }}>
                          {getMemberName(log.actor_user_id)}
                        </div>
                        <div style={{ fontSize: 15, color: highContrast ? '#e2e8f0' : 'var(--text-primary)', lineHeight: 1.5 }}>
                          {log.action}
                        </div>
                        {(() => {
                          const { imageUrls, videoUrl } = getLogMedia(log);
                          if (imageUrls.length === 0 && !videoUrl) return null;
                          return (
                            <div
                              style={{
                                marginBottom: 8,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 8,
                                maxWidth: '100%',
                              }}
                            >
                              {imageUrls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'block',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                    flex: '1 1 120px',
                                    minWidth: 0,
                                  }}
                                >
                                  <img
                                    src={url}
                                    alt=""
                                    style={{
                                      width: '100%',
                                      maxHeight: 240,
                                      objectFit: 'contain',
                                      display: 'block',
                                      background: '#f1f5f9',
                                    }}
                                  />
                                </a>
                              ))}
                              {videoUrl && (
                                <div
                                  style={{
                                    flex: '1 1 200px',
                                    minWidth: 0,
                                    maxWidth: '100%',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    background: '#000',
                                  }}
                                >
                                  <video
                                    src={videoUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    style={{
                                      width: '100%',
                                      maxHeight: 240,
                                      display: 'block',
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {isMine && (
                          <div style={{ marginTop: 8, fontSize: 11, color: highContrast ? '#ffffff' : 'var(--text-caption)' }}>
                            {t('longPressEdit')}
                          </div>
                        )}
                        {/* 댓글 · 답글 */}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: highContrast ? '1px solid rgba(255,193,7,0.3)' : '1px solid var(--divider)' }}>
                          {(() => {
                            const list = commentsByLogId[log.id] ?? [];
                            const topLevel = list
                              .filter((c) => !c.parent_id)
                              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                            const getReplies = (parentId: string) =>
                              list
                                .filter((c) => c.parent_id === parentId)
                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                            const replyingToThis = replyingTo?.logId === log.id;
                            const draft = commentDraft[log.id] ?? '';
                            return (
                              <>
                                {topLevel.length > 0 && (
                                  <div style={{ marginBottom: 10 }}>
                                    {topLevel.map((c) => (
                                      <div key={c.id} style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 600, fontSize: 13, color: highContrast ? '#ffc107' : '#0f172a' }}>{getMemberName(c.user_id)}</span>
                                          <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b' }}>{formatDateTime(c.created_at)}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: highContrast ? '#e2e8f0' : '#334155', marginTop: 2, paddingLeft: 0 }}>{c.content}</div>
                                        {user && (
                                          <button
                                            type="button"
                                            onClick={() => setReplyingTo(replyingTo?.commentId === c.id ? null : { logId: log.id, commentId: c.id })}
                                            style={{
                                              marginTop: 4,
                                              padding: 0,
                                              border: 'none',
                                              background: 'none',
                                              fontSize: 12,
                                              color: highContrast ? '#ffc107' : '#64748b',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            답글
                                          </button>
                                        )}
                                        {getReplies(c.id).map((r) => (
                                          <div key={r.id} style={{ marginLeft: 24, marginTop: 6, paddingLeft: 12, borderLeft: highContrast ? '2px solid rgba(255,193,7,0.4)' : '2px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                                              <span style={{ fontWeight: 600, fontSize: 12, color: highContrast ? '#ffc107' : '#0f172a' }}>{getMemberName(r.user_id)}</span>
                                              <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b' }}>{formatDateTime(r.created_at)}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: highContrast ? '#e2e8f0' : '#334155', marginTop: 2 }}>{r.content}</div>
                                            {user && (
                                              <button
                                                type="button"
                                                onClick={() => setReplyingTo(replyingTo?.commentId === r.id ? null : { logId: log.id, commentId: r.id })}
                                                style={{
                                                  marginTop: 4,
                                                  padding: 0,
                                                  border: 'none',
                                                  background: 'none',
                                                  fontSize: 11,
                                                  color: highContrast ? '#ffc107' : '#64748b',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                답글
                                              </button>
                                            )}
                                            {replyingToThis && replyingTo?.commentId === r.id && user && (
                                              <div style={{ marginTop: 8 }}>
                                                <input
                                                  type="text"
                                                  placeholder="답글 입력..."
                                                  value={commentDraft[`${log.id}_reply_${r.id}`] ?? ''}
                                                  onChange={(e) => setCommentDraft((prev) => ({ ...prev, [`${log.id}_reply_${r.id}`]: e.target.value }))}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      const v = (commentDraft[`${log.id}_reply_${r.id}`] ?? '').trim();
                                                      if (v) addComment(log.id, v, r.id);
                                                    }
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                                                    background: highContrast ? '#1e1e1e' : '#f8fafc',
                                                    color: highContrast ? '#fff' : '#0f172a',
                                                    fontSize: 13,
                                                    outline: 'none',
                                                  }}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const v = (commentDraft[`${log.id}_reply_${r.id}`] ?? '').trim();
                                                    if (v) addComment(log.id, v, r.id);
                                                  }}
                                                  disabled={commentSending}
                                                  style={{
                                                    marginTop: 6,
                                                    padding: '6px 12px',
                                                    borderRadius: 8,
                                                    border: 'none',
                                                    background: highContrast ? '#ffc107' : '#3b82f6',
                                                    color: highContrast ? '#000' : '#fff',
                                                    fontSize: 12,
                                                    cursor: commentSending ? 'wait' : 'pointer',
                                                  }}
                                                >
                                                  답글 등록
                                                </button>
                                              </div>
                                            )}
                                            {getReplies(r.id).map((r2) => (
                                              <div key={r2.id} style={{ marginLeft: 20, marginTop: 6, paddingLeft: 10, borderLeft: highContrast ? '2px solid rgba(255,193,7,0.25)' : '2px solid #e2e8f0' }}>
                                                <span style={{ fontWeight: 600, fontSize: 12, color: highContrast ? '#ffc107' : '#0f172a' }}>{getMemberName(r2.user_id)}</span>
                                                <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b', marginLeft: 6 }}>{formatDateTime(r2.created_at)}</span>
                                                <div style={{ fontSize: 12, color: highContrast ? '#e2e8f0' : '#334155', marginTop: 2 }}>{r2.content}</div>
                                              </div>
                                            ))}
                                          </div>
                                        ))}
                                        {replyingToThis && replyingTo?.commentId === c.id && user && (
                                          <div style={{ marginLeft: 24, marginTop: 8 }}>
                                            <input
                                              type="text"
                                              placeholder="답글 입력..."
                                              value={(replyingTo?.logId === log.id && replyingTo?.commentId === c.id ? commentDraft[`${log.id}_reply_${c.id}`] : undefined) ?? ''}
                                              onChange={(e) => setCommentDraft((prev) => ({ ...prev, [`${log.id}_reply_${c.id}`]: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  const v = (commentDraft[`${log.id}_reply_${c.id}`] ?? '').trim();
                                                  if (v) addComment(log.id, v, c.id);
                                                }
                                              }}
                                              style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                                                background: highContrast ? '#1e1e1e' : '#f8fafc',
                                                color: highContrast ? '#fff' : '#0f172a',
                                                fontSize: 13,
                                                outline: 'none',
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const v = (commentDraft[`${log.id}_reply_${c.id}`] ?? '').trim();
                                                if (v) addComment(log.id, v, c.id);
                                              }}
                                              disabled={commentSending}
                                              style={{
                                                marginTop: 6,
                                                padding: '6px 12px',
                                                borderRadius: 8,
                                                border: 'none',
                                                background: highContrast ? '#ffc107' : '#3b82f6',
                                                color: highContrast ? '#000' : '#fff',
                                                fontSize: 12,
                                                cursor: commentSending ? 'wait' : 'pointer',
                                              }}
                                            >
                                              답글 등록
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {user && (
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                      type="text"
                                      placeholder="댓글 입력..."
                                      value={draft}
                                      onChange={(e) => setCommentDraft((prev) => ({ ...prev, [log.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          if (draft.trim()) addComment(log.id, draft.trim(), null);
                                        }
                                      }}
                                      style={{
                                        flex: 1,
                                        minWidth: 120,
                                        boxSizing: 'border-box',
                                        padding: '8px 12px',
                                        borderRadius: 10,
                                        border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                                        background: highContrast ? '#1e1e1e' : '#f8fafc',
                                        color: highContrast ? '#fff' : '#0f172a',
                                        fontSize: 13,
                                        outline: 'none',
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => draft.trim() && addComment(log.id, draft.trim(), null)}
                                      disabled={commentSending || !draft.trim()}
                                      style={{
                                        padding: '8px 14px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: highContrast ? '#ffc107' : '#3b82f6',
                                        color: highContrast ? '#000' : '#fff',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: commentSending || !draft.trim() ? 'default' : 'pointer',
                                      }}
                                    >
                                      댓글
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    )
  );
}
