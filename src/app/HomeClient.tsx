'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import jsQR from 'jsqr';
import { getT, langLabels, type Lang } from './translations';

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
      return { background: 'rgba(56,189,248,0.2)', color: '#0369a1', border: '1px solid rgba(56,189,248,0.5)' };
    case 'table':
      return { background: 'rgba(34,197,94,0.2)', color: '#166534', border: '1px solid rgba(34,197,94,0.5)' };
    case 'toilet':
      return { background: 'rgba(251,191,36,0.25)', color: '#a16207', border: '1px solid rgba(251,191,36,0.5)' };
    default:
      return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
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

const QUICK_PHRASES_KEY = 'family_qr_log_quick_phrases';
const ACCESSIBILITY_KEY = 'family_qr_log_accessibility';
const MEMO_KEY = 'family_qr_log_memo';
const FONT_SCALES = [1, 1.25, 1.5, 2] as const;
type FontScale = (typeof FONT_SCALES)[number];

function loadAccessibility(): {
  highContrast: boolean;
  fontScale: FontScale;
  simpleMode: boolean;
  language: Lang;
} {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(ACCESSIBILITY_KEY) : null;
    if (!raw) return { highContrast: false, fontScale: 1, simpleMode: false, language: 'ko' };
    const p = JSON.parse(raw);
    const lang = p.language && ['ko', 'en', 'ja', 'zh', 'vi'].includes(p.language) ? p.language : 'ko';
    const scale = typeof p.fontScale === 'number' && FONT_SCALES.includes(p.fontScale as FontScale)
      ? (p.fontScale as FontScale) : 1;
    return {
      highContrast: !!p.highContrast,
      fontScale: scale,
      simpleMode: !!p.simpleMode,
      language: lang,
    };
  } catch {
    return { highContrast: false, fontScale: 1, simpleMode: false, language: 'ko' };
  }
}

const MAX_IMAGE_SIDE = 1200;
const JPEG_QUALITY = 0.82;
const VIDEO_MAX_MB = 20;

function compressImageFile(file: File): Promise<{ file: File; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE) {
        if (w >= h) {
          h = Math.round((h * MAX_IMAGE_SIDE) / w);
          w = MAX_IMAGE_SIDE;
        } else {
          w = Math.round((w * MAX_IMAGE_SIDE) / h);
          h = MAX_IMAGE_SIDE;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('blob'));
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
          const out = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
          resolve({ file: out, previewUrl: URL.createObjectURL(blob) });
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load'));
    };
    img.src = url;
  });
}

export default function HomeClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlPlace = searchParams.get('place');
  const hasPlaceFromUrl = urlPlace === 'fridge' || urlPlace === 'table' || urlPlace === 'toilet';
  const placeSlug = hasPlaceFromUrl ? urlPlace! : 'fridge';

  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<'all' | 'me' | string>('all');
  const [placeViewFilter, setPlaceViewFilter] = useState<'fridge' | 'table' | 'toilet' | 'all'>('all');

  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [logImageFiles, setLogImageFiles] = useState<File[]>([]);
  const [logImagePreviews, setLogImagePreviews] = useState<string[]>([]);
  const [logVideoFile, setLogVideoFile] = useState<File | null>(null);
  const [logVideoPreview, setLogVideoPreview] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [quickPhrases, setQuickPhrases] = useState<string[]>([]);
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [newPhraseInput, setNewPhraseInput] = useState('');

  const [profileName, setProfileName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNameEditInMenu, setShowNameEditInMenu] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>(1);
  const [simpleMode, setSimpleMode] = useState(false);
  const [language, setLanguage] = useState<Lang>('ko');
  const menuRef = useRef<HTMLDivElement>(null);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [actionPopupLogId, setActionPopupLogId] = useState<string | null>(null);
  type TabId = 'home' | 'calendar' | 'qr' | 'search';
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const [calendarYearMonth, setCalendarYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [calendarPlaceFilter, setCalendarPlaceFilter] = useState<'fridge' | 'table' | 'toilet' | 'all'>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [commentsByLogId, setCommentsByLogId] = useState<Record<string, LogComment[]>>({});
  const [replyingTo, setReplyingTo] = useState<{ logId: string; commentId: string } | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawLastRef = useRef<{ x: number; y: number } | null>(null);
  const drawActiveRef = useRef(false);
  const [editImageIndex, setEditImageIndex] = useState<number | null>(null);
  const [editImageTag, setEditImageTag] = useState('');
  const [editImageFilter, setEditImageFilter] = useState<'none' | 'grayscale' | 'sepia'>('none');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logPreviewUrlsRef = useRef<string[]>([]);
  const logVideoPreviewUrlRef = useRef<string | null>(null);
  const swipeStartRef = useRef<number | null>(null);

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

      const {
        data: myMembers,
        error: memberError,
      } = await supabase
        .from('members')
        .select('household_id, display_name, user_id, avatar_url')
        .eq('user_id', user.id)
        .limit(1);

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

      const baseName =
        (myMember.display_name && myMember.display_name.trim()) ||
        (user.email ? user.email.split('@')[0] : '나');
      setProfileName(baseName);
      setProfileAvatarUrl(myMember.avatar_url ?? null);

      const { data: allMembers, error: allMembersError } = await supabase
        .from('members')
        .select('user_id, display_name, avatar_url')
        .eq('household_id', myMember.household_id);

      if (!allMembersError && allMembers) {
        setMembers(allMembers);
      }
    };

    init();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_PHRASES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setQuickPhrases(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      setQuickPhrases([]);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEMO_KEY);
      if (raw != null) setMemoContent(raw);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(MEMO_KEY, memoContent);
    } catch {}
  }, [memoContent]);

  const accessibilityLoadedRef = useRef(false);
  useEffect(() => {
    const a = loadAccessibility();
    setHighContrast(a.highContrast);
    setFontScale(a.fontScale);
    setSimpleMode(a.simpleMode);
    setLanguage(a.language);
    accessibilityLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!accessibilityLoadedRef.current) return;
    try {
      localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify({
        highContrast,
        fontScale,
        simpleMode,
        language,
      }));
    } catch {}
  }, [highContrast, fontScale, simpleMode, language]);

  const t = useMemo(() => getT(language), [language]);

  const saveQuickPhrases = useCallback((next: string[]) => {
    setQuickPhrases(next);
    try {
      localStorage.setItem(QUICK_PHRASES_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  useEffect(() => {
    if (!showScanner || typeof window === 'undefined') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tick = () => {
      if (!video || !canvas || !streamRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          const url = code.data;
          const match = url.match(/[?&]place=(fridge|table|toilet)/i);
          const place = match ? match[1].toLowerCase() : null;
          if (place) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setShowScanner(false);
            window.location.href = `${window.location.origin}?place=${place}`;
            return;
          }
        }
      }
      scanLoopRef.current = requestAnimationFrame(tick);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((stream) => {
      streamRef.current = stream;
      video.srcObject = stream;
      video.play().then(() => { tick(); });
    }).catch(() => {
      setShowScanner(false);
    });

    return () => {
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [showScanner]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowNameEditInMenu(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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

  useEffect(() => {
    if (!showDrawModal) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = 320;
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    drawLastRef.current = null;
    drawActiveRef.current = false;
  }, [showDrawModal]);

  const applyImageEdit = useCallback(() => {
    const i = editImageIndex;
    if (i == null || !logImagePreviews[i]) return;
    const url = logImagePreviews[i];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      if (editImageFilter === 'grayscale') ctx.filter = 'grayscale(100%)';
      else if (editImageFilter === 'sepia') ctx.filter = 'sepia(100%)';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
      if (editImageTag.trim()) {
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        const text = editImageTag.trim();
        const x = c.width / 2;
        const y = c.height - 16;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
      c.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], logImageFiles[i]?.name || 'edited.png', { type: 'image/png' });
        const newUrl = URL.createObjectURL(file);
        const oldUrl = logImagePreviews[i];
        URL.revokeObjectURL(oldUrl);
        logPreviewUrlsRef.current = logPreviewUrlsRef.current.filter((u) => u !== oldUrl);
        logPreviewUrlsRef.current.push(newUrl);
        setLogImageFiles((prev) => prev.map((f, j) => (j === i ? file : f)));
        setLogImagePreviews((prev) => prev.map((u, j) => (j === i ? newUrl : u)));
        setEditImageIndex(null);
        setEditImageTag('');
      }, 'image/png');
    };
    img.onerror = () => setEditImageIndex(null);
    img.src = url;
  }, [editImageIndex, editImageFilter, editImageTag, logImagePreviews, logImageFiles]);

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

  useEffect(() => {
    if (!householdId || !user) return;

    const actorId = selectedMemberId === 'all' ? undefined : selectedMemberId === 'me' ? user.id : selectedMemberId;
    const placeSlugFilter = placeViewFilter === 'all' ? undefined : placeViewFilter;

    loadLogs(householdId, placeSlugFilter, actorId);
  }, [householdId, placeViewFilter, selectedMemberId, user, loadLogs]);

  const handleMediaSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, _fromCamera: boolean) => {
      const fileList = e.target.files;
      if (!fileList?.length || imageCompressing) return;
      const files = Array.from(fileList);
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      const videoFiles = files.filter((f) => f.type.startsWith('video/'));
      const videoFile = videoFiles[0] ?? null;

      if (videoFile) {
        if (videoFile.size > VIDEO_MAX_MB * 1024 * 1024) {
          setStatus(`영상은 ${VIDEO_MAX_MB}MB 이하로 선택해 주세요.`);
        } else {
          if (logVideoPreviewUrlRef.current) {
            URL.revokeObjectURL(logVideoPreviewUrlRef.current);
            logVideoPreviewUrlRef.current = null;
          }
          const url = URL.createObjectURL(videoFile);
          logVideoPreviewUrlRef.current = url;
          setLogVideoFile(videoFile);
          setLogVideoPreview(url);
        }
      }

      if (imageFiles.length === 0) {
        e.target.value = '';
        if (videoFile) setStatus('영상이 준비되었습니다. 로그 남기기를 누르면 올라갑니다.');
        return;
      }

      setImageCompressing(true);
      setStatus(null);
      Promise.all(imageFiles.map((f) => compressImageFile(f)))
        .then((results) => {
          const newFiles = results.map((r) => r.file);
          const newUrls = results.map((r) => r.previewUrl);
          newUrls.forEach((u) => logPreviewUrlsRef.current.push(u));
          setLogImageFiles((prev) => [...prev, ...newFiles]);
          setLogImagePreviews((prev) => [...prev, ...newUrls]);
          setStatus(
            `사진 ${newFiles.length}장${videoFile ? '·영상 1개 ' : ''}준비됐어요. 로그 남기기를 누르면 올라갑니다.`
          );
        })
        .catch(() => setStatus('사진 처리에 실패했어요. 다시 선택해 주세요.'))
        .finally(() => {
          setImageCompressing(false);
        });
      e.target.value = '';
    },
    [imageCompressing]
  );

  const handleInsert = async () => {
    if (!user || !householdId) return;

    setLoading(true);
    setStatus(null);

    const imageUrls: string[] = [];
    for (let i = 0; i < logImageFiles.length; i++) {
      const file = logImageFiles[i];
      const path = `${householdId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 10)}.jpg`;
      const { error: uploadError } = await supabase.storage.from('log-images').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) {
        setStatus(`사진 업로드 실패: ${uploadError.message}`);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('log-images').getPublicUrl(path);
      imageUrls.push(urlData.publicUrl);
    }

    let videoUrl: string | null = null;
    if (logVideoFile) {
      const ext = logVideoFile.name.split('.').pop() || 'mp4';
      const path = `${householdId}/v/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('log-images').upload(path, logVideoFile, {
        contentType: logVideoFile.type,
        upsert: false,
      });
      if (uploadError) {
        setStatus(`영상 업로드 실패: ${uploadError.message}`);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('log-images').getPublicUrl(path);
      videoUrl = urlData.publicUrl;
    }

    const payload: Record<string, unknown> = {
      household_id: householdId,
      place_slug: placeSlug,
      action: action || 'clicked',
      actor_user_id: user.id,
    };
    if (imageUrls.length > 0) {
      payload.image_url = imageUrls[0];
      payload.image_urls = JSON.stringify(imageUrls);
    }
    if (videoUrl) payload.video_url = videoUrl;

    let { error } = await supabase.from('logs').insert(payload);
    // DB에 image_urls 컬럼이 없을 때: image_url만 넣고 재시도
    if (error && imageUrls.length > 0 && /image_urls|schema\s*cache|column/i.test(error.message)) {
      const fallback = { ...payload };
      delete fallback.image_urls;
      (fallback as Record<string, unknown>).image_url = imageUrls[0];
      const res = await supabase.from('logs').insert(fallback);
      error = res.error;
    }
    if (error) {
      setStatus(`logs insert 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setAction('');
    logPreviewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    logPreviewUrlsRef.current = [];
    if (logVideoPreviewUrlRef.current) {
      URL.revokeObjectURL(logVideoPreviewUrlRef.current);
      logVideoPreviewUrlRef.current = null;
    }
    setLogImageFiles([]);
    setLogImagePreviews([]);
    setLogVideoFile(null);
    setLogVideoPreview(null);
    const placeSlugFilter = placeViewFilter === 'all' ? undefined : placeViewFilter;
    const actorId = selectedMemberId === 'all' ? undefined : selectedMemberId === 'me' ? user.id : selectedMemberId;
    await loadLogs(householdId, placeSlugFilter, actorId);
    setStatus('로그가 추가되었습니다.');
    setLoading(false);
    router.replace(pathname || '/');
  };

  const refreshLogs = useCallback(() => {
    if (!householdId || !user) return;
    const placeSlugFilter = placeViewFilter === 'all' ? undefined : placeViewFilter;
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
    setShowNameEditInMenu(false);
  };

  const handleProfileAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !user || !householdId || !file.type.startsWith('image/')) return;
      setProfileAvatarUploading(true);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${householdId}/${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (uploadError) {
        setStatus(`프로필 사진 업로드 실패: ${uploadError.message}`);
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
        setStatus(`프로필 저장 실패: ${updateError.message}`);
        setProfileAvatarUploading(false);
        return;
      }
      setProfileAvatarUrl(publicUrl);
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
  const getPlaceLabelKey = (slug: string) =>
    slug === 'fridge' ? 'fridge' : slug === 'table' ? 'table' : slug === 'toilet' ? 'toilet' : 'allPlaces';
  const currentPlaceLabel = t(getPlaceLabelKey(placeSlug));

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

  const logsForCalendar =
    calendarPlaceFilter === 'all' ? logs : logs.filter((l) => l.place_slug === calendarPlaceFilter);
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

  const langShort: Record<Lang, string> = { ko: '한국어', en: 'EN', ja: '日本語', zh: '中文', vi: 'VI' };
  const langFlags: Record<Lang, string> = { ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵', zh: '🇨🇳', vi: '🇻🇳' };
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!langMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [langMenuOpen]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '12px 12px 80px',
        background: highContrast ? '#0f0f0f' : 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
        color: highContrast ? '#ffffff' : '#0f172a',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        ...(fontScale > 1 && { zoom: fontScale, minWidth: 0 } as React.CSSProperties),
      }}
      data-accessibility-root
      data-high-contrast={highContrast ? 'true' : 'false'}
      data-font-scale={String(fontScale)}
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
        [data-accessibility-root] *:focus { outline: 3px solid #ffc107 !important; outline-offset: 2px; }
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
          maxWidth: '100%',
          flex: 1,
          background: highContrast ? '#0f0f0f' : '#fff',
          borderRadius: 20,
          padding: 16,
          boxShadow: highContrast ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          color: highContrast ? '#ffffff' : undefined,
          border: highContrast ? '2px solid #ffc107' : undefined,
        }}
      >
        <header style={{ marginBottom: 16, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <h1
              id="app-title"
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: highContrast ? '#ffffff' : '#0f172a',
                flex: 1,
                minWidth: 0,
              }}
            >
              {t('appTitle')}
            </h1>
            <div ref={langMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setLangMenuOpen((o) => !o)}
                aria-label={t('language')}
                aria-haspopup="listbox"
                aria-expanded={langMenuOpen}
                style={{
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 12,
                  border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
                  background: highContrast ? '#1e1e1e' : '#f8fafc',
                  color: highContrast ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span aria-hidden>{langFlags[language]}</span>
                <span>{langShort[language]}</span>
              </button>
              {langMenuOpen && (
                <div
                  role="listbox"
                  aria-label={t('language')}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    minWidth: 140,
                    padding: '8px 0',
                    borderRadius: 12,
                    background: highContrast ? '#1e1e1e' : '#fff',
                    border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    zIndex: 55,
                  }}
                >
                  {(Object.keys(langLabels) as Lang[]).map((lang) => (
                    <button
                      key={lang}
                      role="option"
                      aria-selected={language === lang}
                      type="button"
                      onClick={() => { setLanguage(lang); setLangMenuOpen(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 14px',
                        border: 'none',
                        background: language === lang ? (highContrast ? '#333' : '#f1f5f9') : 'transparent',
                        color: highContrast ? '#ffffff' : '#0f172a',
                        fontSize: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {langLabels[lang]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {user && (
              <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label={t('menu')}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
                    background: highContrast ? '#1e1e1e' : '#f8fafc',
                    color: highContrast ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ☰
                </button>
                {menuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 8,
                      minWidth: 180,
                      padding: '12px 0',
                      borderRadius: 16,
                      background: highContrast ? '#1e1e1e' : '#fff',
                      border: highContrast ? '2px solid #ffc107' : undefined,
                      boxShadow: highContrast ? 'none' : '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px #e2e8f0',
                      zIndex: 50,
                    }}
                  >
                    {!showNameEditInMenu ? (
                      <>
                        <Link
                          href="/qr"
                          onClick={() => setMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '12px 16px',
                            color: highContrast ? '#ffc107' : '#0f172a',
                            textDecoration: highContrast ? 'underline' : 'none',
                            fontSize: 14,
                          }}
                        >
                          {t('qrCode')}
                        </Link>
                        <Link
                          href="/invite"
                          onClick={() => setMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '12px 16px',
                            color: highContrast ? '#ffc107' : '#0f172a',
                            textDecoration: highContrast ? 'underline' : 'none',
                            fontSize: 14,
                          }}
                        >
                          {t('inviteFamily')}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setShowNameEditInMenu(true)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            color: highContrast ? '#ffffff' : '#0f172a',
                            fontSize: 14,
                            cursor: 'pointer',
                          }}
                        >
                          {t('editName')}
                        </button>
                        <input
                          ref={profileAvatarInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleProfileAvatarChange}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => { profileAvatarInputRef.current?.click(); setMenuOpen(false); }}
                          disabled={profileAvatarUploading}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            color: highContrast ? '#ffffff' : '#0f172a',
                            fontSize: 14,
                            cursor: profileAvatarUploading ? 'wait' : 'pointer',
                          }}
                        >
                          📷 {profileAvatarUploading ? '업로드 중...' : '프로필 사진 변경'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); setShowAccessibilityModal(true); }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            color: highContrast ? '#ffffff' : '#0f172a',
                            fontSize: 14,
                            cursor: 'pointer',
                          }}
                          aria-label={t('accessibility')}
                        >
                          ♿ {t('accessibility')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); setShowMemoPanel(true); }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            color: highContrast ? '#ffffff' : '#0f172a',
                            fontSize: 14,
                            cursor: 'pointer',
                          }}
                        >
                          📝 메모
                        </button>
                        <div style={{ padding: '8px 16px', fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b', borderTop: '1px solid #e2e8f0', marginTop: 4 }}>
                          장소 추가/삭제 (master 전용) — 다음 업데이트 예정
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '0 16px 12px' }}>
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
                            marginBottom: 8,
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleProfileSave}
                          disabled={profileSaving}
                          style={{
                            width: '100%',
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
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {user && householdId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedMemberId('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: selectedMemberId === 'all' ? '2px solid #64748b' : '1px solid #e2e8f0',
                  background: selectedMemberId === 'all' ? 'rgba(100,116,139,0.2)' : '#f8fafc',
                  color: selectedMemberId === 'all' ? '#475569' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 14 }}>👥</span>
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('allMembers')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMemberId('me')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: selectedMemberId === 'me' ? '2px solid #818cf8' : '1px solid #e2e8f0',
                  background: selectedMemberId === 'me' ? 'rgba(129,140,248,0.2)' : '#f8fafc',
                  color: selectedMemberId === 'me' ? '#4338ca' : '#475569',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: profileAvatarUrl ? 'transparent' : 'linear-gradient(135deg, #818cf8, #6366f1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 18,
                    color: profileAvatarUrl ? undefined : '#fff',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (meDisplayName || t('me')).slice(0, 1).toUpperCase()
                  )}
                </span>
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meDisplayName}
                </span>
              </button>
              {members
                .filter((m) => m.user_id !== user.id)
                .map((m) => {
                  const name = (m.display_name && m.display_name.trim()) || m.user_id.slice(0, 6);
                  const active = selectedMemberId === m.user_id;
                  const avatarUrl = m.avatar_url ?? null;
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => setSelectedMemberId(m.user_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: active ? '2px solid #38bdf8' : '1px solid #e2e8f0',
                        background: active ? 'rgba(56,189,248,0.2)' : '#f8fafc',
                        color: active ? '#0369a1' : '#475569',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: avatarUrl ? 'transparent' : (active ? 'rgba(56,189,248,0.35)' : '#e2e8f0'),
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 12,
                          color: avatarUrl ? undefined : (active ? '#0369a1' : '#64748b'),
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          name.slice(0, 1)
                        )}
                      </span>
                      <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </header>

        {status && (
          <div
            style={{
              marginBottom: 16,
              fontSize: 13,
              padding: '8px 10px',
              borderRadius: 8,
              color: status.includes('실패') || status.includes('필요') ? '#b91c1c' : '#166534',
              background:
                status.includes('실패') || status.includes('필요')
                  ? 'rgba(248,113,113,0.15)'
                  : 'rgba(34,197,94,0.12)',
              border:
                status.includes('실패') || status.includes('필요')
                  ? '1px solid rgba(248,113,113,0.6)'
                  : '1px solid rgba(34,197,94,0.6)',
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
            {hasPlaceFromUrl ? (
              <section
                style={{
                  marginBottom: 20,
                  padding: 16,
                  borderRadius: 16,
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: '0.05em', color: highContrast ? '#ffffff' : '#64748b', marginBottom: 8 }}>
                  {t('recordHere')}
                </div>
                <p style={{ fontSize: 12, color: highContrast ? '#ffffff' : '#475569', marginBottom: 10 }}>
                  {t('currentPlace')}: <strong style={{ color: highContrast ? '#ffffff' : '#0f172a' }}>{currentPlaceLabel}</strong> ({t('qrAccessed')})
                </p>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, letterSpacing: '0.03em', color: highContrast ? '#ffffff' : '#64748b' }}>{t('quickPhrases')}</span>
                    <button
                      type="button"
                      onClick={() => setShowPhraseManager(true)}
                      aria-label={quickPhrases.length > 0 ? t('manage') : t('add')}
                      style={{
                        fontSize: 12,
                        color: highContrast ? '#ffc107' : '#3b82f6',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                    >
                      {quickPhrases.length > 0 ? t('manage') : t('add')}
                    </button>
                  </div>
                  {quickPhrases.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {quickPhrases.map((phrase, i) => (
                        <button
                          key={`${i}-${phrase}`}
                          type="button"
                          onClick={() => setAction((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 999,
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            color: '#475569',
                            fontSize: 13,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <textarea
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder={t('logPlaceholder')}
                  aria-label={t('logPlaceholder')}
                  rows={2}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'none',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    padding: 12,
                    fontSize: 14,
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none',
                    marginBottom: 10,
                  }}
                />

                <div style={{ marginBottom: 12 }}>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    id="log-camera-input"
                    style={{ display: 'none' }}
                    multiple
                    onChange={(e) => handleMediaSelect(e, true)}
                  />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    id="log-gallery-input"
                    style={{ display: 'none' }}
                    multiple
                    onChange={(e) => handleMediaSelect(e, false)}
                  />
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <label
                      htmlFor={imageCompressing ? undefined : 'log-camera-input'}
                      aria-label={t('takePhoto')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: imageCompressing ? '#e2e8f0' : '#f8fafc',
                        color: imageCompressing ? '#94a3b8' : '#475569',
                        fontSize: 14,
                        cursor: imageCompressing ? 'wait' : 'pointer',
                        pointerEvents: imageCompressing ? 'none' : 'auto',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>📷</span>
                      촬영
                    </label>
                    <label
                      htmlFor={imageCompressing ? undefined : 'log-gallery-input'}
                      aria-label={t('fromAlbum')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: imageCompressing ? '#e2e8f0' : '#f8fafc',
                        color: imageCompressing ? '#94a3b8' : '#475569',
                        fontSize: 14,
                        cursor: imageCompressing ? 'wait' : 'pointer',
                        pointerEvents: imageCompressing ? 'none' : 'auto',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>🖼️</span>
                      {t('fromAlbum')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDrawModal(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#475569',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>✏️</span>
                      그리기
                    </button>
                  </div>
                  {(logImagePreviews.length > 0 || logVideoPreview) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                      {logImagePreviews.map((url, i) => (
                        <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={url}
                            alt="미리보기"
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 10,
                              border: '1px solid #e2e8f0',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditImageIndex(i);
                              setEditImageTag('');
                              setEditImageFilter('none');
                            }}
                            aria-label="꾸미기"
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              padding: '2px 6px',
                              borderRadius: 6,
                              border: 'none',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              fontSize: 10,
                              cursor: 'pointer',
                            }}
                          >
                            꾸미기
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(url);
                              logPreviewUrlsRef.current = logPreviewUrlsRef.current.filter((u) => u !== url);
                              setLogImageFiles((prev) => prev.filter((_, j) => j !== i));
                              setLogImagePreviews((prev) => prev.filter((_, j) => j !== i));
                            }}
                            aria-label="제거"
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              border: 'none',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              fontSize: 14,
                              lineHeight: 1,
                              cursor: 'pointer',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {logVideoPreview && (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <video
                            src={logVideoPreview}
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 10,
                              border: '1px solid #e2e8f0',
                            }}
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (logVideoPreviewUrlRef.current) {
                                URL.revokeObjectURL(logVideoPreviewUrlRef.current);
                                logVideoPreviewUrlRef.current = null;
                              }
                              setLogVideoFile(null);
                              setLogVideoPreview(null);
                            }}
                            aria-label="영상 제거"
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              border: 'none',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              fontSize: 14,
                              lineHeight: 1,
                              cursor: 'pointer',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {imageCompressing && (
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b' }}>사진 처리 중...</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleInsert}
                  disabled={loading}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    padding: '14px 16px',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading
                      ? 'rgba(100,116,139,0.5)'
                      : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: '#fff',
                    minHeight: 48,
                    boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                  }}
                >
                  {loading ? t('savingLog') : `"${currentPlaceLabel}" ${t('addLog')}`}
                </button>
              </section>
            ) : activeTab === 'home' ? (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: highContrast ? '#e0e0e0' : '#64748b', textAlign: 'center' }}>
                👇 아래 QR 탭에서 스캔 후 로그를 남기세요
              </p>
            ) : null}
            {activeTab === 'qr' && !hasPlaceFromUrl && (
              <section
                style={{
                  marginBottom: 20,
                  padding: '20px 16px',
                  borderRadius: 16,
                  background: highContrast ? '#1e1e1e' : '#f8fafc',
                  border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
                  color: highContrast ? '#ffffff' : '#475569',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: '0 0 16px', fontSize: 14 }}>{t('scanQrFirst')} {t('scanQrSecond')}</p>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  aria-label={t('qrScan')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background: highContrast ? '#ffc107' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    color: highContrast ? '#0f0f0f' : '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 20 }}>📷</span>
                  {t('qrScan')}
                </button>
                <p style={{ margin: '12px 0 0', fontSize: 12, color: highContrast ? '#e0e0e0' : '#64748b' }}>{t('scanHint1')} {t('scanHint2')}</p>
              </section>
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
                    ‹
                  </button>
                  <div style={{ fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>
                    📅 {calYear}년 {calMonth}월
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
                    ›
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {[
                    { key: 'fridge' as const, labelKey: 'fridge' as const },
                    { key: 'table' as const, labelKey: 'table' as const },
                    { key: 'toilet' as const, labelKey: 'toilet' as const },
                    { key: 'all' as const, labelKey: 'allPlaces' as const },
                  ].map(({ key, labelKey }) => {
                    const active = calendarPlaceFilter === key;
                    const chipStyle = key === 'fridge' ? { bg: 'rgba(56,189,248,0.2)', border: 'rgba(56,189,248,0.6)', color: '#0369a1' } :
                      key === 'table' ? { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.6)', color: '#166534' } :
                      key === 'toilet' ? { bg: 'rgba(251,191,36,0.25)', border: 'rgba(251,191,36,0.6)', color: '#a16207' } :
                      { bg: '#f1f5f9', border: '#cbd5e1', color: '#475569' };
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCalendarPlaceFilter(key)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 10,
                          border: active ? `2px solid ${chipStyle.border}` : '1px solid #e2e8f0',
                          background: active ? chipStyle.bg : highContrast ? '#1e1e1e' : '#f8fafc',
                          color: active ? chipStyle.color : highContrast ? '#94a3b8' : '#64748b',
                          fontSize: 12,
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
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                    background: highContrast ? '#1e1e1e' : '#f8fafc',
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
                          minHeight: 40,
                          padding: 4,
                          border: 'none',
                          borderRadius: 8,
                          background: selected ? (highContrast ? 'rgba(255,193,7,0.3)' : 'rgba(59,130,246,0.2)') :
                            !isInMonth ? 'transparent' : highContrast ? '#2a2a2a' : '#fff',
                          color: !isInMonth ? (highContrast ? '#555' : '#cbd5e1') : selected ? (highContrast ? '#ffc107' : '#1d4ed8') : highContrast ? '#fff' : '#0f172a',
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
                        {isInMonth ? dayNum : ''}
                        {count > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              marginTop: 2,
                              color: highContrast ? '#ffc107' : '#64748b',
                            }}
                          >
                            {count}건
                          </span>
                        )}
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
                      <span>
                        📅 {selectedCalendarDate.replace(/-/g, '.')} 상세
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
                              style={{
                                padding: '12px 14px',
                                borderRadius: 12,
                                border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                                background: highContrast ? '#2a2a2a' : '#fff',
                                marginBottom: 10,
                                fontSize: 14,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, ...getPlaceChipStyle(log.place_slug) }}>
                                  {t(getPlaceLabelKey(log.place_slug))}
                                </span>
                                <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b' }}>{formatDateTime(log.created_at)}</span>
                              </div>
                              <div style={{ fontWeight: 600, color: highContrast ? '#fff' : '#0f172a', marginBottom: 6 }}>{log.action}</div>
                              {(() => {
                                const { imageUrls, videoUrl } = getLogMedia(log);
                                if (imageUrls.length === 0 && !videoUrl) return null;
                                return (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: '100%' }}>
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
                              <div style={{ fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b', marginTop: 6 }}>{getMemberName(log.actor_user_id)}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {(activeTab === 'home' || activeTab === 'search') && (
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
                    border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
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
                  { key: 'fridge' as const, labelKey: 'fridge' as const, bg: 'rgba(56,189,248,0.2)', border: 'rgba(56,189,248,0.6)', color: '#0369a1' },
                  { key: 'table' as const, labelKey: 'table' as const, bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.6)', color: '#166534' },
                  { key: 'toilet' as const, labelKey: 'toilet' as const, bg: 'rgba(251,191,36,0.25)', border: 'rgba(251,191,36,0.6)', color: '#a16207' },
                  { key: 'all' as const, labelKey: 'allPlaces' as const, bg: '#f1f5f9', border: '#cbd5e1', color: '#475569' },
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
                  maxHeight: '50vh',
                  overflowY: 'auto',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  background: highContrast ? '#1e1e1e' : '#f8fafc',
                  padding: 12,
                }}
              >
                {logs.length === 0 && (
                  <div
                    style={{
                      padding: 24,
                      fontSize: 13,
                      color: highContrast ? '#94a3b8' : '#64748b',
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
                        fontSize: 13,
                        fontWeight: 700,
                        color: highContrast ? '#ffc107' : '#0f172a',
                        marginBottom: 10,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: highContrast ? 'rgba(255,193,7,0.15)' : '#e2e8f0',
                        borderLeft: highContrast ? '4px solid #ffc107' : '4px solid #64748b',
                      }}
                    >
                      📅 {group.dateLabel} · {group.items.length}건
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
                            padding: '14px 16px',
                            borderRadius: 12,
                            border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                            background: highContrast ? '#1e1e1e' : '#fff',
                            marginBottom: 10,
                            fontSize: 14,
                            cursor: isMine ? 'pointer' : 'default',
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
                                  onClick={() => handleUpdateLog(log.id, editingAction)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#22c55e',
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
                                  onClick={() => { setEditingLogId(null); setEditingAction(''); }}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: '5px 12px',
                                    borderRadius: 999,
                                    ...getPlaceChipStyle(log.place_slug),
                                  }}
                                >
                                  {t(getPlaceLabelKey(log.place_slug))}
                                </span>
                                <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b' }}>
                                  {formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <div style={{ fontWeight: 600, color: highContrast ? '#fff' : '#0f172a', marginBottom: 6, fontSize: 15 }}>
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
                              <div style={{ marginTop: 6 }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: highContrast ? '#94a3b8' : '#64748b',
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    background: highContrast ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                  }}
                                >
                                  👤 {getMemberName(log.actor_user_id)}
                                </span>
                              </div>
                              {isMine && (
                                <div style={{ marginTop: 6, fontSize: 11, color: highContrast ? '#ffffff' : '#94a3b8' }}>
                                  {t('longPressEdit')}
                                </div>
                              )}
                              {/* 댓글 · 답글 (인스타 스타일) */}
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: highContrast ? '1px solid rgba(255,193,7,0.3)' : '1px solid #e2e8f0' }}>
                                {(() => {
                                  const list = commentsByLogId[log.id] ?? [];
                                  const topLevel = list.filter((c) => !c.parent_id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                  const getReplies = (parentId: string) =>
                                    list.filter((c) => c.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
                                                <div key={r.id} style={{ marginLeft: 16, marginTop: 6, paddingLeft: 10, borderLeft: highContrast ? '2px solid rgba(255,193,7,0.4)' : '2px solid #e2e8f0' }}>
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
                                                  {/* 답글의 답글 (3단계) */}
                                                  {getReplies(r.id).map((r2) => (
                                                    <div key={r2.id} style={{ marginLeft: 12, marginTop: 6, paddingLeft: 8, borderLeft: highContrast ? '2px solid rgba(255,193,7,0.25)' : '2px solid #e2e8f0' }}>
                                                      <span style={{ fontWeight: 600, fontSize: 12, color: highContrast ? '#ffc107' : '#0f172a' }}>{getMemberName(r2.user_id)}</span>
                                                      <span style={{ fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b', marginLeft: 6 }}>{formatDateTime(r2.created_at)}</span>
                                                      <div style={{ fontSize: 12, color: highContrast ? '#e2e8f0' : '#334155', marginTop: 2 }}>{r2.content}</div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ))}
                                              {replyingToThis && replyingTo?.commentId === c.id && user && (
                                                <div style={{ marginLeft: 16, marginTop: 8 }}>
                                                  <input
                                                    type="text"
                                                    placeholder="답글 입력..."
                                                    value={(replyingTo?.logId === log.id && replyingTo?.commentId === c.id ? commentDraft[`${log.id}_reply_${c.id}`] : undefined) ?? ''}
                                                    onChange={(e) =>
                                                      setCommentDraft((prev) => ({ ...prev, [`${log.id}_reply_${c.id}`]: e.target.value }))
                                                    }
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
            )}
          </>
        )}
      </div>

      {user && (
        <nav
          role="navigation"
          aria-label="하단 메뉴"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            background: highContrast ? '#1e1e1e' : '#fff',
            borderTop: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '8px 0',
            zIndex: 40,
          }}
        >
          {[
            { id: 'home' as TabId, label: '홈', icon: '🏠' },
            { id: 'calendar' as TabId, label: '캘린더', icon: '📅' },
            { id: 'qr' as TabId, label: 'QR', icon: '📷' },
            { id: 'search' as TabId, label: '검색', icon: '🔍' },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === id ? (highContrast ? '#ffc107' : '#2563eb') : (highContrast ? '#94a3b8' : '#64748b'),
                fontSize: 11,
                fontWeight: activeTab === id ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      )}

      {editImageIndex != null && logImagePreviews[editImageIndex] && (
        <>
          <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 58 }} onClick={() => setEditImageIndex(null)} />
          <div
            role="dialog"
            aria-label="사진 꾸미기"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(380px, 94vw)',
              padding: 16,
              borderRadius: 16,
              background: highContrast ? '#1e1e1e' : '#fff',
              border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              zIndex: 59,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>🖼️ 꾸미기 · 이름표</h3>
              <button type="button" onClick={() => setEditImageIndex(null)} aria-label="닫기" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <img
              src={logImagePreviews[editImageIndex]}
              alt="미리보기"
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                ...(editImageFilter === 'grayscale' && { filter: 'grayscale(100%)' }),
                ...(editImageFilter === 'sepia' && { filter: 'sepia(100%)' }),
              }}
            />
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b', marginBottom: 6 }}>필터</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['none', 'grayscale', 'sepia'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEditImageFilter(f)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: editImageFilter === f ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      background: editImageFilter === f ? 'rgba(59,130,246,0.15)' : '#f8fafc',
                      color: editImageFilter === f ? '#1d4ed8' : '#64748b',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {f === 'none' ? '원본' : f === 'grayscale' ? '흑백' : '세피아'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b', marginBottom: 6 }}>이름표 (사진 하단에 표시)</div>
              <input
                type="text"
                value={editImageTag}
                onChange={(e) => setEditImageTag(e.target.value)}
                placeholder="예: 엄마, 아빠, 우리집"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: highContrast ? '#0f0f0f' : '#f8fafc',
                  color: highContrast ? '#fff' : '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setEditImageIndex(null)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 13, cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={applyImageEdit} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>적용</button>
            </div>
          </div>
        </>
      )}

      {showDrawModal && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 58 }}
            onClick={() => setShowDrawModal(false)}
          />
          <div
            role="dialog"
            aria-label="그리기"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(360px, 92vw)',
              padding: 16,
              borderRadius: 16,
              background: highContrast ? '#1e1e1e' : '#fff',
              border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              zIndex: 59,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>✏️ 그리기</h3>
              <button type="button" onClick={() => setShowDrawModal(false)} aria-label="닫기" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b' }}>손가락이나 마우스로 그려 보세요.</p>
            <canvas
              ref={drawCanvasRef}
              style={{
                display: 'block',
                width: 320,
                maxWidth: '100%',
                height: 280,
                borderRadius: 12,
                border: '2px solid #e2e8f0',
                background: '#fff',
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                const canvas = drawCanvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 320;
                const y = ((e.clientY - rect.top) / rect.height) * 280;
                drawLastRef.current = { x, y };
                drawActiveRef.current = true;
              }}
              onPointerMove={(e) => {
                if (!drawActiveRef.current) return;
                const canvas = drawCanvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 320;
                const y = ((e.clientY - rect.top) / rect.height) * 280;
                const ctx = canvas.getContext('2d');
                const last = drawLastRef.current;
                if (ctx && last) {
                  ctx.beginPath();
                  ctx.moveTo(last.x, last.y);
                  ctx.lineTo(x, y);
                  ctx.stroke();
                }
                drawLastRef.current = { x, y };
              }}
              onPointerUp={() => { drawActiveRef.current = false; drawLastRef.current = null; }}
              onPointerLeave={() => { drawActiveRef.current = false; drawLastRef.current = null; }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  const canvas = drawCanvasRef.current;
                  const ctx = canvas?.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 320, 280);
                    ctx.strokeStyle = '#000000';
                  }
                }}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 13, cursor: 'pointer' }}
              >
                지우기
              </button>
              <button
                type="button"
                onClick={() => {
                  const canvas = drawCanvasRef.current;
                  if (!canvas) return;
                  canvas.toBlob((blob) => {
                    if (!blob) return;
                    const file = new File([blob], 'drawing.png', { type: 'image/png' });
                    const url = URL.createObjectURL(file);
                    logPreviewUrlsRef.current.push(url);
                    setLogImageFiles((prev) => [...prev, file]);
                    setLogImagePreviews((prev) => [...prev, url]);
                    setShowDrawModal(false);
                  }, 'image/png');
                }}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                완료 (로그에 추가)
              </button>
            </div>
          </div>
        </>
      )}

      {showMemoPanel && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 58 }}
            onClick={() => setShowMemoPanel(false)}
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
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a' }}>📝 메모</h3>
              <button
                type="button"
                onClick={() => setShowMemoPanel(false)}
                aria-label="닫기"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: 'none',
                  background: highContrast ? '#333' : '#f1f5f9',
                  color: highContrast ? '#fff' : '#64748b',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
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
            <p style={{ margin: '8px 0 0', fontSize: 11, color: highContrast ? '#94a3b8' : '#64748b' }}>우→좌 스와이프로 열 수 있어요. 자동 저장됩니다.</p>
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

      {showScanner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ fontSize: 16, color: '#fff', marginBottom: 12 }}>{t('qrScanTitle')}</div>
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: 16,
              overflow: 'hidden',
              border: '3px solid #fff',
              background: '#000',
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <button
            type="button"
            onClick={() => setShowScanner(false)}
            style={{
              marginTop: 20,
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: '#64748b',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('close')}
          </button>
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
                      setEditingLogId(log.id);
                      setEditingAction(log.action);
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

      {showPhraseManager && (
        <div
          role="presentation"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setShowPhraseManager(false); setNewPhraseInput(''); }}
        >
          <div
            role="dialog"
            style={{
              width: '100%',
              maxWidth: 360,
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 24,
              borderRadius: 20,
              background: '#fff',
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              {t('phraseManageTitle')}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              {t('phraseManageHint')}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', maxHeight: 200, overflowY: 'auto' }}>
              {quickPhrases.map((phrase, i) => (
                <li
                  key={`${i}-${phrase}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    marginBottom: 8,
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: 14, color: '#0f172a' }}>{phrase}</span>
                  <button
                    type="button"
                    onClick={() => saveQuickPhrases(quickPhrases.filter((_, j) => j !== i))}
                    aria-label={t('delete')}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: '#94a3b8',
                      fontSize: 18,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={newPhraseInput}
                onChange={(e) => setNewPhraseInput(e.target.value)}
                placeholder={t('phrasePlaceholder')}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const t = newPhraseInput.trim();
                    if (t) { saveQuickPhrases([...quickPhrases, t]); setNewPhraseInput(''); }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = newPhraseInput.trim();
                  if (t) { saveQuickPhrases([...quickPhrases, t]); setNewPhraseInput(''); }
                }}
                style={{
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('add')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setShowPhraseManager(false); setNewPhraseInput(''); }}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 20,
                padding: 12,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#475569',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t('close')}
            </button>
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
            <h2 id="accessibility-title" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              ♿ {t('accessibility')}
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
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t('bigFont')}</p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>{t('bigFontHint')}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {FONT_SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFontScale(s)}
                    aria-pressed={fontScale === s}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: fontScale === s ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: fontScale === s ? '#eff6ff' : '#f8fafc',
                      color: '#0f172a',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {t(s === 1 ? 'font100' : s === 1.25 ? 'font125' : s === 1.5 ? 'font150' : 'font200')}
                  </button>
                ))}
              </div>
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
              onClick={() => setShowAccessibilityModal(false)}
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