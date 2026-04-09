'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import { getT, langLabels, type Lang } from './translations';
import { ChevronDown, Loader2 } from 'lucide-react';
import { LOG_SLUG, TOPIC_SLUGS, normalizeLogSlug, type LogSlug } from '../lib/logTags';
import { getLogMedia } from '../lib/logMedia';
import { FONT_STEPS, type FontScaleStep } from '../lib/accessibilityFont';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';
import { AppHeader } from '../components/layout/AppHeader';
import { SettingsMenuModal } from '../components/layout/SettingsMenuModal';
import { BottomTabBar, type TabId } from '../components/layout/BottomTabBar';
import { MemberFilter } from '../components/home/MemberFilter';
import { LogTagFilterRow } from '../components/home/LogTagFilterRow';
import { LogFeed } from '../components/home/LogFeed';
import { CommentSheet } from '../components/home/CommentSheet';
import { StickerPickerSheet } from '../components/home/StickerPickerSheet';
import { NameEditModal } from '../components/home/NameEditModal';
import { AccessibilitySettingsModal } from '../components/home/AccessibilitySettingsModal';
import { FamilyMemoPanel } from '../components/home/FamilyMemoPanel';
import { EnlargedAvatarOverlay } from '../components/home/EnlargedAvatarOverlay';
import { LedgerPanel } from '../components/home/LedgerPanel';
import { useHouseholdLedger } from '../features/ledger/useHouseholdLedger';
import type { LedgerEntry } from '../features/ledger/ledgerTypes';
import { LogActionSheet } from '../components/home/LogActionSheet';
import { Toast } from '../components/ui/Toast';
import { Empty } from '../components/ui/Empty';
import { ScrollReveal } from '../components/ui/ScrollReveal';
import { SearchTabPanel } from '../components/home/SearchTabPanel';
import { CalendarTabPanel } from '../components/home/CalendarTabPanel';
import { TodoBoard, type TodoPeriod, type TodoPriorityKey, type TodoTask } from '../components/home/TodoBoard';
import { usePullToRefresh } from '../features/home/usePullToRefresh';
import { useTabSwipeNavigation } from '../features/home/useTabSwipeNavigation';
import { useHouseholdBootstrap } from '../features/members/useHouseholdBootstrap';
import { useHouseholdMembers } from '../features/members/useHouseholdMembers';
import { useProfileEditor } from '../features/members/useProfileEditor';
import { getEffectiveLogSlug, getParsedLog } from '../features/logs/logDerived';
import { useLogComments } from '../features/logs/useLogComments';
import { useLogDerivedViews } from '../features/logs/useLogDerivedViews';
import { useHouseholdLogs } from '../features/logs/useHouseholdLogs';
import { useLogStickers } from '../features/logs/useLogStickers';
import { useHouseholdMemos } from '../features/memos/useHouseholdMemos';
import { useTodoSnapshots } from '../features/todos/useTodoSnapshots';
import type { Log } from '../features/logs/logTypes';

const SHARED_MEMO_LOG_PREFIX = '[[HOUSEHOLD_MEMO_V1]]';
const TODO_SNAPSHOT_PREFIX = '[[TODO_SNAPSHOT_V1]]';
type SharedMemoSnapshot = {
  content?: string;
  family_notice?: string;
  shopping_list?: string;
};

function parseSharedMemoSnapshot(action: string | null | undefined): SharedMemoSnapshot | null {
  if (!action || !action.startsWith(SHARED_MEMO_LOG_PREFIX)) return null;
  const raw = action.slice(SHARED_MEMO_LOG_PREFIX.length);
  try {
    const parsed = JSON.parse(raw) as SharedMemoSnapshot;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function composeSharedMemoSnapshot(snapshot: SharedMemoSnapshot): string {
  return `${SHARED_MEMO_LOG_PREFIX}${JSON.stringify(snapshot)}`;
}

function normalizeTodoPriorityKey(raw: unknown): TodoPriorityKey {
  const v = String(raw ?? '').trim();
  switch (v) {
    case 'urgentImportant':
      return 'urgentImportant';
    case 'notUrgentImportant':
    case 'importantNotUrgent':
    case 'not_urgent_important':
    case 'important_not_urgent':
    case 'q2':
    case '2':
      return 'notUrgentImportant';
    case 'urgentNotImportant':
    case 'notImportantUrgent':
    case 'urgent_not_important':
    case 'not_important_urgent':
    case 'q3':
    case '3':
      return 'urgentNotImportant';
    case 'notUrgentNotImportant':
    case 'notImportantNotUrgent':
    case 'not_urgent_not_important':
    case 'not_important_not_urgent':
    case 'q4':
    case '4':
      return 'notUrgentNotImportant';
    default:
      return 'urgentImportant';
  }
}

function parseTodoSnapshot(action: string | null | undefined): TodoTask[] | null {
  if (!action || !action.startsWith(TODO_SNAPSHOT_PREFIX)) return null;
  const raw = action.slice(TODO_SNAPSHOT_PREFIX.length);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((task, idx) => {
        if (!task || typeof task !== 'object') return null;
        const t = task as Partial<TodoTask> & Record<string, unknown>;
        const dueRaw = t.dueDate ?? t.due_date;
        const dueDate =
          typeof dueRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
        return {
          id: typeof t.id === 'number' && Number.isFinite(t.id) ? t.id : Date.now() + idx,
          text: typeof t.text === 'string' ? t.text : '',
          key: normalizeTodoPriorityKey(t.key ?? t.priority ?? t.quadrant ?? t.type),
          done: Boolean(t.done),
          createdAt: typeof t.createdAt === 'string' && t.createdAt ? t.createdAt : new Date().toISOString(),
          completedAt: typeof t.completedAt === 'string' ? t.completedAt : null,
          dueDate,
        } as TodoTask;
      })
      .filter((t): t is TodoTask => Boolean(t && t.text.trim().length > 0));
  } catch {
    return null;
  }
}

function composeTodoSnapshot(tasks: TodoTask[]): string {
  return `${TODO_SNAPSHOT_PREFIX}${JSON.stringify(tasks)}`;
}

const PLACES = [
  { slug: 'fridge', label: '냉장고' },
  { slug: 'table', label: '식탁' },
  { slug: 'toilet', label: '화장실' },
] as const;

const getPlaceLabel = (slug: string) => {
  const p = PLACES.find((x) => x.slug === slug);
  return p ? p.label : slug;
};

const getPlaceChipStyle = (slug: string) => {
  switch (slug) {
    case 'fridge':
      return { background: 'var(--place-fridge)', color: 'var(--place-fridge-icon)', border: '1px solid var(--place-fridge-icon)' };
    case 'table':
      return { background: 'var(--place-table)', color: 'var(--place-table-icon)', border: '1px solid var(--place-table-icon)' };
    case 'toilet':
      return { background: 'var(--place-toilet)', color: 'var(--place-toilet-icon)', border: '1px solid var(--place-toilet-icon)' };
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--text-caption)' };
  }
};

const ACCESSIBILITY_KEY = 'family_qr_log_accessibility';
const MEMO_KEY = 'family_qr_log_memo';
const ACTIVE_TAB_KEY = 'family_qr_log_active_tab';
const HOME_SCROLL_TOP_KEY = 'family_qr_log_home_scroll_top';

function legacyFontStep(scale: number): FontScaleStep {
  const idx = FONT_STEPS.findIndex((s) => Math.abs(s - scale) < 0.03);
  if (idx >= 0) return idx as FontScaleStep;
  if (scale <= 0.9) return 0;
  if (scale >= 1.9) return 7;
  return 3;
}

function loadAccessibility(): {
  highContrast: boolean;
  fontScaleStep: FontScaleStep;
  fontBold: boolean;
  simpleMode: boolean;
  language: Lang;
} {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(ACCESSIBILITY_KEY) : null;
    if (!raw) return { highContrast: false, fontScaleStep: 1, fontBold: false, simpleMode: false, language: 'ko' };
    const p = JSON.parse(raw);
    const lang: Lang = ['ko', 'en', 'ja', 'zh'].includes(p.language as string)
      ? (p.language as Lang)
      : 'ko';
    let fontScaleStep: FontScaleStep = 1;
    if (typeof p.fontScaleStep === 'number' && p.fontScaleStep >= 0 && p.fontScaleStep <= 7) {
      fontScaleStep = p.fontScaleStep as FontScaleStep;
    } else if (typeof p.fontScale === 'number') {
      fontScaleStep = legacyFontStep(p.fontScale);
    }
    return {
      highContrast: !!p.highContrast,
      fontScaleStep,
      fontBold: !!p.fontBold,
      simpleMode: !!p.simpleMode,
      language: lang,
    };
  } catch {
    return { highContrast: false, fontScaleStep: 1, fontBold: false, simpleMode: false, language: 'ko' };
  }
}

export default function HomeClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<'all' | 'me' | string>('all');
  const [feedTagFilter, setFeedTagFilter] = useState<'all' | LogSlug>('all');
  const [familyNotesEditing, setFamilyNotesEditing] = useState(false);
  const [feedFilterOpen, setFeedFilterOpen] = useState(false);

  const [status, setStatusInternal] = useState<string | null>(null);
  /** null이면 `inferToastVariant(status)` 사용 */
  const [statusToastTone, setStatusToastTone] = useState<'success' | 'error' | 'info' | null>(null);
  const [statusFading, setStatusFading] = useState(false);

  const setAppStatus = useCallback((msg: string | null, tone?: 'success' | 'error' | 'info') => {
    setStatusInternal(msg);
    if (msg === null) setStatusToastTone(null);
    else setStatusToastTone(tone !== undefined ? tone : null);
  }, []);
  const reportErrorStatus = useCallback((message: string) => {
    setAppStatus(message, 'error');
  }, [setAppStatus]);
  const clearAppStatus = useCallback(() => {
    setAppStatus(null);
  }, [setAppStatus]);
  const reportStatus = useCallback((message: string, tone?: 'success' | 'error' | 'info') => {
    setAppStatus(message, tone);
  }, [setAppStatus]);
  const excludedLogPrefixes = useMemo(
    () => [TODO_SNAPSHOT_PREFIX, SHARED_MEMO_LOG_PREFIX],
    []
  );
  const { logs, setLogs, logsInitialLoading, loadLogs, refreshLogs } = useHouseholdLogs({
    householdId,
    userId: user?.id,
    excludedActionPrefixes: excludedLogPrefixes,
    onError: reportErrorStatus,
  });
  const {
    members,
    setMembers,
    profileName,
    setProfileName,
    profileAvatarUrl,
    setProfileAvatarUrl,
    profileAvatarLoadFailed,
    setProfileAvatarLoadFailed,
    avatarFailedUserIds,
    setAvatarFailedUserIds,
    reloadMembersList,
    applyOwnDisplayName,
    applyOwnAvatarUrl,
  } = useHouseholdMembers();
  const [enlargedAvatarUrl, setEnlargedAvatarUrl] = useState<string | null>(null);
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScaleStep, setFontScaleStep] = useState<FontScaleStep>(1);
  const [fontBold, setFontBold] = useState(false);
  const [accFontDraft, setAccFontDraft] = useState<{ step: FontScaleStep; bold: boolean }>({ step: 1, bold: false });
  const [simpleMode, setSimpleMode] = useState(false);
  const [language, setLanguage] = useState<Lang>('ko');

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState('');
  const [actionPopupLogId, setActionPopupLogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [searchShuffleSeed, setSearchShuffleSeed] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const {
    memoContent,
    setMemoContent,
    familyNotice,
    setFamilyNotice,
    shoppingList,
    setShoppingList,
    memoSaving,
    sharedMemoTypingUntilRef,
    canApplyIncomingSharedMemo,
    saveSharedMemos: persistSharedMemosNow,
    refreshSharedMemos,
  } = useHouseholdMemos({
    householdId,
    userId: user?.id,
    familyNotesEditing,
    showMemoPanel,
    memoKey: MEMO_KEY,
    sharedMemoLogPrefix: SHARED_MEMO_LOG_PREFIX,
    parseSharedMemoSnapshot,
    composeSharedMemoSnapshot,
    onError: reportErrorStatus,
  });
  const {
    profileSaving,
    profileAvatarUploading,
    profileAvatarInputRef,
    handleProfileSave,
    handleProfileAvatarChange,
  } = useProfileEditor({
    userId: user?.id,
    householdId,
    profileName,
    setProfileAvatarUrl,
    setProfileAvatarLoadFailed,
    applyOwnDisplayName,
    applyOwnAvatarUrl,
    onStatus: reportStatus,
  });
  const [todoTasks, setTodoTasks] = useState<TodoTask[]>([]);
  const { markTodoDirty, refreshTodoSnapshot } = useTodoSnapshots({
    householdId,
    userId: user?.id,
    todoTasks,
    setTodoTasks,
    todoSnapshotPrefix: TODO_SNAPSHOT_PREFIX,
    parseTodoSnapshot,
    composeTodoSnapshot,
  });
  const [todoCompletedPeriod, setTodoCompletedPeriod] = useState<TodoPeriod>('day');
  const [calendarYearMonth, setCalendarYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [calendarTagFilter, setCalendarTagFilter] = useState<'all' | LogSlug>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [ledgerOccurredOnPrefill, setLedgerOccurredOnPrefill] = useState<string | null>(null);
  const [todoDueDatePrefill, setTodoDueDatePrefill] = useState<string | null>(null);
  const [growthRange, setGrowthRange] = useState<'week' | 'month' | 'quarter' | 'half' | 'year' | 'all'>('month');
  const [memoPanelAnimated, setMemoPanelAnimated] = useState(false);
  const homeScrollRef = useRef<HTMLDivElement | null>(null);
  const activeTabInitializedRef = useRef(false);
  const pendingRestoreTopRef = useRef<number | null>(null);
  const restoreAttemptRef = useRef(0);
  const restoreTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  const fontScale = FONT_STEPS[fontScaleStep];
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Keep current behavior when user switches tabs, but do not force-reset on initial mount.
    if (!activeTabInitializedRef.current) {
      activeTabInitializedRef.current = true;
      return;
    }
    const el = homeScrollRef.current;
    if (el) el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    // Restore scroll position after returning from media viewer.
    try {
      const raw = sessionStorage.getItem(HOME_SCROLL_TOP_KEY);
      if (!raw) return;
      const nextTop = Number(raw);
      if (!Number.isFinite(nextTop) || nextTop < 0) return;
      pendingRestoreTopRef.current = nextTop;
      restoreAttemptRef.current = 0;
    } catch {}
  }, []);
  const tryRestoreHomeScroll = useCallback(() => {
    const targetTop = pendingRestoreTopRef.current;
    if (targetTop == null) return;
    const el = homeScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });
    const diff = Math.abs(el.scrollTop - targetTop);
    if (diff <= 2 || restoreAttemptRef.current >= 8) {
      pendingRestoreTopRef.current = null;
      restoreAttemptRef.current = 0;
      try {
        sessionStorage.removeItem(HOME_SCROLL_TOP_KEY);
      } catch {}
      return;
    }
    restoreAttemptRef.current += 1;
    if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = window.setTimeout(() => {
      tryRestoreHomeScroll();
    }, 90);
  }, []);
  useEffect(() => {
    // Retry restore while dynamic feed contents settle.
    if (activeTab !== 'home') return;
    if (pendingRestoreTopRef.current == null) return;
    tryRestoreHomeScroll();
  }, [activeTab, logs.length, tryRestoreHomeScroll]);
  useEffect(() => {
    if (pathname !== '/') return;
    if (pendingRestoreTopRef.current == null) return;
    tryRestoreHomeScroll();
  }, [pathname, tryRestoreHomeScroll]);
  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
      const el = homeScrollRef.current;
      if (!el) return;
      try {
        sessionStorage.setItem(HOME_SCROLL_TOP_KEY, String(el.scrollTop));
      } catch {}
    };
  }, []);

  useHouseholdBootstrap({
    setUser,
    setHouseholdId,
    setIsAdmin,
    setProfileName,
    setProfileAvatarUrl,
    setProfileAvatarLoadFailed,
    setMembers,
    onError: reportErrorStatus,
    onStart: clearAppStatus,
  });

  useEffect(() => {
    if (!status) return;
    setStatusFading(false);

    const autoHide =
      status.includes('로그가 추가되었습니다') ||
      status.includes('수정되었습니다') ||
      status.includes('삭제되었습니다') ||
      status.includes('이름이 저장되었습니다') ||
      status.includes('프로필 사진이 변경되었습니다') ||
      status.includes('가족 메모가 저장되었습니다');

    if (!autoHide) return;

    const fadeTimer = window.setTimeout(() => setStatusFading(true), 1600);
    const clearTimer = window.setTimeout(() => setAppStatus(null), 2400);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [status]);

  useEffect(() => {
    if (showMemoPanel) {
      setMemoPanelAnimated(false);
      const id = requestAnimationFrame(() => setMemoPanelAnimated(true));
      return () => cancelAnimationFrame(id);
    } else {
      setMemoPanelAnimated(false);
    }
  }, [showMemoPanel]);

  useEffect(() => {
    if (showAccessibilityModal) {
      setAccFontDraft({ step: fontScaleStep, bold: fontBold });
    }
  }, [showAccessibilityModal]);

  const accessibilityLoadedRef = useRef(false);
  useEffect(() => {
    const a = loadAccessibility();
    setHighContrast(a.highContrast);
    setFontScaleStep(a.fontScaleStep);
    setFontBold(a.fontBold);
    setSimpleMode(a.simpleMode);
    setLanguage(a.language);
    accessibilityLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!accessibilityLoadedRef.current) return;
    try {
      localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify({
        highContrast,
        fontScaleStep,
        fontBold,
        simpleMode,
        language,
      }));
    } catch {}
  }, [highContrast, fontScaleStep, fontBold, simpleMode, language]);

  const t = useMemo(() => getT(language), [language]);

  const {
    stickerPickerOpen,
    stickerPickerLogId,
    stickerSaving,
    openStickerPicker,
    closeStickerPicker,
    pickSticker,
    selectedStickerLogOwnSticker,
  } = useLogStickers({
    userId: user?.id,
    householdId,
    logs,
    setLogs,
    onReloadLogs: async (hid) => {
      await loadLogs(hid, undefined, undefined);
    },
    onError: reportErrorStatus,
  });
  const {
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
  } = useLogComments({
    logIds: [...new Set(logs.map((l) => l.id))],
    userId: user?.id,
    onError: reportErrorStatus,
    onSuccess: (message) => setAppStatus(message, 'success'),
  });

  const householdLedger = useHouseholdLedger({
    householdId,
    userId: user?.id,
    onError: reportErrorStatus,
    t,
  });
  const { loadEntries: loadLedgerEntries } = householdLedger;

  const clearLedgerOccurredOnPrefill = useCallback(() => setLedgerOccurredOnPrefill(null), []);
  const clearTodoDueDatePrefill = useCallback(() => setTodoDueDatePrefill(null), []);

  const normalizeUserIdForCompare = useCallback((v: string | null | undefined) => {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }, []);


  useEffect(() => {
    // 홈에서는 “전체”만 보여주도록 강제합니다.
    if (activeTab === 'home') setFeedTagFilter('all');
  }, [activeTab]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_TAB_KEY);
      if (raw === 'home' || raw === 'calendar' || raw === 'search' || raw === 'todo' || raw === 'ledger') {
        setActiveTab(raw);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'search') {
      setSearchShuffleSeed(Date.now());
    }
  }, [activeTab]);

  const performPullRefresh = useCallback(async () => {
    if (!householdId || !user) return;
    await loadLogs(householdId, undefined, undefined);
    await reloadMembersList(householdId);
    await refreshTodoSnapshot();
    await loadLedgerEntries();

    if (canApplyIncomingSharedMemo()) {
      await refreshSharedMemos();
    }
  }, [householdId, user, loadLogs, reloadMembersList, canApplyIncomingSharedMemo, refreshTodoSnapshot, refreshSharedMemos, loadLedgerEntries]);
  const { pullRefreshOffset, pullRefreshRefreshing } = usePullToRefresh({
    scrollRef: homeScrollRef,
    enabled: !!householdId && !!user,
    onRefresh: performPullRefresh,
  });

  const tabSwipeGestureEnabled =
    !!user &&
    !!householdId &&
    !showMemoPanel &&
    !settingsMenuOpen &&
    !commentTarget &&
    !stickerPickerOpen &&
    !showNameEditModal &&
    !showAccessibilityModal &&
    !actionPopupLogId &&
    !enlargedAvatarUrl;

  useTabSwipeNavigation({
    scrollRef: homeScrollRef,
    activeTab,
    onTabChange: setActiveTab,
    enabled: tabSwipeGestureEnabled,
  });

  const handleUpdateLog = async (logId: string, newAction: string) => {
    if (!user || !householdId) return;
    const prevLog = logs.find((log) => log.id === logId);
    if (!prevLog) return;
    const prevAction = prevLog.action;
    setLogs((prev) => prev.map((log) => (log.id === logId ? { ...log, action: newAction } : log)));
    const { error } = await supabase.from('logs').update({ action: newAction }).eq('id', logId).eq('actor_user_id', user.id);
    if (error) {
      setLogs((prev) => prev.map((log) => (log.id === logId ? { ...log, action: prevAction } : log)));
      setAppStatus(`수정 실패: ${error.message}`, 'error');
      return;
    }
    setEditingLogId(null);
    setEditingAction('');
    setAppStatus('수정되었습니다.', 'success');
    refreshLogs();
  };

  const handleDeleteLog = async (logId: string) => {
    if (!user || !householdId) return;
    if (!window.confirm(t('deleteConfirm'))) return;
    const prevLogs = logs;
    setLogs((prev) => prev.filter((log) => log.id !== logId));
    const { error } = await supabase.from('logs').delete().eq('id', logId).eq('actor_user_id', user.id);
    if (error) {
      setLogs(prevLogs);
      setAppStatus(`삭제 실패: ${error.message}`, 'error');
      return;
    }
    setEditingLogId(null);
    setAppStatus('삭제되었습니다.', 'success');
    refreshLogs();
  };

  const getMemberName = (userId: string) => {
    const m = members.find((mm) => mm.user_id === userId);
    const name = m?.display_name;
    if (name && name.trim().length > 0) return name.trim();
    if (user && user.id === userId && user.email) return user.email.split('@')[0];
    return `${userId.slice(0, 8)}...`;
  };
  const isSameUserId = useCallback((a: string | null | undefined, b: string | null | undefined) => {
    const aa = normalizeUserIdForCompare(a);
    const bb = normalizeUserIdForCompare(b);
    return aa.length > 0 && aa === bb;
  }, [normalizeUserIdForCompare]);

  const filterLogsBySelectedMember = useCallback(
    (list: Log[]): Log[] => {
      if (!user || selectedMemberId === 'all') return list;
      if (selectedMemberId === 'me') return list.filter((l) => isSameUserId(l.actor_user_id, user.id));
      return list.filter((l) => isSameUserId(l.actor_user_id, selectedMemberId));
    },
    [user, selectedMemberId, isSameUserId]
  );

  const meDisplayName =
    profileName || (user?.email ? user.email.split('@')[0] : t('me'));
  const getLogTagLabelKey = (slug: string) => {
    const normalized = normalizeLogSlug(slug);
    const map: Record<string, string> = {
      [LOG_SLUG.daily]: 'logDaily',
      [LOG_SLUG.general]: 'logGeneral',
      [LOG_SLUG.notice]: 'logNotice',
      [LOG_SLUG.daddy]: 'tagDaddy',
      [LOG_SLUG.mommy]: 'tagMommy',
      [LOG_SLUG.bamtoli]: 'tagBamtoli',
      [LOG_SLUG.eomniAbuji]: 'tagEomniAbuji',
      [LOG_SLUG.motheriPpadeori]: 'tagMotheriPpadeori',
      [LOG_SLUG.danine]: 'tagDanine',
      [LOG_SLUG.uchacha]: 'tagUchacha',
      [LOG_SLUG.ttolMorning]: 'tagTtolMorning',
      todo: 'topicTodo',
    };
    return map[normalized] ?? 'logGeneral';
  };

  const normalizeMediaUrl = useCallback((url: string | null | undefined) => {
    if (!url) return '';
    const trimmed = String(url)
      .trim()
      .replace(/^["'\[\(]+/, '')
      .replace(/[)\]}",'`]+$/g, '');
    const unescaped = trimmed.replace(/\\\//g, '/');
    if (unescaped.startsWith('//')) return `https:${unescaped}`;
    if (unescaped.startsWith('http://') || unescaped.startsWith('https://') || unescaped.startsWith('/')) return unescaped;
    const extracted = unescaped.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? '';
    if (extracted) return extracted.replace(/\\\//g, '/');
    return '';
  }, []);

  const getPrimaryMedia = useCallback((log: Log): { type: 'image' | 'video'; url: string } | null => {
    const { imageUrls, videoUrl } = getLogMedia(log);
    const image = imageUrls.map((u) => normalizeMediaUrl(u)).find((u) => u.length > 0) ?? '';
    if (image) return { type: 'image', url: image };
    const video = normalizeMediaUrl(videoUrl);
    if (video) return { type: 'video', url: video };
    return null;
  }, [normalizeMediaUrl]);

  const feedTagOptions = useMemo(() => {
    const topicLabels = ['밤톨대디', '밤톨맘', '밤톨이', '엄니아부지', '마더리빠더리'] as const;
    const topicRows = TOPIC_SLUGS.map((slug, i) => ({
      key: slug,
      label: topicLabels[i] ?? slug,
    }));
    return [
      { key: 'all' as const, label: '전체' },
      { key: LOG_SLUG.daily, label: '일상' },
      { key: LOG_SLUG.general, label: '다같이' },
      ...topicRows,
      { key: LOG_SLUG.danine, label: '단이네' },
      { key: LOG_SLUG.uchacha, label: '우차차' },
      { key: LOG_SLUG.ttolMorning, label: '똘모닝' },
      { key: LOG_SLUG.notice, label: '공지사항' },
    ];
  }, []);

  const allowedFeedSlugSet = useMemo(() => {
    const s = new Set<string>(['all', LOG_SLUG.daily, LOG_SLUG.general, LOG_SLUG.notice, LOG_SLUG.danine, LOG_SLUG.uchacha, LOG_SLUG.ttolMorning]);
    TOPIC_SLUGS.forEach((slug) => s.add(slug));
    return s;
  }, []);

  const onFeedTagSelect = useCallback(
    (raw: string) => {
      if (raw === 'all') {
        setFeedTagFilter('all');
        return;
      }
      if (allowedFeedSlugSet.has(raw)) setFeedTagFilter(raw as LogSlug);
    },
    [allowedFeedSlugSet]
  );

  const applyTagFromLogCard = useCallback((rawSlug: string) => {
    const slug = normalizeLogSlug(rawSlug);
    onFeedTagSelect(slug);
    setActiveTab('home');
    setFeedFilterOpen(true);
  }, [onFeedTagSelect]);

  const [calYear, calMonth] = calendarYearMonth.split('-').map(Number);
  const calendarFirstDay = new Date(calYear, calMonth - 1, 1);
  const calendarLastDay = new Date(calYear, calMonth, 0);
  const startWeekday = calendarFirstDay.getDay();
  const daysInMonth = calendarLastDay.getDate();
  const calendarCellCount = useMemo(() => {
    const used = startWeekday + daysInMonth;
    return Math.ceil(used / 7) * 7;
  }, [startWeekday, daysInMonth]);

  const calendarHeaderMonthLabel = useMemo(() => {
    const d = new Date(calYear, calMonth - 1, 1);
    const loc =
      language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleDateString(loc, { year: 'numeric', month: 'long' });
  }, [calYear, calMonth, language]);
  const todoActiveByGroup = useMemo(() => {
    const map: Record<TodoPriorityKey, TodoTask[]> = {
      urgentImportant: [],
      notUrgentImportant: [],
      urgentNotImportant: [],
      notUrgentNotImportant: [],
    };
    const cmpDue = (a: TodoTask, b: TodoTask) => {
      const da = a.dueDate ?? '';
      const db = b.dueDate ?? '';
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    };
    todoTasks
      .filter((task) => !task.done)
      .forEach((task) => {
        const key = normalizeTodoPriorityKey(task.key);
        map[key].push({ ...task, key });
      });
    (Object.keys(map) as TodoPriorityKey[]).forEach((k) => {
      map[k].sort(cmpDue);
    });
    return map;
  }, [todoTasks]);
  const todoCompletedGroups = useMemo(() => {
    const weekdayLabel = ['일', '월', '화', '수', '목', '금', '토'];
    const formatDateLabel = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}(${weekdayLabel[date.getDay()]})`;
    };
    const formatDateKey = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const grouped = new Map<string, { label: string; sortKey: string; tasks: TodoTask[] }>();
    const done = todoTasks.filter((task) => task.done && task.completedAt);
    const today = new Date();

    done.forEach((task) => {
      const d = new Date(task.completedAt as string);
      let groupId = '';
      let label = '';
      let sortKey = '';

      if (todoCompletedPeriod === 'day') {
        groupId = formatDateKey(d);
        label = groupId;
        sortKey = groupId;
      } else if (todoCompletedPeriod === 'month') {
        groupId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = groupId;
        sortKey = groupId;
      } else {
        const day = d.getDay();
        const diff = (day + 6) % 7;
        const weekStart = new Date(d);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(d.getDate() - diff);

        const nominalWeekEnd = new Date(weekStart);
        nominalWeekEnd.setDate(weekStart.getDate() + 6);
        nominalWeekEnd.setHours(23, 59, 59, 999);

        const isCurrentWeek = today >= weekStart && today <= nominalWeekEnd;
        const weekEndForLabel = isCurrentWeek ? today : nominalWeekEnd;

        groupId = formatDateKey(weekStart);
        label = `${formatDateLabel(weekStart)} ~ ${formatDateLabel(weekEndForLabel)}`;
        sortKey = formatDateKey(weekStart);
      }

      if (!grouped.has(groupId)) {
        grouped.set(groupId, { label, sortKey, tasks: [] });
      }
      grouped.get(groupId)!.tasks.push(task);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .map((entry) => [entry.label, entry.tasks] as [string, TodoTask[]]);
  }, [todoTasks, todoCompletedPeriod]);
  const {
    todayLogCount,
    logsByDate,
    searchMediaLogs,
    searchTextOnlyLogs,
    searchMediaView,
    calendarDayLogsMap,
    selectedDayLogs,
    growthTimelineView,
    todayMemoryLogs,
  } = useLogDerivedViews({
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
  });

  const calendarDayLedgerMap = useMemo(() => {
    const map: Record<string, LedgerEntry[]> = {};
    for (const e of householdLedger.entries) {
      const d = e.occurred_on;
      if (!map[d]) map[d] = [];
      map[d].push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return map;
  }, [householdLedger.entries]);

  const selectedCalendarDayLedgerEntries = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return calendarDayLedgerMap[selectedCalendarDate] ?? [];
  }, [selectedCalendarDate, calendarDayLedgerMap]);

  const calendarDayDueTodoCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of todoTasks) {
      if (task.done || !task.dueDate) continue;
      const d = task.dueDate;
      map[d] = (map[d] ?? 0) + 1;
    }
    return map;
  }, [todoTasks]);

  const selectedCalendarDayTodos = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return todoTasks
      .filter((task) => !task.done && task.dueDate === selectedCalendarDate)
      .sort((a, b) => a.key.localeCompare(b.key) || a.text.localeCompare(b.text));
  }, [selectedCalendarDate, todoTasks]);

  const closeMemoPanel = () => {
    setMemoPanelAnimated(false);
    setTimeout(() => setShowMemoPanel(false), 620);
  };
  const addTodoTask = useCallback((key: TodoPriorityKey, text: string, dueDate?: string | null) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const due =
      typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null;
    markTodoDirty();
    setTodoTasks((prev) => [
      {
        id: Date.now(),
        text: trimmed,
        key,
        done: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        dueDate: due,
      },
      ...prev,
    ]);
  }, [markTodoDirty]);

  const toggleTodoTaskDone = useCallback((id: number) => {
    markTodoDirty();
    setTodoTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, done: !task.done, completedAt: task.done ? null : new Date().toISOString() }
          : task
      )
    );
  }, [markTodoDirty]);

  const removeTodoTask = useCallback((id: number) => {
    markTodoDirty();
    setTodoTasks((prev) => prev.filter((task) => task.id !== id));
  }, [markTodoDirty]);

  const updateTodoTask = useCallback(
    (id: number, patch: { text?: string; dueDate?: string | null }) => {
      markTodoDirty();
      setTodoTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id) return task;
          const next = { ...task };
          if (typeof patch.text === 'string') {
            const trimmed = patch.text.trim();
            if (!trimmed) return task;
            next.text = trimmed;
          }
          if ('dueDate' in patch) {
            const d = patch.dueDate;
            next.dueDate = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
          }
          return next;
        })
      );
    },
    [markTodoDirty]
  );

  const saveSharedMemos = useCallback(async () => {
    if (!householdId || !user) return;
    const result = await persistSharedMemosNow();
    if (!result.ok) {
      setAppStatus(`메모 저장 실패: ${result.errorMessage}`, 'error');
      return;
    }
    if (result.mode === 'content-only') {
      setAppStatus('가족 공지/장보기 메모는 서버 컬럼이 없어 완전히 저장되지 않았습니다. Supabase 컬럼 설정을 확인해 주세요.', 'error');
      return;
    }
    if (result.mode === 'log-fallback') {
      setAppStatus('가족 메모가 예비 방식으로 저장되었습니다. 앱 재설치 전 Supabase 메모 테이블 설정을 확인해 주세요.', 'error');
      return;
    }
    setAppStatus('가족 메모가 저장되었습니다.', 'success');
  }, [householdId, user, persistSharedMemosNow]);

  const theme = {
    bg: highContrast ? '#0f0f0f' : 'var(--bg-base)',
    card: highContrast ? '#1a1a1a' : 'var(--bg-card)',
    cardShadow: highContrast ? 'none' : 'var(--shadow-card)',
    border: highContrast ? '1px solid #333' : '1px solid var(--divider)',
    text: highContrast ? '#ffffff' : 'var(--text-primary)',
    textSecondary: highContrast ? '#a1a1a1' : 'var(--text-secondary)',
    radius: 12,
    radiusLg: 16,
  };

  return (
    <main
        style={{
          minHeight: '100vh',
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: 0,
          background: theme.bg,
          color: theme.text,
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          ...(Math.abs(fontScale - 1) > 0.02 && { zoom: fontScale, minWidth: 0 } as React.CSSProperties),
          ...(fontBold ? { fontWeight: 600 } : {}),
        }}
      data-accessibility-root
      data-high-contrast={highContrast ? 'true' : 'false'}
      data-font-scale={String(fontScale)}
      data-font-bold={fontBold ? 'true' : 'false'}
      data-simple-mode={simpleMode ? 'true' : 'false'}
      id="main-content"
      role="main"
    >
      <style>{`
        [data-accessibility-root][data-high-contrast="true"] { background: #0f0f0f !important; color: #ffffff !important; }
        [data-accessibility-root][data-high-contrast="true"] a { color: #ffc107 !important; text-decoration: underline; }
        [data-accessibility-root][data-high-contrast="true"] button,
        [data-accessibility-root][data-high-contrast="true"] input,
        [data-accessibility-root][data-high-contrast="true"] textarea,
        [data-accessibility-root][data-high-contrast="true"] [role="button"] { background: #1e1e1e !important; color: #ffffff !important; border: 2px solid #ffc107 !important; }
        [data-accessibility-root][data-high-contrast="true"] label { color: #e0e0e0 !important; }
        [data-accessibility-root][data-high-contrast="true"] h1, [data-accessibility-root][data-high-contrast="true"] h2, [data-accessibility-root][data-high-contrast="true"] strong { color: #ffffff !important; }
        [data-accessibility-root][data-high-contrast="true"] .acc-inner { background: #0f0f0f !important; color: #ffffff !important; border: 2px solid #ffc107 !important; box-shadow: none !important; }
        [data-accessibility-root][data-high-contrast="true"] select { background: #1e1e1e !important; color: #fff !important; border-color: #ffc107 !important; }
      `}</style>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: 9999,
          padding: '8px 16px',
          background: highContrast ? '#ffc107' : 'var(--accent)',
          color: highContrast ? '#0f0f0f' : 'var(--bg-card)',
          fontSize: 14,
          borderRadius: 8,
          textDecoration: 'none',
        }}
        className="skip-link"
        onFocus={(e) => { e.currentTarget.style.left = '8px'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}
      >
        {t('skipToContent')}
      </a>
      <div
        className={highContrast ? 'acc-inner' : ''}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'transparent',
          color: theme.text,
          ...(highContrast && { background: '#0f0f0f', border: '2px solid #ffc107' }),
        }}
      >
        <div
          ref={homeScrollRef}
          className="home-scroll-region"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            paddingBottom: 'max(80px, calc(52px + env(safe-area-inset-bottom, 0px)))',
            background: highContrast ? '#0f0f0f' : 'var(--bg-base)',
          }}
        >
        {user && householdId ? (
          <div
            aria-live="polite"
            style={{
              height: Math.max(pullRefreshOffset, pullRefreshRefreshing ? 42 : 0),
              minHeight: 0,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 8,
              paddingBottom: pullRefreshRefreshing || pullRefreshOffset > 12 ? 6 : 0,
              color: highContrast ? '#94a3b8' : 'var(--text-secondary)',
              fontSize: 12,
              transition: prefersReducedMotion ? 'none' : 'height 0.18s ease-out',
              overflow: 'hidden',
              background: highContrast ? '#0f0f0f' : 'var(--bg-base)',
            }}
          >
            {pullRefreshRefreshing ? (
              <>
                <Loader2 className="animate-spin" size={18} strokeWidth={2} aria-hidden />
                <span>{t('pullRefreshLoading')}</span>
              </>
            ) : pullRefreshOffset > 28 ? (
              <ChevronDown size={22} strokeWidth={2} aria-hidden style={{ opacity: 0.75 }} />
            ) : null}
          </div>
        ) : null}
        <input
          ref={profileAvatarInputRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          style={{ display: 'none' }}
          onChange={handleProfileAvatarChange}
          aria-hidden
        />
        {user && householdId ? (
          <>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 33,
              marginBottom: 4,
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 2,
              background: highContrast ? '#0f0f0f' : 'var(--bg-base)',
              borderBottom: 'none',
              boxSizing: 'border-box',
            }}
          >
            <AppHeader t={t} onSettingsClick={() => setSettingsMenuOpen(true)} />
          </div>
          <div className="home-top-bleed" style={{ marginBottom: 6 }}>
            <MemberFilter
              user={user}
              members={members}
              selectedMemberId={selectedMemberId}
              onSelectMember={setSelectedMemberId}
              t={t}
              meDisplayName={meDisplayName}
              profileAvatarUrl={profileAvatarUrl}
              profileAvatarLoadFailed={profileAvatarLoadFailed}
              onEnlargeAvatar={setEnlargedAvatarUrl}
              avatarFailedUserIds={avatarFailedUserIds}
              onProfileAvatarError={() => setProfileAvatarLoadFailed(true)}
              onMemberAvatarError={(userId) => setAvatarFailedUserIds((prev) => new Set(prev).add(userId))}
            />
            {activeTab === 'search' && (
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색"
                style={{
                  width: '100%',
                  marginBottom: 10,
                  borderRadius: 12,
                  border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
                  padding: '10px 12px',
                  fontSize: 13,
                  background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
                  color: theme.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                aria-label="검색"
              />
            )}
            {activeTab === 'home' && (
              <>
                <ScrollReveal scrollRootRef={homeScrollRef} style={{ marginBottom: 8 }}>
                  <details
                    className="feed-filter-disclosure"
                    open={familyNotesEditing}
                    onToggle={(e) => setFamilyNotesEditing(e.currentTarget.open)}
                    style={{
                      borderRadius: theme.radiusLg,
                      border: theme.border,
                      background: theme.card,
                      boxShadow: theme.cardShadow,
                    }}
                  >
                  <summary className="feed-filter-summary">
                    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.65, color: theme.text }}>
                      {familyNotesEditing ? (
                        <>
                          <div>
                            <span style={{ color: theme.textSecondary, fontSize: 11, display: 'block' }}>{t('familyNotice')}</span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{familyNotice.trim() ? familyNotice : t('emptyMemo')}</span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <span style={{ color: theme.textSecondary, fontSize: 11, display: 'block' }}>{t('shoppingListTitle')}</span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{shoppingList.trim() ? shoppingList : t('emptyMemo')}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span style={{ color: theme.textSecondary, fontSize: 11, display: 'block' }}>{t('familyNotice')}</span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{familyNotice.trim() ? familyNotice : t('emptyMemo')}</span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <span style={{ color: theme.textSecondary, fontSize: 11, display: 'block' }}>{t('shoppingListTitle')}</span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{shoppingList.trim() ? shoppingList : t('emptyMemo')}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      style={{
                        color: theme.textSecondary,
                        transform: familyNotesEditing ? 'rotate(180deg)' : undefined,
                        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    />
                  </summary>
                  <div style={{ paddingLeft: 2, paddingRight: 2, paddingBottom: 8 }}>
                    <div style={{ display: 'grid', gap: 10, paddingTop: 2 }}>
                      <div>
                        <label htmlFor="family-notice-input" style={{ fontSize: 11, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>
                          {t('familyNotice')}
                        </label>
                        <textarea
                          id="family-notice-input"
                          value={familyNotice}
                          onChange={(e) => {
                            sharedMemoTypingUntilRef.current = Date.now() + 2500;
                            setFamilyNotice(e.target.value);
                          }}
                          placeholder={t('familyNoticePlaceholder')}
                          rows={3}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            borderRadius: 10,
                            border: '1px solid var(--divider)',
                            padding: '10px 12px',
                            fontSize: 13,
                            lineHeight: 1.5,
                            resize: 'vertical',
                            minHeight: 72,
                            background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
                            color: theme.text,
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="shopping-list-input" style={{ fontSize: 11, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>
                          {t('shoppingListTitle')}
                        </label>
                        <textarea
                          id="shopping-list-input"
                          value={shoppingList}
                          onChange={(e) => {
                            sharedMemoTypingUntilRef.current = Date.now() + 2500;
                            setShoppingList(e.target.value);
                          }}
                          placeholder={t('shoppingPlaceholder')}
                          rows={3}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            borderRadius: 10,
                            border: '1px solid var(--divider)',
                            padding: '10px 12px',
                            fontSize: 13,
                            lineHeight: 1.5,
                            resize: 'vertical',
                            minHeight: 72,
                            background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                            color: theme.text,
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => void saveSharedMemos()}
                          disabled={memoSaving}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--divider)',
                            background: memoSaving ? 'var(--divider)' : 'var(--bg-subtle)',
                            color: memoSaving ? 'var(--text-caption)' : 'var(--text-secondary)',
                            fontSize: 12,
                            cursor: memoSaving ? 'wait' : 'pointer',
                          }}
                        >
                          {memoSaving ? '저장 중...' : t('save')}
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
                </ScrollReveal>
                <ScrollReveal scrollRootRef={homeScrollRef}>
                  <details
                    className="feed-filter-disclosure"
                    open={feedFilterOpen}
                    onToggle={(e) => setFeedFilterOpen(e.currentTarget.open)}
                  >
                  <summary className="feed-filter-summary">
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{t('feedFilterTitle')}</span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      style={{
                        color: theme.textSecondary,
                        transform: feedFilterOpen ? 'rotate(180deg)' : undefined,
                        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                      }}
                    />
                  </summary>
                  <div style={{ padding: '4px 6px 6px' }}>
                    <LogTagFilterRow
                      filter={feedTagFilter}
                      setFilter={onFeedTagSelect}
                      options={feedTagOptions}
                      t={t}
                      highContrast={highContrast}
                    />
                  </div>
                </details>
                </ScrollReveal>
              </>
            )}
          </div>
          </>
        ) : (
          <div className="home-top-bleed" style={{ marginBottom: 6 }}>
            <AppHeader t={t} />
          </div>
        )}

        {status && (
          <Toast
            message={status}
            variant={statusToastTone}
            fading={statusFading}
            highContrast={highContrast}
            liftAboveTabBar={!!user}
          />
        )}

        {!user && (
          <div style={{ fontSize: 13, color: highContrast ? '#e0e0e0' : 'var(--text-secondary)' }}>
            <Link
              href="/login"
              style={{ color: highContrast ? '#ffc107' : 'var(--accent)', textDecoration: 'underline', fontWeight: 600 }}
            >
              {t('login')}
            </Link>
            {t('loginOrJoin')}{' '}
            <Link href="/join" style={{ color: highContrast ? '#ffc107' : 'var(--accent)', textDecoration: 'underline' }}>
              {t('join')}
            </Link>
            {t('please')}
          </div>
        )}

        {user && householdId && (
          <>
            {activeTab === 'home' ? (
              <ScrollReveal scrollRootRef={homeScrollRef}>
                <section style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: theme.textSecondary, margin: '0 0 10px' }}>
                    {t('dailySummary')} · <strong style={{ color: theme.text }}>{todayLogCount}</strong>
                  </p>
                </section>
              </ScrollReveal>
            ) : null}
            {activeTab === 'todo' && (
              <TodoBoard
                highContrast={highContrast}
                todoCompletedPeriod={todoCompletedPeriod}
                setTodoCompletedPeriod={setTodoCompletedPeriod}
                todoActiveByGroup={todoActiveByGroup}
                todoCompletedGroups={todoCompletedGroups}
                addTodoTask={addTodoTask}
                updateTodoTask={updateTodoTask}
                toggleTodoTaskDone={toggleTodoTaskDone}
                removeTodoTask={removeTodoTask}
                t={t}
                dueDatePrefill={todoDueDatePrefill}
                onDueDatePrefillConsumed={clearTodoDueDatePrefill}
              />
            )}
            {activeTab === 'ledger' && (
              <LedgerPanel
                ledger={householdLedger}
                getMemberName={getMemberName}
                onError={reportErrorStatus}
                t={t}
                theme={theme}
                highContrast={highContrast}
                occurredOnPrefill={ledgerOccurredOnPrefill}
                onOccurredOnPrefillConsumed={clearLedgerOccurredOnPrefill}
              />
            )}
            {activeTab === 'calendar' && (
              <CalendarTabPanel
                t={t}
                theme={theme}
                highContrast={highContrast}
                calendarYearMonth={calendarYearMonth}
                setCalendarYearMonth={setCalendarYearMonth}
                calendarHeaderMonthLabel={calendarHeaderMonthLabel}
                feedTagOptions={feedTagOptions}
                calendarTagFilter={calendarTagFilter}
                setCalendarTagFilter={setCalendarTagFilter}
                calendarCellCount={calendarCellCount}
                startWeekday={startWeekday}
                daysInMonth={daysInMonth}
                calYear={calYear}
                calMonth={calMonth}
                calendarDayLogsMap={calendarDayLogsMap}
                calendarDayLedgerMap={calendarDayLedgerMap}
                calendarDayDueTodoCount={calendarDayDueTodoCount}
                selectedCalendarDate={selectedCalendarDate}
                setSelectedCalendarDate={setSelectedCalendarDate}
                selectedCalendarDayLedgerEntries={selectedCalendarDayLedgerEntries}
                selectedCalendarDayTodos={selectedCalendarDayTodos}
                selectedDayLogs={selectedDayLogs}
                getMemberName={getMemberName}
                getEffectiveLogSlug={getEffectiveLogSlug}
                getLogTagLabelKey={getLogTagLabelKey}
                applyTagFromLogCard={applyTagFromLogCard}
                onOpenLedgerFromDay={() => {
                  if (selectedCalendarDate) setLedgerOccurredOnPrefill(selectedCalendarDate);
                  setActiveTab('ledger');
                }}
                onOpenTodoFromDay={() => {
                  if (selectedCalendarDate) setTodoDueDatePrefill(selectedCalendarDate);
                  setActiveTab('todo');
                }}
                growthRange={growthRange}
                setGrowthRange={setGrowthRange}
                growthTimelineView={growthTimelineView}
                todayMemoryLogs={todayMemoryLogs}
                normalizeMediaUrl={normalizeMediaUrl}
                getPrimaryMedia={getPrimaryMedia}
              />
            )}

            {activeTab === 'home' && (
              <ScrollReveal scrollRootRef={homeScrollRef}>
                <LogFeed
                  activeTab={activeTab}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  t={t}
                  theme={theme}
                  highContrast={highContrast}
                  logs={logs}
                  logsByDate={logsByDate}
                  user={user}
                  editingLogId={editingLogId}
                  setEditingLogId={setEditingLogId}
                  editingAction={editingAction}
                  setEditingAction={setEditingAction}
                  onUpdateLog={handleUpdateLog}
                  getMemberName={getMemberName}
                  getLogMedia={getLogMedia}
                  getLogTagLabelKey={getLogTagLabelKey}
                  commentsByLogId={commentsByLogId}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  commentDraft={commentDraft}
                  setCommentDraft={setCommentDraft}
                  commentSending={commentSending}
                  addComment={addComment}
                  commentTarget={commentTarget}
                  setCommentTarget={setCommentTarget}
                  longPressTimerRef={longPressTimerRef}
                  setActionPopupLogId={setActionPopupLogId}
                  onPickSticker={(logId) => openStickerPicker(logId)}
                  onTagClick={applyTagFromLogCard}
                  logsInitialLoading={logsInitialLoading}
                  logsRefreshLoading={pullRefreshRefreshing}
                />
              </ScrollReveal>
            )}
            {activeTab === 'search' && (
              <SearchTabPanel
                t={t}
                theme={theme}
                highContrast={highContrast}
                searchQuery={searchQuery}
                searchMediaLogs={searchMediaLogs}
                searchMediaView={searchMediaView}
                searchTextOnlyLogs={searchTextOnlyLogs}
                normalizeMediaUrl={normalizeMediaUrl}
                getPrimaryMedia={getPrimaryMedia}
                getEffectiveLogSlug={getEffectiveLogSlug}
                getLogTagLabelKey={getLogTagLabelKey}
                applyTagFromLogCard={applyTagFromLogCard}
              />
            )}

          </>
        )}
        </div>
      </div>

      {user && householdId && commentTarget && (activeTab === 'home' || activeTab === 'search') && (
        <CommentSheet
          commentTarget={commentTarget}
          commentSheetAnimated={commentSheetAnimated}
          commentSheetDragY={commentSheetDragY}
          commentSheetDragActive={commentSheetDragActive}
          headerRef={commentSheetHeaderRef}
          onClose={closeCommentSheet}
          comments={currentSheetComments}
          user={user}
          isSameUserId={isSameUserId}
          getMemberName={getMemberName}
          editingCommentId={editingCommentId}
          setEditingCommentId={setEditingCommentId}
          editingCommentValue={editingCommentValue}
          setEditingCommentValue={setEditingCommentValue}
          updateComment={updateComment}
          deleteComment={deleteComment}
          commentDraft={commentDraft}
          setCommentDraft={setCommentDraft}
          addComment={addComment}
          commentSending={commentSending}
          highContrast={highContrast}
        />
      )}

      {stickerPickerOpen && (
        <StickerPickerSheet
          highContrast={highContrast}
          onClose={closeStickerPicker}
          onPickSticker={pickSticker}
          canRemove={!!selectedStickerLogOwnSticker}
          saving={stickerSaving}
        />
      )}

      {showNameEditModal && (
        <NameEditModal
          highContrast={highContrast}
          t={t}
          profileName={profileName}
          setProfileName={setProfileName}
          profileSaving={profileSaving}
          onClose={() => setShowNameEditModal(false)}
          onSave={() => {
            void handleProfileSave();
            setShowNameEditModal(false);
          }}
        />
      )}

      {user && (
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          t={t}
          writePlaceSlug={activeTab === 'home' && feedTagFilter !== 'all' ? feedTagFilter : null}
        />
      )}

      {user && householdId && (
        <SettingsMenuModal
          open={settingsMenuOpen}
          onClose={() => setSettingsMenuOpen(false)}
          t={t}
          highContrast={highContrast}
          language={language}
          setLanguage={setLanguage}
          langLabels={langLabels}
          onNameEdit={() => {
            setSettingsMenuOpen(false);
            setShowNameEditModal(true);
          }}
          onProfilePhotoChange={() => {
            setSettingsMenuOpen(false);
            profileAvatarInputRef.current?.click();
          }}
          onInviteFamily={() => {
            setSettingsMenuOpen(false);
            router.push('/invite');
          }}
          onAccessibility={() => {
            setSettingsMenuOpen(false);
            setShowAccessibilityModal(true);
          }}
          profileAvatarUploading={profileAvatarUploading}
        />
      )}



      {showMemoPanel && (
        <FamilyMemoPanel
          memoPanelAnimated={memoPanelAnimated}
          onClose={closeMemoPanel}
          highContrast={highContrast}
          t={t}
          memoContent={memoContent}
          onMemoContentChange={(value) => {
            sharedMemoTypingUntilRef.current = Date.now() + 2500;
            setMemoContent(value);
          }}
          memoSaving={memoSaving}
          onSave={saveSharedMemos}
        />
      )}

      {/* 오른쪽에서 메모 패널 스와이프 감지용. 폭이 너무 넓으면 상단 프로필 칩(특히 맨 오른쪽) 터치를 가로챔 → 좁은 가장자리만 유지 */}
      <div
        role="presentation"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: activeTab === 'todo' ? 0 : 28,
          zIndex: 35,
          touchAction: 'pan-y',
          pointerEvents: activeTab === 'todo' ? 'none' : 'auto',
        }}
        onTouchStart={(e) => {
          const t = e.changedTouches?.[0];
          if (t) swipeStartRef.current = t.clientX;
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches?.[0];
          if (!t || swipeStartRef.current == null) return;
          const start = swipeStartRef.current;
          const end = t.clientX;
          swipeStartRef.current = null;
          if (start > window.innerWidth - 36 && start - end > 36) setShowMemoPanel(true);
        }}
      />

      {enlargedAvatarUrl && (
        <EnlargedAvatarOverlay imageUrl={enlargedAvatarUrl} onClose={() => setEnlargedAvatarUrl(null)} />
      )}

      {actionPopupLogId && (
        <LogActionSheet
          log={logs.find((l) => l.id === actionPopupLogId) ?? null}
          highContrast={highContrast}
          t={t}
          onDismiss={() => setActionPopupLogId(null)}
          onEdit={(logId) => {
            router.push(`/write?edit=${encodeURIComponent(logId)}`);
            setActionPopupLogId(null);
          }}
          onDelete={(logId) => {
            handleDeleteLog(logId);
            setActionPopupLogId(null);
          }}
        />
      )}


      {showAccessibilityModal && (
        <AccessibilitySettingsModal
          t={t}
          highContrast={highContrast}
          setHighContrast={setHighContrast}
          accFontDraft={accFontDraft}
          setAccFontDraft={setAccFontDraft}
          simpleMode={simpleMode}
          setSimpleMode={setSimpleMode}
          onDismiss={() => setShowAccessibilityModal(false)}
          onApplyAndClose={() => {
            setFontScaleStep(accFontDraft.step);
            setFontBold(accFontDraft.bold);
            setShowAccessibilityModal(false);
          }}
        />
      )}
    </main>
  );
}

