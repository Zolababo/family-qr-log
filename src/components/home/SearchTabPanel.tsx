'use client';

import { useRouter } from 'next/navigation';
import { getLogMedia } from '../../lib/logMedia';
import { formatDateTime } from '../../lib/formatDateTime';
import { parseLogMeta } from '../../lib/logActionMeta';
import { Empty } from '../ui/Empty';
import { LogTagBadge } from '../ui/Badge';
import type { Log } from '../../features/logs/logTypes';

export type SearchMediaViewModel = {
  visible: Log[];
  swipeImageUrls: string[];
  imageIndexByLogId: Record<string, number>;
};

type SearchTabPanelProps = {
  t: (key: string) => string;
  theme: { textSecondary: string };
  highContrast: boolean;
  searchQuery: string;
  searchMediaLogs: Log[];
  searchMediaView: SearchMediaViewModel;
  searchTextOnlyLogs: Log[];
  normalizeMediaUrl: (url: string | null | undefined) => string;
  getPrimaryMedia: (log: Log) => { type: 'image' | 'video'; url: string } | null;
  getEffectiveLogSlug: (log: Log) => string;
  getLogTagLabelKey: (slug: string) => string;
  applyTagFromLogCard: (slug: string) => void;
};

export function SearchTabPanel({
  t,
  theme,
  highContrast,
  searchQuery,
  searchMediaLogs,
  searchMediaView,
  searchTextOnlyLogs,
  normalizeMediaUrl,
  getPrimaryMedia,
  getEffectiveLogSlug,
  getLogTagLabelKey,
  applyTagFromLogCard,
}: SearchTabPanelProps) {
  const router = useRouter();

  return (
    <section aria-label="검색" style={{ marginBottom: 20 }}>
      {searchMediaLogs.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          {searchMediaView.visible.map((log) => {
            const { imageUrls, videoUrl } = getLogMedia(log);
            const cleanImages = imageUrls.map((u) => normalizeMediaUrl(u)).filter((u) => u.length > 0);
            const cleanVideo = normalizeMediaUrl(videoUrl);
            const media = getPrimaryMedia(log);
            const hasImages = media?.type === 'image';
            const thumb = media?.url ?? '';
            return (
              <button
                key={`search-media-${log.id}`}
                type="button"
                onClick={() => {
                  if (cleanImages.length > 0) {
                    const params = new URLSearchParams();
                    params.set('type', 'image');
                    if (searchMediaView.swipeImageUrls.length > 1) {
                      const idx = searchMediaView.imageIndexByLogId[log.id] ?? 0;
                      params.set('index', String(idx));
                      params.set('url', searchMediaView.swipeImageUrls[idx] ?? cleanImages[0]);
                      try {
                        const key = `media_urls_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                        sessionStorage.setItem(key, JSON.stringify(searchMediaView.swipeImageUrls));
                        params.set('urlsKey', key);
                      } catch {
                        params.set('urls', JSON.stringify(searchMediaView.swipeImageUrls));
                      }
                    } else {
                      params.set('urls', JSON.stringify(cleanImages));
                      params.set('index', '0');
                      params.set('url', cleanImages[0]);
                    }
                    router.push(`/media?${params.toString()}`);
                    return;
                  }
                  if (cleanVideo) {
                    router.push(`/media?type=video&url=${encodeURIComponent(cleanVideo)}`);
                  }
                }}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                  touchAction: 'pan-y',
                }}
                aria-label="미디어 보기"
              >
                <div
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: highContrast ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--divider)',
                    background: highContrast ? '#0f0f0f' : 'var(--bg-card)',
                  }}
                >
                  {hasImages ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        objectFit: 'cover',
                        display: 'block',
                        background: 'var(--bg-subtle)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        background: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          borderTop: '10px solid transparent',
                          borderBottom: '10px solid transparent',
                          borderLeft: '16px solid var(--bg-card)',
                          marginLeft: 2,
                          opacity: 0.9,
                        }}
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : searchTextOnlyLogs.length > 0 ? (
        <div style={{ padding: '0 2px' }}>
          {searchTextOnlyLogs.slice(0, 80).map((log) => {
            const displaySlug = getEffectiveLogSlug(log);
            const parsed = parseLogMeta(log.action);
            return (
              <div
                key={`search-text-${log.id}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: highContrast ? '1px solid #333' : '1px solid var(--divider)',
                  background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <LogTagBadge
                    slug={displaySlug}
                    onClick={() => applyTagFromLogCard(displaySlug)}
                    aria-label={`태그 ${t(getLogTagLabelKey(displaySlug))} 필터`}
                  >
                    #{t(getLogTagLabelKey(displaySlug))}
                  </LogTagBadge>
                  <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : 'var(--text-caption)' }}>
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: highContrast ? 'var(--divider)' : 'var(--text-primary)', lineHeight: 1.35 }}>
                  {parsed.text}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty message={searchQuery.trim() ? t('searchEmptyNoMatch') : t('noLogsYet')} captionColor={theme.textSecondary} />
      )}
    </section>
  );
}
