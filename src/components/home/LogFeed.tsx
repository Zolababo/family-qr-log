'use client';

import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MessageCircle, Play, MapPin, ExternalLink, Sparkles } from 'lucide-react';

export type Log = {
  id: string;
  household_id: string;
  place_slug: string;
  action: string;
  actor_user_id: string;
  created_at: string;
  image_url?: string | null;
  image_urls?: string | string[] | null;
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
  activeTab: 'home' | 'calendar' | 'search';
  searchQuery: string;
  setSearchQuery: (v: string) => void;
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
  commentTarget: { logId: string; parentId: string | null } | null;
  setCommentTarget: (v: { logId: string; parentId: string | null } | null) => void;
  longPressTimerRef: RefObject<NodeJS.Timeout | null>;
  setActionPopupLogId: (v: string | null) => void;
  onPickSticker?: (logId: string) => void;
  /** 스티커 오버레이를 다시 누르면 제거 */
  onStickerRemove?: (logId: string) => void;
  onTagClick?: (slug: string) => void;
};

export function LogFeed({
  activeTab,
  searchQuery,
  setSearchQuery,
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
  commentTarget,
  setCommentTarget,
  longPressTimerRef,
  setActionPopupLogId,
  onPickSticker,
  onStickerRemove,
  onTagClick,
}: LogFeedProps) {
  const router = useRouter();
  const parseLogMeta = (actionText: string): { text: string; locationName?: string; locationUrl?: string; stickers?: string[]; stickerByUser?: Record<string, string> } => {
    const safeText = String(actionText ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    const marker = '\n@@meta:';
    const idx = safeText.lastIndexOf(marker);
    if (idx < 0) return { text: safeText };
    const text = safeText.slice(0, idx).trim();
    const raw = safeText.slice(idx + marker.length).trim();
    try {
      const parsed = JSON.parse(raw) as { locationName?: string; locationUrl?: string; stickers?: string[]; stickerByUser?: Record<string, string> };
      return { text, locationName: parsed?.locationName, locationUrl: parsed?.locationUrl, stickers: parsed?.stickers, stickerByUser: parsed?.stickerByUser };
    } catch {
      return { text };
    }
  };
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [pausedVideoId, setPausedVideoId] = useState<string | null>(null);
  const openMediaPage = (type: 'image' | 'video', url: string, imageUrls?: string[], imageIndex = 0) => {
    const params = new URLSearchParams();
    params.set('type', type);
    if (type === 'image' && imageUrls && imageUrls.length > 0) {
      params.set('urls', JSON.stringify(imageUrls));
      params.set('index', String(Math.max(0, Math.min(imageIndex, imageUrls.length - 1))));
      params.set('url', imageUrls[Math.max(0, Math.min(imageIndex, imageUrls.length - 1))] ?? url);
    } else {
      params.set('url', url);
    }
    router.push(`/media?${params.toString()}`);
  };

  const toggleVideo = async (logId: string) => {
    const el = videoRefs.current[logId];
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        // autoplay/play can be blocked; ignore, user can try again
      }
    } else {
      el.pause();
    }
  };

  return (
    (activeTab === 'home' || activeTab === 'search') && (
      <section aria-label={t('recentLogs')} style={{ marginLeft: -16, marginRight: -16, width: 'calc(100% + 32px)' }}>
        <div style={{ paddingLeft: 16, paddingRight: 16 }}>
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
        </div>

        <div
          style={{
            maxHeight: 'none',
            overflow: 'visible',
            padding: 0,
          }}
        >
          {logsByDate.length === 0 && (
            <div
              style={{
                padding: '18px 16px',
                fontSize: 13,
                color: theme.textSecondary,
                textAlign: 'center',
              }}
            >
              {t('noLogsYet')}
            </div>
          )}

          {logsByDate.map((group) => (
            <div key={group.dateKey} style={{ marginBottom: 10, paddingLeft: 16, paddingRight: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginBottom: 6,
                  padding: '4px 0',
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
                      padding: '10px 0',
                      borderBottom: 'none',
                      cursor: isMine ? 'pointer' : 'default',
                      ...(highContrast ? {} : {}),
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTagClick?.(log.place_slug);
                            }}
                            className={`log-place-tag ${log.place_slug}`}
                            style={{ border: 'none', cursor: 'pointer' }}
                            aria-label={`태그 ${t(getPlaceLabelKey(log.place_slug))} 필터`}
                          >
                            #{t(getPlaceLabelKey(log.place_slug))}
                          </button>
                          <span style={{ fontSize: 12, color: highContrast ? '#94a3b8' : 'var(--text-caption)' }}>
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: highContrast ? '#fff' : 'var(--text-primary)', marginBottom: 6 }}>
                          {getMemberName(log.actor_user_id)}
                        </div>
                        <div style={{ fontSize: 13, color: highContrast ? '#e2e8f0' : 'var(--text-primary)', lineHeight: 1.25, marginBottom: 8 }}>
                          {parseLogMeta(log.action).text}
                        </div>
                        {(() => {
                          const parsed = parseLogMeta(log.action);
                          if (!parsed.locationName && !parsed.locationUrl) return null;
                          return (
                            <a
                              href={parsed.locationUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 4,
                                fontSize: 11,
                                color: highContrast ? '#ffc107' : '#3b82f6',
                                textDecoration: 'none',
                              }}
                            >
                              <MapPin size={16} strokeWidth={1.5} aria-hidden />
                              {parsed.locationName || '지도 보기'}
                              <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
                            </a>
                          );
                        })()}
                        {(() => {
                          const { imageUrls, videoUrl } = getLogMedia(log);
                          if (imageUrls.length === 0 && !videoUrl) return null;
                          return (
                            <div
                              style={{
                                marginBottom: 8,
                                marginTop: 2,
                                position: 'relative',
                                width: '100%',
                                display: 'block',
                                maxWidth: '100%',
                              }}
                            >
                              {(() => {
                                const parsed = parseLogMeta(log.action);
                                const stickerMap = parsed.stickerByUser ?? {};
                                const ownSticker = user ? stickerMap[user.id] : undefined;
                                const stickers = Object.values(stickerMap);
                                const fallback = parsed.stickers ?? [];
                                const display = stickers.length > 0 ? stickers : fallback;
                                if (display.length === 0) return null;
                                return (
                                <button
                                  type="button"
                                  aria-label={t('stickerRemoveAria')}
                                  title={t('stickerRemoveHint')}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (ownSticker || fallback.length > 0) onStickerRemove?.(log.id);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    zIndex: 3,
                                    background: 'rgba(0,0,0,0.42)',
                                    color: '#fff',
                                    padding: '6px 8px',
                                    borderRadius: 999,
                                    fontSize: 16,
                                    lineHeight: 1,
                                    cursor: ownSticker || fallback.length > 0 ? 'pointer' : 'default',
                                    border: 'none',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  {display.join(' ')}
                                </button>
                                );
                              })()}
                              {imageUrls.map((url, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => openMediaPage('image', url, imageUrls, i)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    overflow: 'hidden',
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <img
                                    src={url}
                                    alt=""
                                    style={{
                                      width: '100%',
                                      maxHeight: 320,
                                      objectFit: 'cover',
                                      display: 'block',
                                      background: 'var(--bg-subtle)',
                                    }}
                                  />
                                </button>
                              ))}
                              {videoUrl && (
                                <div
                                  style={{
                                    position: 'relative',
                                    width: '100%',
                                    overflow: 'hidden',
                                    background: '#000',
                                  }}
                                  onClick={() => toggleVideo(log.id)}
                                  onPointerDown={(e) => {
                                    // Prevent iOS tap from selecting/dragging
                                    e.preventDefault();
                                  }}
                                >
                                  <video
                                    ref={(el) => {
                                      videoRefs.current[log.id] = el;
                                    }}
                                    src={videoUrl}
                                    muted
                                    loop
                                    playsInline
                                    autoPlay
                                    preload="metadata"
                                    onPlay={() => setPausedVideoId((cur) => (cur === log.id ? null : cur))}
                                    onPause={() => setPausedVideoId((cur) => (cur === log.id ? log.id : log.id))}
                                    style={{
                                      width: '100%',
                                      maxHeight: 320,
                                      display: 'block',
                                    }}
                                  />
                                  {pausedVideoId === log.id && (
                                    <div
                                      role="presentation"
                                      aria-hidden
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.12)',
                                      }}
                                    >
                                      <Play size={48} color="#fff" strokeWidth={1.5} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* 길게 누르면 수정/삭제 문구 제거 */}
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {onPickSticker && (
                            <button
                              type="button"
                              onClick={() => onPickSticker(log.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 8px',
                                borderRadius: 999,
                                border: '1px solid var(--divider)',
                                background: 'transparent',
                                color: highContrast ? '#ffc107' : '#64748b',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                              aria-label="스티커"
                            >
                              <Sparkles size={16} strokeWidth={1.5} aria-hidden />
                              스티커
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCommentTarget({ logId: log.id, parentId: null })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 999,
                              border: '1px solid var(--divider)',
                              background: 'transparent',
                              color: highContrast ? '#ffc107' : '#64748b',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            <MessageCircle size={16} strokeWidth={1.5} aria-hidden />
                            {(commentsByLogId[log.id] ?? []).length}
                          </button>
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
