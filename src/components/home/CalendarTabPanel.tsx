'use client';

import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Baby,
  History,
  MapPin,
  ExternalLink,
  Wallet,
  CheckSquare2,
} from 'lucide-react';
import { getLogMedia } from '../../lib/logMedia';
import { formatDateTime } from '../../lib/formatDateTime';
import { getParsedLog } from '../../features/logs/logDerived';
import type { Log } from '../../features/logs/logTypes';
import type { LedgerEntry } from '../../features/ledger/ledgerTypes';
import type { LogSlug } from '../../lib/logTags';
import { Empty } from '../ui/Empty';
import { LogTagBadge } from '../ui/Badge';
import { CalendarDayLedgerSection } from './CalendarDayLedgerSection';
import { CalendarDayTodoSection } from './CalendarDayTodoSection';
import type { TodoTask } from './TodoBoard';

export type GrowthRangeKey = 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all';

export type GrowthTimelineViewModel = {
  visible: Log[];
  swipeImageUrls: string[];
  imageIndexByLogId: Record<string, number>;
};

type HomeCalendarTheme = {
  text: string;
  textSecondary: string;
  border: string;
  radiusLg: number;
  card: string;
};

export type CalendarTabPanelProps = {
  t: (key: string) => string;
  theme: HomeCalendarTheme;
  highContrast: boolean;
  calendarYearMonth: string;
  setCalendarYearMonth: (v: string) => void;
  calendarHeaderMonthLabel: string;
  feedTagOptions: Array<{ key: string; label: string }>;
  calendarTagFilter: 'all' | LogSlug;
  setCalendarTagFilter: (v: 'all' | LogSlug) => void;
  calendarCellCount: number;
  startWeekday: number;
  daysInMonth: number;
  calYear: number;
  calMonth: number;
  calendarDayLogsMap: Record<string, Log[]>;
  calendarDayLedgerMap: Record<string, LedgerEntry[]>;
  calendarDayDueTodoCount: Record<string, number>;
  selectedCalendarDate: string | null;
  setSelectedCalendarDate: (v: string | null) => void;
  selectedCalendarDayLedgerEntries: LedgerEntry[];
  selectedCalendarDayTodos: TodoTask[];
  selectedDayLogs: Log[];
  getMemberName: (userId: string) => string;
  getEffectiveLogSlug: (log: Log) => string;
  getLogTagLabelKey: (slug: string) => string;
  applyTagFromLogCard: (slug: string) => void;
  onOpenLedgerFromDay: () => void;
  onOpenTodoFromDay: () => void;
  growthRange: GrowthRangeKey;
  setGrowthRange: (v: GrowthRangeKey) => void;
  growthTimelineView: GrowthTimelineViewModel;
  todayMemoryLogs: Log[];
  normalizeMediaUrl: (url: string | null | undefined) => string;
  getPrimaryMedia: (log: Log) => { type: 'image' | 'video'; url: string } | null;
};

export function CalendarTabPanel({
  t,
  theme,
  highContrast,
  calendarYearMonth,
  setCalendarYearMonth,
  calendarHeaderMonthLabel,
  feedTagOptions,
  calendarTagFilter,
  setCalendarTagFilter,
  calendarCellCount,
  startWeekday,
  daysInMonth,
  calYear,
  calMonth,
  calendarDayLogsMap,
  calendarDayLedgerMap,
  calendarDayDueTodoCount,
  selectedCalendarDate,
  setSelectedCalendarDate,
  selectedCalendarDayLedgerEntries,
  selectedCalendarDayTodos,
  selectedDayLogs,
  getMemberName,
  getEffectiveLogSlug,
  getLogTagLabelKey,
  applyTagFromLogCard,
  onOpenLedgerFromDay,
  onOpenTodoFromDay,
  growthRange,
  setGrowthRange,
  growthTimelineView,
  todayMemoryLogs,
  normalizeMediaUrl,
  getPrimaryMedia,
}: CalendarTabPanelProps) {
  const router = useRouter();

  return (
    <section aria-label={t('calendarSectionAria')} style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            const [y, m] = calendarYearMonth.split('-').map(Number);
            const d = new Date(y, m - 2, 1);
            setCalendarYearMonth(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
          }}
          style={{
            padding: '8px 12px',
            border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
            borderRadius: 10,
            background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
            color: highContrast ? '#ffc107' : 'var(--text-secondary)',
            fontSize: 14,
            cursor: 'pointer',
          }}
          aria-label={t('calendarPrevMonth')}
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-primary)' }}>
          <Calendar size={20} strokeWidth={1.5} aria-hidden />
          {calendarHeaderMonthLabel}
        </div>
        <button
          type="button"
          onClick={() => {
            const [y, m] = calendarYearMonth.split('-').map(Number);
            const d = new Date(y, m, 1);
            setCalendarYearMonth(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
          }}
          style={{
            padding: '8px 12px',
            border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
            borderRadius: 10,
            background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
            color: highContrast ? '#ffc107' : 'var(--text-secondary)',
            fontSize: 14,
            cursor: 'pointer',
          }}
          aria-label={t('calendarNextMonth')}
        >
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <div
        className="horizontal-scroll-hide home-chip-scroll-snap calendar-tag-filter-row"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          gap: 6,
          marginBottom: 6,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {feedTagOptions.map(({ key, label }) => {
          const active = calendarTagFilter === key;
          return (
            <button
              key={key}
              type="button"
              className="log-filter-btn"
              onClick={() => setCalendarTagFilter(key as 'all' | LogSlug)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 999,
                border: active ? '1px solid var(--accent)' : '1px solid var(--divider)',
                background: active ? 'var(--accent-light)' : highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                color: active ? 'var(--accent)' : highContrast ? '#94a3b8' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
          borderRadius: 12,
          padding: 10,
          border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
        }}
      >
        {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
          <div
            key={w}
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: highContrast ? '#ffc107' : 'var(--text-secondary)',
              padding: '6px 0',
            }}
          >
            {w}
          </div>
        ))}
        {Array.from({ length: calendarCellCount }, (_, i) => {
          const dayNum = i < startWeekday ? null : i - startWeekday + 1;
          const isInMonth = dayNum !== null && dayNum <= daysInMonth;
          const dateKey = isInMonth ? `${calYear}-${String(calMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}` : null;
          const count = dateKey ? (calendarDayLogsMap[dateKey]?.length ?? 0) : 0;
          const ledgerCount = dateKey ? (calendarDayLedgerMap[dateKey]?.length ?? 0) : 0;
          const todoDueCount = dateKey ? (calendarDayDueTodoCount[dateKey] ?? 0) : 0;
          const selected = dateKey === selectedCalendarDate;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedCalendarDate(isInMonth && dateKey ? dateKey : null)}
              style={{
                minHeight: 52,
                padding: 0,
                border: 'none',
                borderRadius: 8,
                background: !isInMonth
                  ? 'transparent'
                  : selected
                    ? (highContrast ? 'rgba(255,193,7,0.3)' : 'color-mix(in srgb, var(--accent) 22%, var(--bg-card))')
                    : highContrast
                      ? '#2a2a2a'
                      : 'var(--bg-card)',
                color: !isInMonth
                  ? (highContrast ? '#6b7280' : 'var(--divider)')
                  : selected
                    ? (highContrast ? '#ffc107' : 'var(--accent-hover)')
                    : highContrast
                      ? '#fff'
                      : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: selected ? 700 : 500,
                cursor: isInMonth ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                boxShadow: highContrast && selected ? '0 0 0 2px #ffc107' : undefined,
              }}
            >
              <span style={{ lineHeight: 1 }}>{isInMonth ? dayNum : ''}</span>
              <span
                style={{
                  fontSize: 10,
                  marginTop: 0,
                  minHeight: 12,
                  color: highContrast ? '#ffc107' : 'var(--text-secondary)',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  opacity: count > 0 ? 1 : 0,
                }}
              >
                {count > 0 ? `${count}건` : '0건'}
              </span>
              {ledgerCount > 0 ? (
                <span
                  style={{
                    fontSize: 9,
                    color: highContrast ? '#86efac' : 'var(--accent)',
                    lineHeight: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                  aria-hidden
                >
                  <Wallet size={10} strokeWidth={1.5} />
                  {ledgerCount}
                </span>
              ) : null}
              {todoDueCount > 0 ? (
                <span
                  style={{
                    fontSize: 9,
                    color: highContrast ? '#c4b5fd' : '#6366f1',
                    lineHeight: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                  aria-hidden
                >
                  <CheckSquare2 size={10} strokeWidth={1.5} />
                  {todoDueCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {selectedCalendarDate && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 10,
              padding: '8px 12px',
              borderRadius: 10,
              background: highContrast ? 'rgba(255,193,7,0.15)' : 'var(--bg-subtle)',
              borderLeft: highContrast ? '4px solid #ffc107' : '4px solid var(--text-secondary)',
              color: highContrast ? '#ffc107' : 'var(--text-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={20} strokeWidth={1.5} aria-hidden />
              {selectedCalendarDate.replace(/-/g, '.')} 상세
            </span>
            <button
              type="button"
              onClick={() => setSelectedCalendarDate(null)}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: 8,
                background: highContrast ? '#333' : 'var(--divider)',
                color: highContrast ? '#fff' : 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
          <CalendarDayLedgerSection
            entries={selectedCalendarDayLedgerEntries}
            getMemberName={getMemberName}
            t={t}
            theme={theme}
            highContrast={highContrast}
            onOpenLedgerTab={onOpenLedgerFromDay}
          />
          <CalendarDayTodoSection
            tasks={selectedCalendarDayTodos}
            t={t}
            theme={theme}
            highContrast={highContrast}
            onOpenTodoTab={onOpenTodoFromDay}
          />
          <div
            style={{
              maxHeight: '45vh',
              overflowY: 'auto',
              borderRadius: 12,
              border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              padding: 10,
            }}
          >
            {selectedDayLogs.length === 0 ? (
              <Empty message={t('calendarDayNoLogs')} captionColor={theme.textSecondary} />
            ) : (
              selectedDayLogs.map((log) => {
                const displaySlug = getEffectiveLogSlug(log);
                return (
                  <div
                    key={log.id}
                    className="log-card"
                    style={highContrast ? { border: '1px solid #ffc107', background: '#2a2a2a' } : undefined}
                  >
                    <LogTagBadge
                      slug={displaySlug}
                      onClick={() => applyTagFromLogCard(displaySlug)}
                      aria-label={`태그 ${t(getLogTagLabelKey(displaySlug))} 필터`}
                    >
                      #{t(getLogTagLabelKey(displaySlug))}
                    </LogTagBadge>
                    <div className="log-time" style={highContrast ? { color: '#94a3b8' } : undefined}>{formatDateTime(log.created_at)}</div>
                    <div className="log-content" style={highContrast ? { color: '#fff' } : undefined}>
                      {getParsedLog(log).text}
                    </div>
                    {(() => {
                      const meta = getParsedLog(log).meta;
                      if (!meta.locationName && !meta.locationUrl) return null;
                      return (
                        <a
                          href={meta.locationUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            margin: '6px 0 8px',
                            fontSize: 12,
                            color: highContrast ? '#ffc107' : 'var(--accent)',
                            textDecoration: 'none',
                          }}
                        >
                          <MapPin size={16} strokeWidth={1.5} aria-hidden />
                          {meta.locationName || '지도 보기'}
                          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
                        </a>
                      );
                    })()}
                    {(() => {
                      const { imageUrls, videoUrl } = getLogMedia(log);
                      if (imageUrls.length === 0 && !videoUrl) return null;
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: '100%', marginBottom: 8 }}>
                          {imageUrls.slice(0, 3).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 8, overflow: 'hidden', maxWidth: 100 }}>
                              <img src={url} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', display: 'block', background: 'var(--bg-subtle)' }} />
                            </a>
                          ))}
                          {imageUrls.length > 3 && <span style={{ fontSize: 12, color: highContrast ? '#94a3b8' : 'var(--text-secondary)' }}>+{imageUrls.length - 3}</span>}
                          {videoUrl && (
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: 160 }}>
                              <video src={videoUrl} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 120, display: 'block' }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="log-author" style={highContrast ? { color: '#94a3b8' } : undefined}>{getMemberName(log.actor_user_id)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-primary)' }}>
          <Baby size={20} strokeWidth={1.5} aria-hidden />
          성장 타임라인
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {(
            [
              { key: 'week' as const, label: '1주' },
              { key: 'month' as const, label: '1개월' },
              { key: 'quarter' as const, label: '분기' },
              { key: 'half' as const, label: '반기' },
              { key: 'year' as const, label: '연간' },
              { key: 'all' as const, label: '전체' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setGrowthRange(opt.key)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: `1px solid ${growthRange === opt.key ? 'var(--accent)' : 'var(--divider)'}`,
                background: growthRange === opt.key ? 'var(--accent-light)' : 'var(--bg-card)',
                color: growthRange === opt.key ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {growthTimelineView.visible.map((log) => {
            const { imageUrls, videoUrl } = getLogMedia(log);
            const cleanImages = imageUrls.map((u) => normalizeMediaUrl(u)).filter((u) => u.length > 0);
            const cleanVideo = normalizeMediaUrl(videoUrl);
            const media = getPrimaryMedia(log);
            const thumb = media?.url ?? '';
            const parsed = getParsedLog(log);
            return (
              <button
                key={`growth-${log.id}`}
                type="button"
                onClick={() => {
                  if (!media) return;
                  if (cleanImages.length > 0) {
                    const params = new URLSearchParams();
                    params.set('type', 'image');
                    if (growthTimelineView.swipeImageUrls.length > 1) {
                      const idx = growthTimelineView.imageIndexByLogId[log.id] ?? 0;
                      params.set('index', String(idx));
                      params.set('url', growthTimelineView.swipeImageUrls[idx] ?? cleanImages[0]);
                      try {
                        const key = `media_urls_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                        sessionStorage.setItem(key, JSON.stringify(growthTimelineView.swipeImageUrls));
                        params.set('urlsKey', key);
                      } catch {
                        params.set('urls', JSON.stringify(growthTimelineView.swipeImageUrls));
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
                  border: '1px solid var(--divider)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--bg-card)',
                  padding: 0,
                  textAlign: 'left',
                  cursor: media ? 'pointer' : 'default',
                }}
              >
                {thumb ? (
                  media?.type === 'video' ? (
                    <div
                      style={{
                        width: '100%',
                        height: 120,
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
                  ) : (
                    <img src={thumb} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  )
                ) : (
                  <div style={{ height: 120, background: 'var(--bg-subtle)' }} />
                )}
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{formatDateTime(log.created_at).slice(0, 12)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parsed.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-primary)' }}>
          <History size={20} strokeWidth={1.5} aria-hidden />
          오늘의 회상
        </div>
        {todayMemoryLogs.length === 0 ? (
          <Empty tone="caption" message={t('todayMemoryEmpty')} captionColor={highContrast ? '#94a3b8' : 'var(--text-secondary)'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayMemoryLogs.map((log) => {
              const year = new Date(log.created_at).getFullYear();
              const parsed = getParsedLog(log);
              return (
                <div key={`memory-${log.id}`} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--divider)', background: highContrast ? '#1e1e1e' : 'var(--bg-card)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#ffc107' : 'var(--text-secondary)', marginBottom: 4 }}>{year}년 오늘</div>
                  <div style={{ fontSize: 13, color: highContrast ? 'var(--divider)' : 'var(--text-primary)' }}>{parsed.text}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
