'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import { getT, langLabels, type Lang } from './translations';
import { Calendar, Image as ImageIcon, X, ChevronLeft, ChevronRight, ChevronDown, FileText, Accessibility, Baby, History, MapPin, ExternalLink, Sparkles, Plus, MoreVertical } from 'lucide-react';
import { LOG_SLUG, type LogFilterKey, filterSlugForQuery } from '../lib/logTags';
import { parseLogMeta, composeActionWithMeta, type LogMeta } from '../lib/logActionMeta';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomTabBar, type TabId } from '../components/layout/BottomTabBar';
import { MemberFilter } from '../components/home/MemberFilter';
import { PlaceFilterRow } from '../components/home/PlaceFilterRow';
import { LogFeed } from '../components/home/LogFeed';

type Log = {
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

function getLogMedia(log: Log): { imageUrls: string[]; videoUrl: string | null } {
  let imageUrls: string[] = [];
  if (log.image_urls) {
    try {
      const parsed = JSON.parse(log.image_urls);
      imageUrls = Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
    } catch {}
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
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<'all' | 'me' | string>('all');
  const [placeViewFilter, setPlaceViewFilter] = useState<LogFilterKey>('all');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const [calendarYearMonth, setCalendarYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [calendarMemberFilter, setCalendarMemberFilter] = useState<'all' | 'me' | string>('all');
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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  const memoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fontScale = FONT_STEPS[fontScaleStep];

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
    (async () => {
      const { data, error } = await supabase
        .from('household_memos')
        .select('content, family_notice, shopping_list')
        .eq('household_id', householdId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
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
      if (data && typeof data.content === 'string') {
        setMemoContent(data.content);
        try {
          localStorage.setItem(MEMO_KEY, data.content);
        } catch {}
      }
      if (data && typeof data.family_notice === 'string') {
        setFamilyNotice(data.family_notice);
      } else {
        try {
          const n = localStorage.getItem('family_qr_log_notice');
          if (n) setFamilyNotice(n);
        } catch {}
      }
      if (data && typeof data.shopping_list === 'string') {
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
  }, [householdId, user]);

  useEffect(() => {
    if (!householdId) return;
    const pull = async () => {
      const { data } = await supabase
        .from('household_memos')
        .select('content, family_notice, shopping_list')
        .eq('household_id', householdId)
        .maybeSingle();
      if (!data) return;
      if (typeof data.content === 'string') setMemoContent(data.content);
      if (typeof data.family_notice === 'string') setFamilyNotice(data.family_notice);
      if (typeof data.shopping_list === 'string') setShoppingList(data.shopping_list);
    };
    const channel = supabase
      .channel(`household-memos-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_memos', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const next = payload.new as { content?: string; family_notice?: string; shopping_list?: string } | null;
          if (!next) return;
          if (typeof next.content === 'string') setMemoContent(next.content);
          if (typeof next.family_notice === 'string') setFamilyNotice(next.family_notice);
          if (typeof next.shopping_list === 'string') setShoppingList(next.shopping_list);
        }
      )
      .subscribe();
    const timer = window.setInterval(() => {
      void pull();
    }, 5000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [householdId]);

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
      if (error && /relation|does not exist/i.test(error.message ?? '')) {
        // Supabase에 household_memos 테이블 생성 후 가족 간 동기화 (DEPLOY.md 참고)
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
      status.includes('프로필 사진이 변경되었습니다');

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
      let query = supabase
        .from('logs')
        .select('*')
        .eq('household_id', hid)
        .order('created_at', { ascending: false })
        .limit(500);

      if (slug) {
        query = query.eq('place_slug', slug);
      }

      if (actorUserId) {
        query = query.eq('actor_user_id', actorUserId);
      }

      const { data, error } = await query;

      if (error) {
        setStatus(`logs 조회 실패: ${error.message}`);
        return;
      }

      setLogs(data ?? []);
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

  const updateComment = useCallback(
    async (commentId: string, logId: string, content: string) => {
      if (!user || !content.trim()) return;
      const { error } = await supabase.from('log_comments').update({ content: content.trim() }).eq('id', commentId).eq('user_id', user.id);
      if (error) {
        setStatus(`댓글 수정 실패: ${error.message}`);
        return;
      }
      await loadComments([logId]);
      setEditingCommentId(null);
      setEditingCommentValue('');
    },
    [user, loadComments]
  );

  const deleteComment = useCallback(
    async (commentId: string, logId: string) => {
      if (!user) return;
      const { error } = await supabase.from('log_comments').delete().eq('id', commentId).eq('user_id', user.id);
      if (error) {
        setStatus(`댓글 삭제 실패: ${error.message}`);
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

      const placeSlugFilter = filterSlugForQuery(placeViewFilter);
      const actorId = selectedMemberId === 'all' ? undefined : selectedMemberId === 'me' ? user.id : selectedMemberId;
      await loadLogs(householdId, placeSlugFilter, actorId);
      setStickerPickerOpen(false);
      setStickerPickerLogId(null);
    },
    [user, householdId, logs, placeViewFilter, selectedMemberId, loadLogs]
  );

  const pickSticker = (sticker: string | null) => {
    if (!stickerPickerLogId) return;
    applyStickerToLog(stickerPickerLogId, sticker);
  };

  useEffect(() => {
    if (!householdId || !user) return;

    const actorId = selectedMemberId === 'all' ? undefined : selectedMemberId === 'me' ? user.id : selectedMemberId;
    const placeSlugFilter = filterSlugForQuery(placeViewFilter);

    loadLogs(householdId, placeSlugFilter, actorId);
  }, [householdId, placeViewFilter, selectedMemberId, user, loadLogs]);

  const refreshLogs = useCallback(() => {
    if (!householdId || !user) return;
    const placeSlugFilter = filterSlugForQuery(placeViewFilter);
    const actorId = selectedMemberId === 'all' ? undefined : selectedMemberId === 'me' ? user.id : selectedMemberId;
    loadLogs(householdId, placeSlugFilter, actorId);
  }, [householdId, placeViewFilter, selectedMemberId, user, loadLogs]);

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

  const meDisplayName =
    profileName || (user?.email ? user.email.split('@')[0] : t('me'));
  const getPlaceLabelKey = (slug: string) => {
    const map: Record<string, string> = {
      [LOG_SLUG.general]: 'logGeneral',
      fridge: 'fridge',
      table: 'table',
      toilet: 'toilet',
      health: 'topicHealth',
      diet: 'topicDiet',
      kid: 'topicKid',
      pet: 'topicPet',
      todo: 'topicTodo',
      outing: 'topicOuting',
      parking: 'topicParking',
    };
    return map[slug] ?? 'logGeneral';
  };

  const todayLogCount = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    return logs.filter((l) => {
      const dt = new Date(l.created_at);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }, [logs]);

  const logsForList =
    activeTab === 'search' && searchQuery.trim()
      ? logs.filter((l) => l.action.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : logs;
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

  const calendarMemberOptions = useMemo(() => {
    const labels = ['밤톨대디', '밤톨맘', '밤톨이', '엄니아부지', '마더리빠더리', '단이네 우차차', '똘모닝'];
    const others = members
      .filter((m) => m.user_id !== user?.id)
      .map((m, idx) => ({
        key: m.user_id,
        label: labels[idx] ?? ((m.display_name && m.display_name.trim()) || m.user_id.slice(0, 6)),
      }));
    return [
      { key: 'all' as const, label: '전체' },
      { key: 'me' as const, label: '다같이' },
      ...others,
    ];
  }, [members, user?.id]);

  const logsForCalendar =
    calendarMemberFilter === 'all'
      ? logs
      : calendarMemberFilter === 'me'
        ? logs.filter((l) => l.actor_user_id === user?.id)
        : logs.filter((l) => l.actor_user_id === calendarMemberFilter);
  const [calYear, calMonth] = calendarYearMonth.split('-').map(Number);
  const calendarFirstDay = new Date(calYear, calMonth - 1, 1);
  const calendarLastDay = new Date(calYear, calMonth, 0);
  const startWeekday = calendarFirstDay.getDay();
  const daysInMonth = calendarLastDay.getDate();
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
        const actorName = getMemberName(log.actor_user_id);
        if (actorName !== '밤톨이') return false;
        const { imageUrls, videoUrl } = getLogMedia(log);
        if (imageUrls.length === 0 && !videoUrl) return false;
        const ts = new Date(log.created_at).getTime();
        return growthCutoffMs === 0 || ts >= growthCutoffMs;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, growthCutoffMs, getMemberName]);
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '0 0 56px',
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
          padding: '6px 12px 8px',
          background: 'transparent',
          color: theme.text,
          ...(highContrast && { background: '#0f0f0f', border: '2px solid #ffc107' }),
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
            {(activeTab === 'home' || activeTab === 'search') && (
              <>
                <div
                  style={{
                    position: 'relative',
                    marginBottom: 10,
                    padding: '10px 12px',
                    paddingRight: 44,
                    borderRadius: theme.radiusLg,
                    border: theme.border,
                    background: theme.card,
                    boxShadow: theme.cardShadow,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFamilyNotesEditing((v) => !v)}
                    aria-label={familyNotesEditing ? t('doneEditing') : t('editFamilyNotes')}
                    aria-expanded={familyNotesEditing}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      background: highContrast ? '#1e1e1e' : '#f8fafc',
                      color: highContrast ? '#ffc107' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                  </button>
                  {!familyNotesEditing ? (
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: theme.text }}>
                      <div>
                        <span style={{ color: theme.textSecondary, fontSize: 11, display: 'block' }}>{t('familyNotice')}</span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{familyNotice.trim() ? familyNotice : t('emptyMemo')}</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: theme.textSecondary, fontSize: 11, display: 'block' }}>{t('shoppingListTitle')}</span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{shoppingList.trim() ? shoppingList : t('emptyMemo')}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div>
                        <label htmlFor="family-notice-input" style={{ fontSize: 11, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>
                          {t('familyNotice')}
                        </label>
                        <textarea
                          id="family-notice-input"
                          value={familyNotice}
                          onChange={(e) => setFamilyNotice(e.target.value)}
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
                          onChange={(e) => setShoppingList(e.target.value)}
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
                    </div>
                  )}
                </div>
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
                      filter={placeViewFilter}
                      setFilter={setPlaceViewFilter}
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
                <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', gap: 6, marginBottom: 12, paddingBottom: 2 }}>
                  {calendarMemberOptions.map(({ key, label }) => {
                    const active = calendarMemberFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCalendarMemberFilter(key)}
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
                  {Array.from({ length: 42 }, (_, i) => {
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
                          background: selected ? (highContrast ? 'rgba(255,193,7,0.3)' : 'rgba(59,130,246,0.2)') : highContrast ? '#2a2a2a' : '#fff',
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
                              <span className={`log-place-tag ${log.place_slug}`}>{t(getPlaceLabelKey(log.place_slug))}</span>
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
                      const thumb = imageUrls[0] || videoUrl || '';
                      const parsed = parseLogMeta(log.action);
                      return (
                        <div key={`growth-${log.id}`} style={{ border: '1px solid var(--divider)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                          {thumb ? (
                            videoUrl ? (
                              <video src={thumb} muted playsInline preload="metadata" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', background: '#000' }} />
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
                        </div>
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
            />
          </>
        )}
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
                            onClick={() => updateComment(c.id, commentTarget.logId, editingCommentValue)}
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
                      {user && c.user_id === user.id && editingCommentId !== c.id && (
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
                            onClick={() => deleteComment(c.id, commentTarget.logId)}
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
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} strokeWidth={1.5} aria-hidden />
              {t('memoTitle')}
            </h3>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b', lineHeight: 1.35 }}>
                {t('memoSharedHint')}
              </p>
            </div>
            <textarea
              value={memoContent}
              onChange={(e) => setMemoContent(e.target.value)}
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
                outline: 'none',
              }}
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
          width: 28,
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
          if (start > window.innerWidth - 80 && start - end > 50) setShowMemoPanel(true);
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