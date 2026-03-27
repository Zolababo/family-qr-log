'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import { getT, langLabels, type Lang } from './translations';
import { Calendar, Image as ImageIcon, X, ChevronLeft, ChevronRight, ChevronDown, FileText, Accessibility, Baby, History, MapPin, ExternalLink, Sparkles, Plus } from 'lucide-react';
import { LOG_SLUG, TOPIC_SLUGS, normalizeLogSlug, type LogSlug } from '../lib/logTags';
import { parseLogMeta, composeActionWithMeta, type LogMeta } from '../lib/logActionMeta';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomTabBar, type TabId } from '../components/layout/BottomTabBar';
import { MemberFilter } from '../components/home/MemberFilter';
import { PlaceFilterRow } from '../components/home/PlaceFilterRow';
import { LogFeed } from '../components/home/LogFeed';
import { TodoBoard, type TodoPeriod, type TodoPriorityKey, type TodoTask } from '../components/home/TodoBoard';

type Log = {
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

function getLogMedia(log: Log): { imageUrls: string[]; videoUrl: string | null } {
  let imageUrls: string[] = [];
  const raw = log.image_urls;
  if (Array.isArray(raw)) {
    imageUrls = raw.filter((u): u is string => typeof u === 'string');
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      imageUrls = Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
    } catch {
      // JSON이 깨진 문자열이어도, URL만 추출해서 최소한 미디어는 보이게 합니다.
      const matches = raw.match(/https?:\/\/[^\s",)]+/g);
      const escapedMatches = raw.match(/https?:\\\/\\\/[^\s",)]+/g)?.map((u) => u.replace(/\\\//g, '/'));
      const merged = [...(matches ?? []), ...(escapedMatches ?? [])];
      if (merged.length > 0) imageUrls = merged;
    }
  }
  if (imageUrls.length === 0 && log.image_url) imageUrls = [log.image_url];
  const videoUrl = log.video_url && log.video_url.trim() ? log.video_url : null;
  return { imageUrls, videoUrl };
}

type Member = {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
};

type LogComment = {
  id: string;
  log_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
};

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

function parseTodoSnapshot(action: string | null | undefined): TodoTask[] | null {
  if (!action || !action.startsWith(TODO_SNAPSHOT_PREFIX)) return null;
  const raw = action.slice(TODO_SNAPSHOT_PREFIX.length);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TodoTask[]) : null;
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

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const date = d.getDate().toString().padStart(2, '0');
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdayNames[d.getDay()];

  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 || 12;

  return `${year}.${month}.${date} (${weekday}) · ${ampm} ${hour12}:${minutes}`;
};

const ACCESSIBILITY_KEY = 'family_qr_log_accessibility';
const MEMO_KEY = 'family_qr_log_memo';
const ACTIVE_TAB_KEY = 'family_qr_log_active_tab';
const FONT_STEPS = [0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.75, 2] as const;
type FontScaleStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  const [logs, setLogs] = useState<Log[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<'all' | 'me' | string>('all');
  const [feedTagFilter, setFeedTagFilter] = useState<'all' | LogSlug>('all');
  const [familyNotesEditing, setFamilyNotesEditing] = useState(false);
  const [familyNotice, setFamilyNotice] = useState('');
  const [shoppingList, setShoppingList] = useState('');
  const [feedFilterOpen, setFeedFilterOpen] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [statusFading, setStatusFading] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const [profileAvatarLoadFailed, setProfileAvatarLoadFailed] = useState(false);
  const [avatarFailedUserIds, setAvatarFailedUserIds] = useState<Set<string>>(new Set());
  const [enlargedAvatarUrl, setEnlargedAvatarUrl] = useState<string | null>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
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
  const [memoContent, setMemoContent] = useState('');
  const [memoSaving, setMemoSaving] = useState(false);
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const [todoTasks, setTodoTasks] = useState<TodoTask[]>([]);
  const [todoCompletedPeriod, setTodoCompletedPeriod] = useState<TodoPeriod>('day');
  const [calendarYearMonth, setCalendarYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [calendarTagFilter, setCalendarTagFilter] = useState<'all' | LogSlug>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [commentsByLogId, setCommentsByLogId] = useState<Record<string, LogComment[]>>({});
  const [replyingTo, setReplyingTo] = useState<{ logId: string; commentId: string } | null>(null);
  const [commentTarget, setCommentTarget] = useState<{ logId: string; parentId: string | null } | null>(null);
  const [commentSheetAnimated, setCommentSheetAnimated] = useState(false);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentValue, setEditingCommentValue] = useState('');
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerPickerLogId, setStickerPickerLogId] = useState<string | null>(null);
  const [growthRange, setGrowthRange] = useState<'week' | 'month' | 'quarter' | 'half' | 'year' | 'all'>('month');
  const memoSwipeStartRef = useRef<number | null>(null);
  const [memoPanelAnimated, setMemoPanelAnimated] = useState(false);
  const homeScrollRef = useRef<HTMLDivElement | null>(null);
  const sharedMemoTypingUntilRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  const memoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadLogsReqSeqRef = useRef(0);
  const todoSnapshotHydratedRef = useRef(false);
  const lastLoadedTodoSnapshotActionRef = useRef('');
  const lastSavedTodoSnapshotActionRef = useRef('');
  const lastSavedSharedMemoSnapshotActionRef = useRef('');

  const fontScale = FONT_STEPS[fontScaleStep];
  const canApplyIncomingSharedMemo = useCallback(() => {
    const typing = Date.now() < sharedMemoTypingUntilRef.current;
    return !typing && !familyNotesEditing && !showMemoPanel;
  }, [familyNotesEditing, showMemoPanel]);

  useEffect(() => {
    const el = homeScrollRef.current;
    if (el) el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    const init = async () => {
      setStatus(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus('로그인이 필요합니다.');
        return;
      }

      setUser(user);

      let myMembers: { household_id: string; display_name: string | null; user_id: string; avatar_url?: string | null; role?: string }[] | null = null;
      let memberError: { message: string } | null = null;

      const res = await supabase
        .from('members')
        .select('household_id, display_name, user_id, avatar_url, role')
        .eq('user_id', user.id)
        .limit(1);

      myMembers = res.data;
      memberError = res.error;

      if (memberError && /avatar_url|role|does not exist|column/i.test(memberError.message)) {
        const fallback = await supabase
          .from('members')
          .select('household_id, display_name, user_id')
          .eq('user_id', user.id)
          .limit(1);
        myMembers = fallback.data;
        memberError = fallback.error;
      }

      if (memberError) {
        setStatus(`members 조회 실패: ${memberError.message}`);
        return;
      }

      const myMember = myMembers?.[0];
      if (!myMember) {
        setStatus('members 조회 실패: row 없음 (members 테이블에 user_id 확인)');
        return;
      }

      setHouseholdId(myMember.household_id);
      setIsAdmin((myMember as { role?: string }).role === 'master');

      const baseName =
        (myMember.display_name && myMember.display_name.trim()) ||
        (user.email ? user.email.split('@')[0] : '나');
      setProfileName(baseName);
      const initialAvatar = 'avatar_url' in myMember ? (myMember.avatar_url ?? null) : null;
      setProfileAvatarUrl(initialAvatar);
      setProfileAvatarLoadFailed(false);

      let allMembers: { user_id: string; display_name: string | null; avatar_url?: string | null }[] | null = null;
      let allMembersError: { message: string } | null = null;

      const allRes = await supabase
        .from('members')
        .select('user_id, display_name, avatar_url')
        .eq('household_id', myMember.household_id);

      allMembers = allRes.data;
      allMembersError = allRes.error;

      if (allMembersError && /avatar_url|does not exist|column/i.test(allMembersError.message)) {
        const fallbackAll = await supabase
          .from('members')
          .select('user_id, display_name')
          .eq('household_id', myMember.household_id);
        allMembers = fallbackAll.data;
        allMembersError = fallbackAll.error;
      }

      if (!allMembersError && allMembers) {
        setMembers(allMembers);
      }
    };

    init();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEMO_KEY);
      if (raw != null) setMemoContent(raw);
    } catch {}
  }, []);

  useEffect(() => {
    if (!householdId || !user) return;
    let cancelled = false;
    const loadTodo = async () => {
      const { data } = await supabase
        .from('logs')
        .select('action, created_at')
        .eq('household_id', householdId)
        .eq('actor_user_id', user.id)
        .like('action', `${TODO_SNAPSHOT_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const latestAction = typeof data?.[0]?.action === 'string' ? data[0].action : '';
      todoSnapshotHydratedRef.current = true;
      if (!latestAction || latestAction === lastLoadedTodoSnapshotActionRef.current) return;
      const parsed = parseTodoSnapshot(latestAction);
      if (!parsed) return;
      lastLoadedTodoSnapshotActionRef.current = latestAction;
      lastSavedTodoSnapshotActionRef.current = latestAction;
      setTodoTasks(parsed);
    };
    void loadTodo();
    const timer = window.setInterval(() => {
      void loadTodo();
    }, 7000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [householdId, user]);

  useEffect(() => {
    if (!householdId || !user) return;
    if (!todoSnapshotHydratedRef.current) return;
    const action = composeTodoSnapshot(todoTasks);
    if (action === lastSavedTodoSnapshotActionRef.current) return;
    const timer = window.setTimeout(async () => {
      await supabase.from('logs').insert({
        household_id: householdId,
        place_slug: LOG_SLUG.todo,
        action,
        actor_user_id: user.id,
      });
      lastSavedTodoSnapshotActionRef.current = action;
    }, 600);
    return () => window.clearTimeout(timer);
  }, [todoTasks, householdId, user]);

  useEffect(() => {
    if (!householdId || !user) return;
    let cancelled = false;
    (async () => {
      const loadFromSharedMemoLog = async () => {
        const { data: fallbackLogs } = await supabase
          .from('logs')
          .select('action, created_at')
          .eq('household_id', householdId)
          .like('action', `${SHARED_MEMO_LOG_PREFIX}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        const latest = fallbackLogs?.[0];
        const parsed = parseSharedMemoSnapshot(latest?.action);
        if (!parsed || cancelled || !canApplyIncomingSharedMemo()) return;
        if (typeof parsed.content === 'string') setMemoContent(parsed.content);
        if (typeof parsed.family_notice === 'string') setFamilyNotice(parsed.family_notice);
        if (typeof parsed.shopping_list === 'string') setShoppingList(parsed.shopping_list);
      };
      const { data, error } = await supabase
        .from('household_memos')
        .select('content, family_notice, shopping_list')
        .eq('household_id', householdId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (/relation|schema cache|Could not find the table|household_memos/i.test(error.message ?? '')) {
          await loadFromSharedMemoLog();
          return;
        }
        const { data: fallback } = await supabase.from('household_memos').select('content').eq('household_id', householdId).maybeSingle();
        if (!cancelled && fallback && typeof fallback.content === 'string') {
          setMemoContent(fallback.content);
          try {
            localStorage.setItem(MEMO_KEY, fallback.content);
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
      if (data && typeof data.content === 'string' && canApplyIncomingSharedMemo()) {
        setMemoContent(data.content);
        try {
          localStorage.setItem(MEMO_KEY, data.content);
        } catch {}
      }
      if (data && typeof data.family_notice === 'string' && canApplyIncomingSharedMemo()) {
        setFamilyNotice(data.family_notice);
      } else {
        try {
          const n = localStorage.getItem('family_qr_log_notice');
          if (n) setFamilyNotice(n);
        } catch {}
      }
      if (data && typeof data.shopping_list === 'string' && canApplyIncomingSharedMemo()) {
        setShoppingList(data.shopping_list);
      } else {
        try {
          const s = localStorage.getItem('family_qr_log_shopping');
          if (s) setShoppingList(s);
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId, user, canApplyIncomingSharedMemo]);

  useEffect(() => {
    if (!householdId) return;
    const pull = async () => {
      const { data } = await supabase
        .from('household_memos')
        .select('content, family_notice, shopping_list')
        .eq('household_id', householdId)
        .maybeSingle();
      if (!data) return;
      if (!canApplyIncomingSharedMemo()) return;
      if (typeof data.content === 'string') setMemoContent(data.content);
      if (typeof data.family_notice === 'string') setFamilyNotice(data.family_notice);
      if (typeof data.shopping_list === 'string') setShoppingList(data.shopping_list);
    };
    const pullFromSharedMemoLog = async () => {
      const { data } = await supabase
        .from('logs')
        .select('action, created_at')
        .eq('household_id', householdId)
        .like('action', `${SHARED_MEMO_LOG_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      const latest = data?.[0];
      const parsed = parseSharedMemoSnapshot(latest?.action);
      if (!parsed || !canApplyIncomingSharedMemo()) return;
      if (typeof latest?.action === 'string') {
        lastSavedSharedMemoSnapshotActionRef.current = latest.action;
      }
      if (typeof parsed.content === 'string') setMemoContent(parsed.content);
      if (typeof parsed.family_notice === 'string') setFamilyNotice(parsed.family_notice);
      if (typeof parsed.shopping_list === 'string') setShoppingList(parsed.shopping_list);
    };
    const channel = supabase
      .channel(`household-memos-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_memos', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const next = payload.new as { content?: string; family_notice?: string; shopping_list?: string } | null;
          if (!next) return;
          if (!canApplyIncomingSharedMemo()) return;
          if (typeof next.content === 'string') setMemoContent(next.content);
          if (typeof next.family_notice === 'string') setFamilyNotice(next.family_notice);
          if (typeof next.shopping_list === 'string') setShoppingList(next.shopping_list);
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
  }, [householdId, canApplyIncomingSharedMemo]);

  useEffect(() => {
    try {
      localStorage.setItem(MEMO_KEY, memoContent);
    } catch {}
    try {
      localStorage.setItem('family_qr_log_notice', familyNotice);
      localStorage.setItem('family_qr_log_shopping', shoppingList);
    } catch {}
    if (!householdId || !user) return;
    if (memoSaveTimerRef.current) clearTimeout(memoSaveTimerRef.current);
    memoSaveTimerRef.current = setTimeout(async () => {
      const full = {
        household_id: householdId,
        content: memoContent,
        family_notice: familyNotice,
        shopping_list: shoppingList,
      };
      let { error } = await supabase.from('household_memos').upsert(full, { onConflict: 'household_id' });
      if (error && /family_notice|shopping_list|schema|column/i.test(error.message ?? '')) {
        const res = await supabase
          .from('household_memos')
          .upsert({ household_id: householdId, content: memoContent }, { onConflict: 'household_id' });
        error = res.error;
      }
      if (error && /relation|does not exist|schema cache|Could not find the table|household_memos/i.test(error.message ?? '')) {
        const snapshotAction = composeSharedMemoSnapshot({
          content: memoContent,
          family_notice: familyNotice,
          shopping_list: shoppingList,
        });
        if (snapshotAction === lastSavedSharedMemoSnapshotActionRef.current) return;
        const res = await supabase.from('logs').insert({
          household_id: householdId,
          place_slug: LOG_SLUG.general,
          action: snapshotAction,
          actor_user_id: user.id,
        });
        error = res.error;
        if (!error) lastSavedSharedMemoSnapshotActionRef.current = snapshotAction;
      }
      if (error) {
        setStatus(`메모 저장 실패: ${error.message}`);
      }
    }, 900);
    return () => {
      if (memoSaveTimerRef.current) clearTimeout(memoSaveTimerRef.current);
    };
  }, [memoContent, familyNotice, shoppingList, householdId, user]);

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
    const clearTimer = window.setTimeout(() => setStatus(null), 2400);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [status]);

  useEffect(() => {
    if (commentTarget) {
      setCommentSheetAnimated(false);
      const id = requestAnimationFrame(() => setCommentSheetAnimated(true));
      return () => cancelAnimationFrame(id);
    } else {
      setCommentSheetAnimated(false);
    }
  }, [commentTarget]);

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

  const loadLogs = useCallback(
    async (hid: string, slug: string | undefined, actorUserId?: string) => {
      const reqSeq = ++loadLogsReqSeqRef.current;
      let query = supabase
        .from('logs')
        .select('*')
        .eq('household_id', hid)
        .not('action', 'like', `${TODO_SNAPSHOT_PREFIX}%`)
        .not('action', 'like', `${SHARED_MEMO_LOG_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(5000);
      // 서버에서 place_slug로 한 번 더 거르면,
      // 태그 값이 한 번이라도 달라진 시점부터 “기존 로그가 통째로 사라지는” 문제가 생길 수 있어
      // 여기서는 항상 전체 로그를 가져오고, 필터는 클라이언트에서 처리합니다.

      if (actorUserId) {
        query = query.eq('actor_user_id', actorUserId);
      }

      const { data, error } = await query;
      if (reqSeq !== loadLogsReqSeqRef.current) return;

      if (error) {
        setStatus(`logs 조회 실패: ${error.message}`);
        return;
      }

      const rows = (data ?? []).map((row) => ({
        ...(row as Log),
        place_slug: normalizeLogSlug((row as Log).place_slug),
      }));
      // [안정성 격리] 홈에서 과거 로그/미디어가 갑자기 줄어드는 현상이 있어,
      // 우선 “스냅샷 제외” 로직을 꺼서 서버 rows가 실제로 온 것인지 확인합니다.
      // (이 상태에서 과거 로그가 보이면, 다음 단계에서 제외 기준만 안전하게 재설계할게요.)
      setLogs(rows as Log[]);
    },
    []
  );

  const loadComments = useCallback(async (logIds: string[]) => {
    if (logIds.length === 0) return;
    const { data, error } = await supabase
      .from('log_comments')
      .select('*')
      .in('log_id', logIds)
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
    const ids = [...new Set(logs.map((l) => l.id))];
    if (ids.length > 0) loadComments(ids);
  }, [logs, loadComments]);

  const addComment = useCallback(
    async (logId: string, content: string, parentId: string | null) => {
      if (!user || !content.trim() || commentSending) return;
      setCommentSending(true);
      const { error } = await supabase.from('log_comments').insert({
        log_id: logId,
        parent_id: parentId,
        user_id: user.id,
        content: content.trim(),
      });
      setCommentSending(false);
      if (error) {
        setStatus(`댓글 저장 실패: ${error.message}`);
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
    [user, commentSending, loadComments]
  );

  const normalizeUserIdForCompare = useCallback((v: string | null | undefined) => {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }, []);

  const updateComment = useCallback(
    async (commentId: string, logId: string, content: string, commentUserId?: string) => {
      if (!user || !content.trim()) return;
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
        setStatus(`댓글 수정 실패: ${error.message}${hint}`);
        return;
      }
      if (!data) {
        setStatus('댓글 수정 실패: 권한 또는 정책 문제로 반영되지 않았습니다. (RLS 정책 확인)');
        return;
      }
      await loadComments([logId]);
      setEditingCommentId(null);
      setEditingCommentValue('');
    },
    [user, loadComments]
  );

  const deleteComment = useCallback(
    async (commentId: string, logId: string, commentUserId?: string) => {
      if (!user) return;
      if (typeof window !== 'undefined' && !window.confirm('댓글을 삭제할까요?')) return;
      const { data, error } = await supabase
        .from('log_comments')
        .delete()
        .eq('id', commentId)
        .select('id')
        .maybeSingle();
      if (error) {
        const msg = String(error.message ?? '');
        const isFkBlocked =
          error.code === '23503' ||
          /foreign key|constraint|violates/i.test(msg);
        // 답글이 달린 댓글은 FK로 물리 삭제가 막힐 수 있어, 소프트 삭제로 안전하게 대체합니다.
        if (isFkBlocked) {
          const fallback = await supabase
            .from('log_comments')
            .update({ content: '삭제된 댓글입니다.' })
            .eq('id', commentId)
            .select('id')
            .maybeSingle();
          if (!fallback.error && fallback.data) {
            await loadComments([logId]);
            if (editingCommentId === commentId) {
              setEditingCommentId(null);
              setEditingCommentValue('');
            }
            setStatus('답글이 있어 댓글 내용만 삭제되었습니다.');
            return;
          }
        }
        const hint = /policy|row-level|rls|permission|not allowed|forbidden/i.test(error.message ?? '')
          ? ' (DB RLS 정책 점검 필요: scripts/enable-log-comments-rls-policies.sql 실행)'
          : '';
        setStatus(`댓글 삭제 실패: ${error.message}${hint}`);
        return;
      }
      if (!data) {
        setStatus('댓글 삭제 실패: 권한 또는 정책 문제로 반영되지 않았습니다. (RLS 정책 확인)');
        return;
      }
      await loadComments([logId]);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentValue('');
      }
    },
    [user, loadComments, editingCommentId]
  );

  const stickerOptions = ['✨', '❤️', '⭐', '🎉', '🧸', '🌿', '🌈', '☀️', '🍀', '💫'];
  const openStickerPicker = (logId: string | null) => {
    setStickerPickerLogId(logId);
    setStickerPickerOpen(true);
  };

  const applyStickerToLog = useCallback(
    async (logId: string, sticker: string | null) => {
      if (!user || !householdId) return;
      const targetLog = logs.find((l) => l.id === logId);
      if (!targetLog) return;

      const parsed = parseLogMeta(targetLog.action);
      const nextMeta: LogMeta = { ...parsed.meta };
      const byUser = { ...(nextMeta.stickerByUser ?? {}) };
      if (sticker) byUser[user.id] = sticker;
      else delete byUser[user.id];
      nextMeta.stickerByUser = Object.keys(byUser).length > 0 ? byUser : undefined;
      // legacy field cleanup
      delete nextMeta.stickers;
      const nextAction = composeActionWithMeta(parsed.text, nextMeta);

      const { error } = await supabase
        .from('logs')
        .update({ action: nextAction })
        .eq('id', logId);

      if (error) {
        setStatus(`스티커 저장 실패: ${error.message}`);
        return;
      }

      // 서버는 “전체 로그”를 다시 받아오고, 필터링은 클라이언트에서 처리합니다.
      await loadLogs(householdId, undefined, undefined);
      setStickerPickerOpen(false);
      setStickerPickerLogId(null);
    },
    [user, householdId, logs, loadLogs]
  );

  const pickSticker = (sticker: string | null) => {
    if (!stickerPickerLogId) return;
    applyStickerToLog(stickerPickerLogId, sticker);
  };

  useEffect(() => {
    if (!householdId || !user) return;
    // 서버 필터를 걸지 않고 전체를 로드합니다.
    void loadLogs(householdId, undefined, undefined);
  }, [householdId, user, loadLogs]);

  useEffect(() => {
    // 홈에서는 “전체”만 보여주도록 강제합니다.
    if (activeTab === 'home') setFeedTagFilter('all');
  }, [activeTab]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_TAB_KEY);
      if (raw === 'home' || raw === 'calendar' || raw === 'search' || raw === 'todo') {
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

  const refreshLogs = useCallback(() => {
    if (!householdId || !user) return;
    void loadLogs(householdId, undefined, undefined);
  }, [householdId, user, loadLogs]);

  const handleUpdateLog = async (logId: string, newAction: string) => {
    if (!user || !householdId) return;
    const { error } = await supabase.from('logs').update({ action: newAction }).eq('id', logId).eq('actor_user_id', user.id);
    if (error) {
      setStatus(`수정 실패: ${error.message}`);
      return;
    }
    setEditingLogId(null);
    setEditingAction('');
    setStatus('수정되었습니다.');
    refreshLogs();
  };

  const handleDeleteLog = async (logId: string) => {
    if (!user || !householdId) return;
    if (!window.confirm(t('deleteConfirm'))) return;
    const { error } = await supabase.from('logs').delete().eq('id', logId).eq('actor_user_id', user.id);
    if (error) {
      setStatus(`삭제 실패: ${error.message}`);
      return;
    }
    setEditingLogId(null);
    setStatus('삭제되었습니다.');
    refreshLogs();
  };

  const handleProfileSave = async () => {
    if (!user || !householdId) return;
    const trimmed = profileName.trim();
    if (!trimmed) {
      setStatus('이름을 입력하세요.');
      return;
    }

    setProfileSaving(true);
    const { error } = await supabase
      .from('members')
      .update({ display_name: trimmed })
      .eq('household_id', householdId)
      .eq('user_id', user.id);

    if (error) {
      setStatus(`프로필 저장 실패: ${error.message}`);
      setProfileSaving(false);
      return;
    }

    setMembers((prev) =>
      prev.map((m) => (m.user_id === user.id ? { ...m, display_name: trimmed } : m))
    );
    setStatus('이름이 저장되었습니다.');
    setProfileSaving(false);
  };

  const handleProfileAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) {
        setStatus('파일이 선택되지 않았습니다. 다시 시도해 주세요.');
        return;
      }
      if (!user || !householdId) {
        setStatus('로그인 후 다시 시도해 주세요.');
        return;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
      const isImageType = file.type.startsWith('image/');
      const isImageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext);
      if (!isImageType && !isImageExt) {
        setStatus('사진 파일만 선택해 주세요. (jpg, png, heic 등)');
        return;
      }
      setProfileAvatarUploading(true);
      setStatus('프로필 사진 업로드 중...');
      let fileToUpload: File = file;
      if (isHeic && typeof window !== 'undefined') {
        try {
          const heic2any = (await import('heic2any')).default;
          const result = await heic2any({ blob: file, toType: 'image/jpeg' });
          const blob = result instanceof Blob ? result : (Array.isArray(result) ? result[0] : result);
          if (!blob) throw new Error('Conversion failed');
          fileToUpload = new File([blob], file.name.replace(/\.[^.]+$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (err) {
          setStatus('HEIC 변환에 실패했습니다. JPEG/PNG로 올려 주세요.');
          setProfileAvatarUploading(false);
          return;
        }
      }
      const uploadExt = fileToUpload.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${householdId}/${user.id}.${uploadExt}`;
      const contentType = fileToUpload.type.startsWith('image/') ? fileToUpload.type : `image/${uploadExt === 'jpg' || uploadExt === 'jpeg' ? 'jpeg' : uploadExt === 'png' ? 'png' : uploadExt === 'gif' ? 'gif' : 'webp'}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, fileToUpload, {
        contentType,
        upsert: true,
      });
      if (uploadError) {
        const msg = uploadError.message || '';
        const hint = /bucket|policy|row-level|RLS|storage/i.test(msg)
          ? ' → Supabase Storage에 "avatars" 버킷을 만들고, DEPLOY.md 프로필 사진 ②·③을 했는지 확인해 주세요.'
          : '';
        setStatus(`프로필 사진 업로드 실패: ${msg}${hint}`);
        setProfileAvatarUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from('members')
        .update({ avatar_url: publicUrl })
        .eq('household_id', householdId)
        .eq('user_id', user.id);
      if (updateError) {
        const msg = updateError.message || '';
        const hint = /avatar_url|column|does not exist/i.test(msg)
          ? ' → SQL Editor에서 실행: ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;'
          : '';
        setStatus(`프로필 저장 실패: ${msg}${hint}`);
        setProfileAvatarUploading(false);
        return;
      }
      setProfileAvatarUrl(publicUrl + (publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
      setProfileAvatarLoadFailed(false);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === user.id ? { ...m, avatar_url: publicUrl } : m))
      );
      setStatus('프로필 사진이 변경되었습니다.');
      setProfileAvatarUploading(false);
    },
    [user, householdId]
  );

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

  const meDisplayName =
    profileName || (user?.email ? user.email.split('@')[0] : t('me'));
  const getPlaceLabelKey = (slug: string) => {
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

  const todayLogCount = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    let list = feedTagFilter === 'all' ? logs : logs.filter((l) => l.place_slug === feedTagFilter);
    if (activeTab === 'search' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((l) => l.action.toLowerCase().includes(q));
    }
    return list.filter((l) => {
      const dt = new Date(l.created_at);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }, [logs, feedTagFilter, activeTab, searchQuery]);

  const logsForList = useMemo(() => {
    let list = feedTagFilter === 'all' ? logs : logs.filter((l) => l.place_slug === feedTagFilter);
    if (activeTab === 'search' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((l) => l.action.toLowerCase().includes(q));
    }
    return list;
  }, [logs, feedTagFilter, activeTab, searchQuery]);
  const logsByDate = logsForList.reduce<{ dateKey: string; dateLabel: string; items: Log[] }[]>((acc, log) => {
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

  const hashStr = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
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

  const shuffledSearchLogs = useMemo(() => {
    // 검색 탭 진입 시마다 seed를 바꿔, 매번 다른 배열처럼 보이게 합니다.
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

  const logsForCalendar = calendarTagFilter === 'all' ? logs : logs.filter((l) => l.place_slug === calendarTagFilter);
  const [calYear, calMonth] = calendarYearMonth.split('-').map(Number);
  const calendarFirstDay = new Date(calYear, calMonth - 1, 1);
  const calendarLastDay = new Date(calYear, calMonth, 0);
  const startWeekday = calendarFirstDay.getDay();
  const daysInMonth = calendarLastDay.getDate();
  const calendarCellCount = useMemo(() => {
    const used = startWeekday + daysInMonth;
    return Math.ceil(used / 7) * 7;
  }, [startWeekday, daysInMonth]);
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
  const selectedDayLogs = selectedCalendarDate ? (calendarDayLogsMap[selectedCalendarDate] || []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ) : [];
  const todoActiveByGroup = useMemo(() => {
    const map: Record<TodoPriorityKey, TodoTask[]> = {
      urgentImportant: [],
      notUrgentImportant: [],
      urgentNotImportant: [],
      notUrgentNotImportant: [],
    };
    todoTasks
      .filter((task) => !task.done)
      .forEach((task) => {
        map[task.key].push(task);
      });
    return map;
  }, [todoTasks]);
  const todoCompletedGroups = useMemo(() => {
    const grouped: Record<string, TodoTask[]> = {};
    const done = todoTasks.filter((task) => task.done && task.completedAt);
    done.forEach((task) => {
      const d = new Date(task.completedAt as string);
      let key = '';
      if (todoCompletedPeriod === 'day') key = d.toISOString().slice(0, 10);
      else if (todoCompletedPeriod === 'month') key = d.toISOString().slice(0, 7);
      else {
        const day = d.getDay();
        const diff = (day + 6) % 7;
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - diff);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        key = `${weekStart.toISOString().slice(0, 10)} ~ ${weekEnd.toISOString().slice(0, 10)}`;
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [todoTasks, todoCompletedPeriod]);
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
        if (normalizeLogSlug(log.place_slug) !== LOG_SLUG.bamtoli) return false;
        const { imageUrls, videoUrl } = getLogMedia(log);
        if (imageUrls.length === 0 && !videoUrl) return false;
        const ts = new Date(log.created_at).getTime();
        return growthCutoffMs === 0 || ts >= growthCutoffMs;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, growthCutoffMs]);
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
  const currentSheetComments = commentTarget ? (commentsByLogId[commentTarget.logId] ?? []) : [];
  const closeMemoPanel = () => {
    setMemoPanelAnimated(false);
    setTimeout(() => setShowMemoPanel(false), 620);
  };
  const addTodoTask = useCallback((key: TodoPriorityKey, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodoTasks((prev) => [
      { id: Date.now(), text: trimmed, key, done: false, createdAt: new Date().toISOString(), completedAt: null },
      ...prev,
    ]);
  }, []);

  const toggleTodoTaskDone = useCallback((id: number) => {
    setTodoTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, done: !task.done, completedAt: task.done ? null : new Date().toISOString() }
          : task
      )
    );
  }, []);

  const removeTodoTask = useCallback((id: number) => {
    setTodoTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const saveSharedMemos = useCallback(async () => {
    if (!householdId || !user) return;
    setMemoSaving(true);
    const full = {
      household_id: householdId,
      content: memoContent,
      family_notice: familyNotice,
      shopping_list: shoppingList,
    };
    let { error } = await supabase.from('household_memos').upsert(full, { onConflict: 'household_id' });
    if (error && /family_notice|shopping_list|schema|column/i.test(error.message ?? '')) {
      const res = await supabase
        .from('household_memos')
        .upsert({ household_id: householdId, content: memoContent }, { onConflict: 'household_id' });
      error = res.error;
    }
    if (error && /relation|schema cache|Could not find the table|household_memos/i.test(error.message ?? '')) {
      const snapshotAction = composeSharedMemoSnapshot({
        content: memoContent,
        family_notice: familyNotice,
        shopping_list: shoppingList,
      });
      if (snapshotAction === lastSavedSharedMemoSnapshotActionRef.current) {
        setMemoSaving(false);
        setStatus('가족 메모가 저장되었습니다.');
        return;
      }
      const res = await supabase.from('logs').insert({
        household_id: householdId,
        place_slug: LOG_SLUG.general,
        action: snapshotAction,
        actor_user_id: user.id,
      });
      error = res.error;
      if (!error) lastSavedSharedMemoSnapshotActionRef.current = snapshotAction;
    }
    setMemoSaving(false);
    if (error) {
      setStatus(`메모 저장 실패: ${error.message}`);
      return;
    }
    setStatus('가족 메모가 저장되었습니다.');
  }, [householdId, user, memoContent, familyNotice, shoppingList]);

  const theme = {
    bg: highContrast ? '#0f0f0f' : 'var(--bg-base)',
    card: highContrast ? '#1a1a1a' : 'var(--bg-card)',
    cardShadow: highContrast ? 'none' : 'var(--shadow-card)',
    border: highContrast ? '1px solid #333' : '1px solid rgba(0,0,0,0.06)',
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
        [data-accessibility-root] *:focus { outline: none !important; outline-offset: 0 !important; box-shadow: none !important; }
      `}</style>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: 9999,
          padding: '8px 16px',
          background: highContrast ? '#ffc107' : '#2563eb',
          color: highContrast ? '#0f0f0f' : '#fff',
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
            padding: '6px 12px 8px',
            paddingBottom: 'max(88px, calc(56px + env(safe-area-inset-bottom, 0px)))',
            background: 'transparent',
          }}
        >
        <input
          ref={profileAvatarInputRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          style={{ display: 'none' }}
          onChange={handleProfileAvatarChange}
          aria-hidden
        />
        {user && householdId ? (
          <div className="home-top-bleed" style={{ marginBottom: 8 }}>
            <AppHeader
              theme={{ border: theme.border, text: theme.text, textSecondary: theme.textSecondary, card: theme.card, radius: theme.radius, radiusLg: theme.radiusLg }}
              highContrast={highContrast}
              t={t}
            />
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
                  border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                  padding: '10px 12px',
                  fontSize: 13,
                  background: highContrast ? '#1e1e1e' : '#fff',
                  color: theme.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                aria-label="검색"
              />
            )}
            {activeTab === 'home' && (
              <>
                <details
                  className="feed-filter-disclosure"
                  open={familyNotesEditing}
                  onToggle={(e) => setFamilyNotesEditing(e.currentTarget.open)}
                  style={{
                    marginBottom: 10,
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
                        transition: 'transform 0.2s ease',
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
                            border: '1px solid #e2e8f0',
                            padding: '10px 12px',
                            fontSize: 13,
                            lineHeight: 1.5,
                            resize: 'vertical',
                            minHeight: 72,
                            background: highContrast ? '#1e1e1e' : '#fff',
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
                            border: '1px solid #e2e8f0',
                            padding: '10px 12px',
                            fontSize: 13,
                            lineHeight: 1.5,
                            resize: 'vertical',
                            minHeight: 72,
                            background: highContrast ? '#1e1e1e' : '#f8fafc',
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
                            border: '1px solid #e2e8f0',
                            background: memoSaving ? '#e2e8f0' : '#f8fafc',
                            color: memoSaving ? '#94a3b8' : '#334155',
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
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </summary>
                  <div style={{ paddingLeft: 2, paddingRight: 2, paddingBottom: 8 }}>
                    <PlaceFilterRow
                      filter={feedTagFilter}
                      setFilter={onFeedTagSelect}
                      options={feedTagOptions}
                      t={t}
                      highContrast={highContrast}
                    />
                  </div>
                </details>
              </>
            )}
          </div>
        ) : (
          <div className="home-top-bleed" style={{ marginBottom: 8 }}>
            <AppHeader
              theme={{ border: theme.border, text: theme.text, textSecondary: theme.textSecondary, card: theme.card, radius: theme.radius, radiusLg: theme.radiusLg }}
              highContrast={highContrast}
              t={t}
            />
          </div>
        )}

        {status && (
          <div
            style={{
              marginBottom: 16,
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: theme.radius,
              opacity: statusFading ? 0 : 1,
              transition: 'opacity 0.35s ease-out',
              color: status.includes('실패') || status.includes('필요') ? '#b91c1c' : 'var(--place-table-icon)',
              background:
                status.includes('실패') || status.includes('필요')
                  ? 'rgba(248,113,113,0.1)'
                  : 'var(--place-table)',
              border:
                status.includes('실패') || status.includes('필요')
                  ? '1px solid rgba(248,113,113,0.4)'
                  : '1px solid var(--place-table-icon)',
            }}
          >
            {status}
          </div>
        )}

        {!user && (
          <div style={{ fontSize: 13, color: highContrast ? '#e0e0e0' : '#475569' }}>
            <Link
              href="/login"
              style={{ color: highContrast ? '#ffc107' : '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
            >
              {t('login')}
            </Link>
            {t('loginOrJoin')}{' '}
            <Link href="/join" style={{ color: highContrast ? '#ffc107' : '#2563eb', textDecoration: 'underline' }}>
              {t('join')}
            </Link>
            {t('please')}
          </div>
        )}

        {user && householdId && (
          <>
            {activeTab === 'home' ? (
              <section style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: theme.textSecondary, margin: '0 0 10px' }}>
                  {t('dailySummary')} · <strong style={{ color: theme.text }}>{todayLogCount}</strong>
                </p>

              </section>
            ) : null}
            {activeTab === 'todo' && (
              <TodoBoard
                highContrast={highContrast}
                todoCompletedPeriod={todoCompletedPeriod}
                setTodoCompletedPeriod={setTodoCompletedPeriod}
                todoActiveByGroup={todoActiveByGroup}
                todoCompletedGroups={todoCompletedGroups}
                addTodoTask={addTodoTask}
                toggleTodoTaskDone={toggleTodoTaskDone}
                removeTodoTask={removeTodoTask}
              />
            )}
            {activeTab === 'calendar' && (
              <section aria-label="캘린더" style={{ marginBottom: 20 }}>
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
                      border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                      borderRadius: 10,
                      background: highContrast ? '#1e1e1e' : '#f8fafc',
                      color: highContrast ? '#ffc107' : '#64748b',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                    aria-label="이전 달"
                  >
                    <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>
                    <Calendar size={20} strokeWidth={1.5} aria-hidden />
                    {calYear}년 {calMonth}월
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
                      border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                      borderRadius: 10,
                      background: highContrast ? '#1e1e1e' : '#f8fafc',
                      color: highContrast ? '#ffc107' : '#64748b',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                    aria-label="다음 달"
                  >
                    <ChevronRight size={20} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
                <div
                  className="horizontal-scroll-hide"
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    gap: 6,
                    marginBottom: 6,
                    paddingBottom: 2,
                  }}
                >
                  {feedTagOptions.map(({ key, label }) => {
                    const active = calendarTagFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCalendarTagFilter(key as 'all' | LogSlug)}
                        style={{
                          flexShrink: 0,
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: active ? '1px solid var(--accent)' : '1px solid #e2e8f0',
                          background: active ? 'var(--accent-light)' : highContrast ? '#1e1e1e' : '#f8fafc',
                          color: active ? 'var(--accent)' : highContrast ? '#94a3b8' : '#64748b',
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
                    background: highContrast ? '#1e1e1e' : '#fff',
                    borderRadius: 12,
                    padding: 10,
                    border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                  }}
                >
                  {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                    <div
                      key={w}
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: highContrast ? '#ffc107' : '#64748b',
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
                    const selected = dateKey === selectedCalendarDate;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedCalendarDate(isInMonth && dateKey ? dateKey : null)}
                        style={{
                          minHeight: 44,
                          padding: 0,
                          border: 'none',
                          borderRadius: 8,
                          background: !isInMonth
                            ? 'transparent'
                            : selected
                              ? (highContrast ? 'rgba(255,193,7,0.3)' : 'rgba(59,130,246,0.2)')
                              : highContrast
                                ? '#2a2a2a'
                                : '#fff',
                          color: !isInMonth
                            ? (highContrast ? '#6b7280' : '#cbd5e1')
                            : selected
                              ? (highContrast ? '#ffc107' : '#1d4ed8')
                              : highContrast
                                ? '#fff'
                                : '#0f172a',
                          fontSize: 13,
                          fontWeight: selected ? 700 : 500,
                          cursor: isInMonth ? 'pointer' : 'default',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: highContrast && selected ? '0 0 0 2px #ffc107' : undefined,
                        }}
                      >
                        <span style={{ lineHeight: 1 }}>{isInMonth ? dayNum : ''}</span>
                        <span
                          style={{
                            fontSize: 10,
                            marginTop: 0,
                            minHeight: 12,
                            color: highContrast ? '#ffc107' : '#64748b',
                            lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                            opacity: count > 0 ? 1 : 0,
                          }}
                        >
                          {count > 0 ? `${count}건` : '0건'}
                        </span>
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
                        background: highContrast ? 'rgba(255,193,7,0.15)' : '#e2e8f0',
                        borderLeft: highContrast ? '4px solid #ffc107' : '4px solid #64748b',
                        color: highContrast ? '#ffc107' : '#0f172a',
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
                          background: highContrast ? '#333' : '#cbd5e1',
                          color: highContrast ? '#fff' : '#475569',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        닫기
                      </button>
                    </div>
                    <div
                      style={{
                        maxHeight: '45vh',
                        overflowY: 'auto',
                        borderRadius: 12,
                        border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                        background: highContrast ? '#1e1e1e' : '#f8fafc',
                        padding: 10,
                      }}
                    >
                      {selectedDayLogs.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 13, color: highContrast ? '#94a3b8' : '#64748b', textAlign: 'center' }}>
                          이 날짜에 기록된 로그가 없습니다.
                        </div>
                      ) : (
                        selectedDayLogs.map((log) => {
                          const isMine = user && log.actor_user_id === user.id;
                          const isEditing = editingLogId === log.id;
                          return (
                            <div
                              key={log.id}
                              className="log-card"
                              style={highContrast ? { border: '1px solid #ffc107', background: '#2a2a2a' } : undefined}
                            >
                              <button
                                type="button"
                                onClick={() => applyTagFromLogCard(log.place_slug)}
                                className={`log-place-tag ${log.place_slug}`}
                                style={{ border: 'none', cursor: 'pointer' }}
                              >
                                #{t(getPlaceLabelKey(log.place_slug))}
                              </button>
                              <div className="log-time" style={highContrast ? { color: '#94a3b8' } : undefined}>{formatDateTime(log.created_at)}</div>
                              <div className="log-content" style={highContrast ? { color: '#fff' } : undefined}>
                                {parseLogMeta(log.action).text}
                              </div>
                              {(() => {
                                const meta = parseLogMeta(log.action).meta;
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
                                      color: highContrast ? '#ffc107' : '#3b82f6',
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
                                        <img src={url} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', display: 'block', background: '#f1f5f9' }} />
                                      </a>
                                    ))}
                                    {imageUrls.length > 3 && <span style={{ fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b' }}>+{imageUrls.length - 3}</span>}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>
                    <Baby size={20} strokeWidth={1.5} aria-hidden />
                    성장 타임라인
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {[
                      { key: 'week' as const, label: '1주' },
                      { key: 'month' as const, label: '1개월' },
                      { key: 'quarter' as const, label: '분기' },
                      { key: 'half' as const, label: '반기' },
                      { key: 'year' as const, label: '연간' },
                      { key: 'all' as const, label: '전체' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setGrowthRange(opt.key)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: `1px solid ${growthRange === opt.key ? 'var(--accent)' : '#e2e8f0'}`,
                          background: growthRange === opt.key ? 'var(--accent-light)' : '#fff',
                          color: growthRange === opt.key ? 'var(--accent)' : '#64748b',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {growthTimelineLogs.slice(0, 12).map((log) => {
                      const { imageUrls, videoUrl } = getLogMedia(log);
                      const cleanImages = imageUrls.map((u) => normalizeMediaUrl(u)).filter((u) => u.length > 0);
                      const cleanVideo = normalizeMediaUrl(videoUrl);
                      const media = getPrimaryMedia(log);
                      const thumb = media?.url ?? '';
                      const parsed = parseLogMeta(log.action);
                      return (
                        <button
                          key={`growth-${log.id}`}
                          type="button"
                          onClick={() => {
                            if (!media) return;
                            if (cleanImages.length > 0) {
                              const params = new URLSearchParams();
                              params.set('type', 'image');
                              params.set('urls', JSON.stringify(cleanImages));
                              params.set('index', '0');
                              params.set('url', cleanImages[0]);
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
                            background: '#fff',
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
                                    borderLeft: '16px solid #fff',
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
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{formatDateTime(log.created_at).slice(0, 12)}</div>
                            <div style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parsed.text}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>
                    <History size={20} strokeWidth={1.5} aria-hidden />
                    오늘의 회상
                  </div>
                  {todayMemoryLogs.length === 0 ? (
                    <div style={{ fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b' }}>아직 같은 날짜의 과거 기록이 없어요.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {todayMemoryLogs.map((log) => {
                        const year = new Date(log.created_at).getFullYear();
                        const parsed = parseLogMeta(log.action);
                        return (
                          <div key={`memory-${log.id}`} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--divider)', background: highContrast ? '#1e1e1e' : '#fff' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#ffc107' : '#334155', marginBottom: 4 }}>{year}년 오늘</div>
                            <div style={{ fontSize: 13, color: highContrast ? '#e2e8f0' : '#0f172a' }}>{parsed.text}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'home' && (
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
                formatDateTime={formatDateTime}
                getPlaceLabelKey={getPlaceLabelKey}
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
                onStickerRemove={(logId) => {
                  void applyStickerToLog(logId, null);
                }}
                onTagClick={applyTagFromLogCard}
              />
            )}
            {activeTab === 'search' && (
              <section aria-label="검색" style={{ marginBottom: 20 }}>
                {searchMediaLogs.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                    }}
                  >
                    {searchMediaLogs.slice(0, 120).map((log) => {
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
                              params.set('urls', JSON.stringify(cleanImages));
                              params.set('index', '0');
                              params.set('url', cleanImages[0]);
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
                              background: highContrast ? '#0f0f0f' : '#fff',
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
                                  background: '#f1f5f9',
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
                                    borderLeft: '16px solid #fff',
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
                ) : (
                  <div style={{ padding: '0 2px' }}>
                    {searchTextOnlyLogs.slice(0, 80).map((log) => {
                      const parsed = parseLogMeta(log.action);
                      return (
                        <div
                          key={`search-text-${log.id}`}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: highContrast ? '1px solid #333' : '1px solid var(--divider)',
                            background: highContrast ? '#1e1e1e' : '#fff',
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                            <button
                              type="button"
                              onClick={() => applyTagFromLogCard(log.place_slug)}
                              className={`log-place-tag ${log.place_slug}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              #{t(getPlaceLabelKey(log.place_slug))}
                            </button>
                            <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : 'var(--text-caption)' }}>
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: highContrast ? '#e2e8f0' : 'var(--text-primary)', lineHeight: 1.35 }}>
                            {parsed.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

          </>
        )}
        </div>
      </div>

      {user && householdId && commentTarget && (activeTab === 'home' || activeTab === 'search') && (
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
            onClick={() => {
              setCommentSheetAnimated(false);
              setTimeout(() => { setCommentTarget(null); setReplyingTo(null); }, 250);
            }}
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
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              transform: commentSheetAnimated ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--divider)' }} aria-hidden />
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {commentTarget.parentId ? '답글' : '댓글'}
              </h3>
              <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10, paddingRight: 2 }}>
                {currentSheetComments.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-caption)', padding: '8px 2px' }}>아직 댓글이 없어요.</div>
                ) : (
                  currentSheetComments.map((c) => (
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
                      {user && isSameUserId(c.user_id, user.id) && editingCommentId !== c.id && (
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
                        addComment(commentTarget.logId, draft, commentTarget.parentId);
                        setCommentDraft((prev) => { const next = { ...prev }; delete next[key]; return next; });
                        setCommentSheetAnimated(false);
                        setTimeout(() => { setCommentTarget(null); setReplyingTo(null); }, 250);
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
                      addComment(commentTarget.logId, draft, commentTarget.parentId);
                      setCommentDraft((prev) => { const next = { ...prev }; delete next[key]; return next; });
                      setCommentSheetAnimated(false);
                      setTimeout(() => { setCommentTarget(null); setReplyingTo(null); }, 250);
                    }
                  }}
                  disabled={commentSending || !((commentTarget.parentId ? commentDraft[`${commentTarget.logId}_reply_${commentTarget.parentId}`] : commentDraft[commentTarget.logId]) ?? '').trim()}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: commentSending ? 'wait' : 'pointer',
                  }}
                >
                  {commentTarget.parentId ? '답글' : '전송'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCommentSheetAnimated(false);
                  setTimeout(() => { setCommentTarget(null); setReplyingTo(null); }, 250);
                }}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '10px',
                  borderRadius: 12,
                  border: '1px solid var(--divider)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}

      {stickerPickerOpen && (
        <>
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 44,
            }}
            onClick={() => {
              setStickerPickerOpen(false);
              setStickerPickerLogId(null);
            }}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="스티커 선택"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 45,
              background: highContrast ? '#1e1e1e' : '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              paddingTop: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--divider)' }} aria-hidden />
            </div>
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: highContrast ? '#fff' : '#0f172a', marginBottom: 10 }}>
                스티커 선택
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => pickSticker(null)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 999,
                    border: '1px solid var(--divider)',
                    background: 'transparent',
                    color: highContrast ? '#94a3b8' : '#64748b',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  제거
                </button>
                {stickerOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSticker(s)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--divider)',
                      background: highContrast ? 'rgba(255,255,255,0.04)' : 'var(--bg-subtle)',
                      color: highContrast ? '#fff' : '#0f172a',
                      fontSize: 18,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                    aria-label={`스티커: ${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {showNameEditModal && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 54 }}
            onClick={() => setShowNameEditModal(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label={t('editName')}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(340px, 92vw)',
              padding: 20,
              borderRadius: 16,
              background: highContrast ? '#1e1e1e' : '#fff',
              border: highContrast ? '2px solid #ffc107' : '1px solid var(--bg-subtle)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              zIndex: 55,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, color: highContrast ? '#e0e0e0' : '#94a3b8', marginBottom: 8 }}>{t('nameForFamily')}</div>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={t('namePlaceholder')}
              aria-label={t('nameForFamily')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 14,
                outline: 'none',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowNameEditModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f1f5f9',
                  color: '#64748b',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleProfileSave();
                  setShowNameEditModal(false);
                }}
                disabled={profileSaving}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: profileSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {profileSaving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </>
      )}

      {user && (
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          t={t}
          highContrast={highContrast}
          language={language}
          setLanguage={setLanguage}
          langLabels={langLabels}
          writePlaceSlug={activeTab === 'home' && feedTagFilter !== 'all' ? feedTagFilter : null}
          onNameEdit={() => setShowNameEditModal(true)}
          onProfilePhotoChange={() => profileAvatarInputRef.current?.click()}
          onInviteFamily={() => router.push('/invite')}
          onAccessibility={() => setShowAccessibilityModal(true)}
          profileAvatarUploading={profileAvatarUploading}
        />
      )}



      {showMemoPanel && (
        <>
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 58,
              opacity: memoPanelAnimated ? 1 : 0,
              transition: 'opacity 0.55s ease-out',
            }}
            onClick={closeMemoPanel}
          />
          <div
            role="dialog"
            aria-label="메모"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(320px, 85vw)',
              background: highContrast ? '#1e1e1e' : '#fff',
              borderLeft: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
              zIndex: 59,
              display: 'flex',
              flexDirection: 'column',
              padding: 16,
              overflow: 'hidden',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
              transform: memoPanelAnimated ? 'translateX(0)' : 'translateX(24px)',
              opacity: memoPanelAnimated ? 1 : 0,
              transition: 'transform 0.65s cubic-bezier(0.22, 0.9, 0.32, 1), opacity 0.55s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { const t = e.changedTouches?.[0]; if (t) memoSwipeStartRef.current = t.clientX; }}
            onTouchEnd={(e) => {
              const t = e.changedTouches?.[0];
              if (!t || memoSwipeStartRef.current == null) return;
              const start = memoSwipeStartRef.current;
              const end = t.clientX;
              memoSwipeStartRef.current = null;
              if (end - start > 50) closeMemoPanel();
            }}
          >
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} strokeWidth={1.5} aria-hidden />
                {t('memoTitle')}
              </h3>
              <button
                type="button"
                onClick={() => void saveSharedMemos()}
                disabled={memoSaving}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                  background: highContrast ? '#1e1e1e' : '#fff',
                  color: highContrast ? '#fff' : '#334155',
                  fontSize: 12,
                  cursor: memoSaving ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {memoSaving ? '저장 중...' : t('save')}
              </button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b', lineHeight: 1.35 }}>
                {t('memoSharedHint')}
              </p>
            </div>
            <textarea
              value={memoContent}
              onChange={(e) => {
                sharedMemoTypingUntilRef.current = Date.now() + 2500;
                setMemoContent(e.target.value);
              }}
              placeholder="메모를 입력하세요..."
              style={{
                flex: 1,
                width: '100%',
                boxSizing: 'border-box',
                padding: 12,
                borderRadius: 12,
                border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
                background: highContrast ? '#0f0f0f' : '#f8fafc',
                color: highContrast ? '#fff' : '#0f172a',
                fontSize: 14,
                resize: 'none',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                outline: 'none',
              }}
              onWheel={(e) => e.stopPropagation()}
            />
          </div>
        </>
      )}

      <div
        role="presentation"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 96,
          zIndex: 35,
          touchAction: 'pan-y',
        }}
        onTouchStart={(e) => { const t = e.changedTouches?.[0]; if (t) swipeStartRef.current = t.clientX; }}
        onTouchEnd={(e) => {
          const t = e.changedTouches?.[0];
          if (!t || swipeStartRef.current == null) return;
          const start = swipeStartRef.current;
          const end = t.clientX;
          swipeStartRef.current = null;
          if (start > window.innerWidth - 140 && start - end > 36) setShowMemoPanel(true);
        }}
      />

      {enlargedAvatarUrl && (
        <div
          role="dialog"
          aria-label="프로필 사진 확대"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            touchAction: 'manipulation',
          }}
          onClick={() => setEnlargedAvatarUrl(null)}
        >
          <img
            src={enlargedAvatarUrl}
            alt=""
            style={{
              width: '100vw',
              height: '100vh',
              maxWidth: '100vw',
              maxHeight: '100vh',
              objectFit: 'contain',
              display: 'block',
            }}
            onClick={() => setEnlargedAvatarUrl(null)}
          />
        </div>
      )}

      {actionPopupLogId && (
        <div
          role="presentation"
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => setActionPopupLogId(null)}
        >
          <div
            role="dialog"
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 80,
              transform: 'translateX(-50%)',
              minWidth: 200,
              padding: '12px 0',
              borderRadius: 16,
              background: '#fff',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              zIndex: 51,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const log = logs.find((l) => l.id === actionPopupLogId);
              if (!log) return null;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/write?edit=${encodeURIComponent(log.id)}`);
                      setActionPopupLogId(null);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      fontSize: 15,
                      color: highContrast ? '#ffffff' : '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteLog(log.id);
                      setActionPopupLogId(null);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      fontSize: 15,
                      color: '#dc2626',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {t('delete')}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}


      {showAccessibilityModal && (
        <div
          role="dialog"
          aria-labelledby="accessibility-title"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAccessibilityModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 24,
              borderRadius: 20,
              background: '#fff',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="accessibility-title" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Accessibility size={20} strokeWidth={1.5} aria-hidden />
              {t('accessibility')}
            </h2>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  aria-describedby="high-contrast-desc"
                />
                <span style={{ fontSize: 15, color: '#0f172a' }}>{t('highContrast')}</span>
              </label>
              <p id="high-contrast-desc" style={{ margin: '0 0 0 28px', fontSize: 12, color: '#64748b' }}>
                {t('highContrastDesc')}
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t('fontSizeStyle')}</p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>{t('bigFontHint')}</p>
              <div
                style={{
                  borderRadius: 14,
                  border: '1px solid #e8eaed',
                  background: '#fafafa',
                  padding: '14px 14px 12px',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: `clamp(13px, ${0.85 + accFontDraft.step * 0.12}rem, 22px)`,
                    fontWeight: accFontDraft.bold ? 700 : 500,
                    color: '#0f172a',
                    lineHeight: 1.45,
                    marginBottom: 6,
                  }}
                >
                  {t('fontPreviewLine1')}
                </div>
                <div
                  style={{
                    fontSize: `clamp(12px, ${0.75 + accFontDraft.step * 0.1}rem, 18px)`,
                    fontWeight: accFontDraft.bold ? 600 : 400,
                    color: '#475569',
                    letterSpacing: '0.02em',
                  }}
                >
                  {t('fontPreviewLine2')}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{t('fontSizeLabel')}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{Math.round(FONT_STEPS[accFontDraft.step] * 100)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', lineHeight: 1 }} aria-hidden>A</span>
                  <input
                    type="range"
                    min={0}
                    max={7}
                    step={1}
                    value={accFontDraft.step}
                    onChange={(e) =>
                      setAccFontDraft((d) => ({ ...d, step: Number(e.target.value) as FontScaleStep }))
                    }
                    aria-valuetext={`${Math.round(FONT_STEPS[accFontDraft.step] * 100)}%`}
                    style={{
                      flex: 1,
                      height: 6,
                      accentColor: 'var(--accent)',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }} aria-hidden>A</span>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 14, color: '#0f172a' }}>{t('fontBold')}</span>
                <input
                  type="checkbox"
                  checked={accFontDraft.bold}
                  onChange={(e) => setAccFontDraft((d) => ({ ...d, bold: e.target.checked }))}
                />
              </label>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={simpleMode}
                  onChange={(e) => setSimpleMode(e.target.checked)}
                  aria-describedby="simple-mode-desc"
                />
                <span style={{ fontSize: 15, color: '#0f172a' }}>{t('simpleMode')}</span>
              </label>
              <p id="simple-mode-desc" style={{ margin: '0 0 0 28px', fontSize: 12, color: '#64748b' }}>
                {t('simpleModeHint')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFontScaleStep(accFontDraft.step);
                setFontBold(accFontDraft.bold);
                setShowAccessibilityModal(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: 14,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}