'use client';

import { useMemo } from 'react';
import type { Log } from './logTypes';
import { getEffectiveLogSlug, isBamtoliLog } from './logDerived';

type TabId = 'home' | 'calendar' | 'search' | 'todo' | 'ledger';
type LogSlugFilter = 'all' | string;
type GrowthRange = 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all';
type LogGroup = { dateKey: string; dateLabel: string; items: Log[] };

type UseLogDerivedViewsArgs = {
  logs: Log[];
  feedTagFilter: LogSlugFilter;
  calendarTagFilter: LogSlugFilter;
  activeTab: TabId;
  searchQuery: string;
  searchShuffleSeed: number;
  selectedCalendarDate: string | null;
  calYear: number;
  calMonth: number;
  growthRange: GrowthRange;
  filterLogsBySelectedMember: (logs: Log[]) => Log[];
  getPrimaryMedia: (log: Log) => { type: 'image' | 'video'; url: string } | null;
  getLogMedia: (log: Log) => { imageUrls: string[]; videoUrl?: string | null };
};

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function useLogDerivedViews({
  logs,
  feedTagFilter,
  calendarTagFilter,
  activeTab,
  searchQuery,
  searchShuffleSeed,
  selectedCalendarDate,
  calYear,
  calMonth,
  growthRange,
  filterLogsBySelectedMember,
  getPrimaryMedia,
  getLogMedia,
}: UseLogDerivedViewsArgs) {
  const todayLogCount = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    let list = feedTagFilter === 'all' ? logs : logs.filter((l) => getEffectiveLogSlug(l) === feedTagFilter);
    if (activeTab === 'search' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((l) => l.action.toLowerCase().includes(q));
    }
    list = filterLogsBySelectedMember(list);
    return list.filter((l) => {
      const dt = new Date(l.created_at);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }, [logs, feedTagFilter, activeTab, searchQuery, filterLogsBySelectedMember]);

  const logsForList = useMemo(() => {
    let list = feedTagFilter === 'all' ? logs : logs.filter((l) => getEffectiveLogSlug(l) === feedTagFilter);
    if (activeTab === 'search' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((l) => l.action.toLowerCase().includes(q));
    }
    return filterLogsBySelectedMember(list);
  }, [logs, feedTagFilter, activeTab, searchQuery, filterLogsBySelectedMember]);

  const logsByDate = useMemo(() => {
    return logsForList.reduce<LogGroup[]>((acc, log) => {
      const d = new Date(log.created_at);
      const dateKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dateLabel = `${dateKey.slice(0, 4)}.${dateKey.slice(5, 7)}.${dateKey.slice(8, 10)} (${weekdayNames[d.getDay()]})`;
      let group = acc.find((g) => g.dateKey === dateKey);
      if (!group) {
        group = { dateKey, dateLabel, items: [] };
        acc.push(group);
      }
      group.items.push(log);
      return acc;
    }, []);
  }, [logsForList]);

  const shuffledSearchLogs = useMemo(() => {
    const arr = [...logsForList];
    arr.sort((a, b) => hashStr(`${a.id}:${searchShuffleSeed}`) - hashStr(`${b.id}:${searchShuffleSeed}`));
    return arr;
  }, [logsForList, searchShuffleSeed]);

  const { searchMediaLogs, searchTextOnlyLogs } = useMemo(() => {
    const media: Log[] = [];
    const textOnly: Log[] = [];
    for (const log of shuffledSearchLogs) {
      const primary = getPrimaryMedia(log);
      if (primary) media.push(log);
      else textOnly.push(log);
    }
    return { searchMediaLogs: media, searchTextOnlyLogs: textOnly };
  }, [shuffledSearchLogs, getPrimaryMedia]);

  const searchMediaView = useMemo(() => {
    const visible = searchMediaLogs.slice(0, 120);
    const swipeImageUrls: string[] = [];
    const imageIndexByLogId: Record<string, number> = {};
    visible.forEach((log) => {
      const media = getPrimaryMedia(log);
      if (media?.type === 'image') {
        imageIndexByLogId[log.id] = swipeImageUrls.length;
        swipeImageUrls.push(media.url);
      }
    });
    return { visible, swipeImageUrls, imageIndexByLogId };
  }, [searchMediaLogs, getPrimaryMedia]);

  const logsForCalendar = useMemo(() => {
    const base = calendarTagFilter === 'all' ? logs : logs.filter((l) => getEffectiveLogSlug(l) === calendarTagFilter);
    return filterLogsBySelectedMember(base);
  }, [logs, calendarTagFilter, filterLogsBySelectedMember]);

  const calendarDayLogsMap = useMemo(() => {
    const map: Record<string, Log[]> = {};
    const prefix = `${calYear}-${String(calMonth).padStart(2, '0')}-`;
    logsForCalendar.forEach((log) => {
      const d = new Date(log.created_at);
      if (d.getFullYear() !== calYear || d.getMonth() !== calMonth - 1) return;
      const dateKey = `${prefix}${String(d.getDate()).padStart(2, '0')}`;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(log);
    });
    return map;
  }, [logsForCalendar, calYear, calMonth]);

  const selectedDayLogs = useMemo(() => {
    return selectedCalendarDate
      ? [...(calendarDayLogsMap[selectedCalendarDate] || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : [];
  }, [selectedCalendarDate, calendarDayLogsMap]);

  const growthCutoffMs = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    if (growthRange === 'week') d.setDate(d.getDate() - 7);
    else if (growthRange === 'month') d.setMonth(d.getMonth() - 1);
    else if (growthRange === 'quarter') d.setMonth(d.getMonth() - 3);
    else if (growthRange === 'half') d.setMonth(d.getMonth() - 6);
    else if (growthRange === 'year') d.setFullYear(d.getFullYear() - 1);
    else return 0;
    return d.getTime();
  }, [growthRange]);

  const growthTimelineLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (!isBamtoliLog(log)) return false;
        const { imageUrls, videoUrl } = getLogMedia(log);
        if (imageUrls.length === 0 && !videoUrl) return false;
        const ts = new Date(log.created_at).getTime();
        return growthCutoffMs === 0 || ts >= growthCutoffMs;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, growthCutoffMs, getLogMedia]);

  const growthTimelineView = useMemo(() => {
    const visible = growthTimelineLogs;
    const swipeImageUrls: string[] = [];
    const imageIndexByLogId: Record<string, number> = {};
    visible.forEach((log) => {
      const media = getPrimaryMedia(log);
      if (media?.type === 'image') {
        imageIndexByLogId[log.id] = swipeImageUrls.length;
        swipeImageUrls.push(media.url);
      }
    });
    return { visible, swipeImageUrls, imageIndexByLogId };
  }, [growthTimelineLogs, getPrimaryMedia]);

  const todayMemoryLogs = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    const year = now.getFullYear();
    return logs
      .filter((log) => {
        const d = new Date(log.created_at);
        return d.getMonth() === month && d.getDate() === day && d.getFullYear() < year;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12);
  }, [logs]);

  return {
    todayLogCount,
    logsForList,
    logsByDate,
    searchMediaLogs,
    searchTextOnlyLogs,
    searchMediaView,
    logsForCalendar,
    calendarDayLogsMap,
    selectedDayLogs,
    growthTimelineLogs,
    growthTimelineView,
    todayMemoryLogs,
  };
}
