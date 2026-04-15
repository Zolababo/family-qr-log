'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';
import { getT, type Lang } from '../translations';
import { Camera, Image as ImageIcon, X, ChevronLeft, MapPin, Mic } from 'lucide-react';
import { LOG_SLUG, TOPIC_SLUGS, normalizeLogSlug } from '../../lib/logTags';
import { composeActionWithMeta, parseLogMeta, type LogMeta } from '../../lib/logActionMeta';
import { compressImageFile, VIDEO_MAX_MB } from '../../lib/imageCompress';
import { convertHeicLikeToJpeg, isHeicOrHeif, MOBILE_IMAGE_EXTENSIONS } from '../../lib/heicToJpeg';
import { compressVideoForUpload } from '../../lib/videoCompress';

const QUICK_PHRASES_KEY = 'family_qr_log_quick_phrases';
const ACCESSIBILITY_KEY = 'family_qr_log_accessibility';
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
    const lang: Lang = ['ko', 'en', 'ja', 'zh'].includes(p.language as string) ? (p.language as Lang) : 'ko';
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

/** When the OS omits MIME type, still treat common extensions as video. */
const VIDEO_FILE_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'mkv', '3gp', 'ogv', 'avi'] as const;

const MEMBER_LIKE_TAGS: { value: string | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: LOG_SLUG.daily, label: '일상' },
  { value: LOG_SLUG.general, label: '다같이' },
  { value: TOPIC_SLUGS[0], label: '밤톨대디' },
  { value: TOPIC_SLUGS[1], label: '밤톨맘' },
  { value: TOPIC_SLUGS[2], label: '밤톨이' },
  { value: TOPIC_SLUGS[3], label: '엄니아부지' },
  { value: TOPIC_SLUGS[4], label: '마더리빠더리' },
  { value: LOG_SLUG.danine, label: '단이네' },
  { value: LOG_SLUG.uchacha, label: '우차차' },
  { value: LOG_SLUG.ttolMorning, label: '똘모닝' },
  { value: LOG_SLUG.notice, label: '공지사항' },
];

export default function WriteLogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [boot, setBoot] = useState<'loading' | 'needLogin' | 'ready'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [selectedLogTag, setSelectedLogTag] = useState<string | null>(null);
  const placePrefillAppliedRef = useRef(false);
  const hasUserSelectedTagRef = useRef(false);

  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [logImageFiles, setLogImageFiles] = useState<File[]>([]);
  const [logImagePreviews, setLogImagePreviews] = useState<string[]>([]);
  const [logVideoFile, setLogVideoFile] = useState<File | null>(null);
  const [logVideoPreview, setLogVideoPreview] = useState<string | null>(null);
  const logMediaPreviewCount = logImagePreviews.length + (logVideoPreview ? 1 : 0);
  const isSingleLogMediaPreview = logMediaPreviewCount === 1;
  const [imageCompressing, setImageCompressing] = useState(false);
  const [videoCompressing, setVideoCompressing] = useState(false);
  const [quickPhrases, setQuickPhrases] = useState<string[]>([]);
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [newPhraseInput, setNewPhraseInput] = useState('');

  const [highContrast, setHighContrast] = useState(false);
  const [fontScaleStep, setFontScaleStep] = useState<FontScaleStep>(1);
  const [fontBold, setFontBold] = useState(false);
  const [language, setLanguage] = useState<Lang>('ko');

  const [logLocationName, setLogLocationName] = useState('');
  const [logLocationUrl, setLogLocationUrl] = useState('');
  const [locationResults, setLocationResults] = useState<{ name: string; lat: string; lon: string }[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [showLocationTagEditor, setShowLocationTagEditor] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawLastRef = useRef<{ x: number; y: number } | null>(null);
  const drawActiveRef = useRef(false);
  const drawHistoryRef = useRef<ImageData[]>([]);
  const [editImageIndex, setEditImageIndex] = useState<number | null>(null);
  const [editImageTag, setEditImageTag] = useState('');
  const [editImageFilter, setEditImageFilter] = useState<'none' | 'grayscale' | 'sepia'>('none');
  const logPreviewUrlsRef = useRef<string[]>([]);
  const logVideoPreviewUrlRef = useRef<string | null>(null);
  /** Edit mode: preserve @@meta fields not edited on this screen (e.g. stickers on photos). */
  const editBaselineMetaRef = useRef<LogMeta>({});

  const fontScale = FONT_STEPS[fontScaleStep];
  const effectivePlaceSlug = selectedLogTag ?? LOG_SLUG.daily;
  const editingLogId = searchParams.get('edit');
  const isEditMode = !!editingLogId;

  useEffect(() => {
    const init = async () => {
      const {
        data: { user: u },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !u) {
        setBoot('needLogin');
        return;
      }
      setUser(u);
      const res = await supabase.from('members').select('household_id').eq('user_id', u.id).limit(1);
      const row = res.data?.[0];
      if (res.error || !row) {
        setStatus(res.error?.message ?? 'members');
        setBoot('ready');
        return;
      }
      setHouseholdId(row.household_id);
      setBoot('ready');
    };
    init();
  }, []);

  useEffect(() => {
    const a = loadAccessibility();
    setHighContrast(a.highContrast);
    setFontScaleStep(a.fontScaleStep);
    setFontBold(a.fontBold);
    setLanguage(a.language);
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
    if (!user || placePrefillAppliedRef.current) return;
    if (hasUserSelectedTagRef.current) return;
    const p = searchParams.get('place');
    const valid = new Set<string>(Object.values(LOG_SLUG));
    if (p && valid.has(p)) {
      setSelectedLogTag(p);
      placePrefillAppliedRef.current = true;
      router.replace(pathname || '/write', { scroll: false });
    }
  }, [user, searchParams, pathname, router]);

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
    drawHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    drawLastRef.current = null;
    drawActiveRef.current = false;
  }, [showDrawModal]);

  useEffect(() => {
    if (!user || !householdId || !editingLogId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('logs').select('*').eq('id', editingLogId).eq('household_id', householdId).maybeSingle();
      if (cancelled || error || !data) return;
      if (data.actor_user_id !== user.id) {
        setStatus('본인이 작성한 로그만 수정할 수 있어요.');
        return;
      }
      const parsed = parseLogMeta(data.action ?? '');
      editBaselineMetaRef.current = parsed.meta;
      setAction(parsed.text ?? '');
      setLogLocationName(parsed.meta.locationName ?? '');
      setLogLocationUrl(parsed.meta.locationUrl ?? '');
      setSelectedLogTag(normalizeLogSlug(data.place_slug));
      const imageUrls: string[] = [];
      if (data.image_urls) {
        try {
          const arr = JSON.parse(data.image_urls);
          if (Array.isArray(arr)) imageUrls.push(...arr.filter((x): x is string => typeof x === 'string'));
        } catch {}
      }
      if (imageUrls.length === 0 && data.image_url) imageUrls.push(data.image_url);
      setLogImagePreviews(imageUrls);
      setLogImageFiles([]);
      if (data.video_url) setLogVideoPreview(data.video_url);
      else setLogVideoPreview(null);
      setLogVideoFile(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, householdId, editingLogId]);

  const t = useMemo(() => getT(language), [language]);
  const mediaBusy = imageCompressing || videoCompressing;

  const saveQuickPhrases = useCallback((next: string[]) => {
    setQuickPhrases(next);
    try {
      localStorage.setItem(QUICK_PHRASES_KEY, JSON.stringify(next));
    } catch {}
  }, []);

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

  const handleMediaSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, _fromCamera: boolean) => {
      const fileList = e.target.files;
      if (!fileList?.length || imageCompressing || videoCompressing) return;
      const files = Array.from(fileList);
      const imageFiles = files.filter((f) => {
        if (f.type.startsWith('image/')) return true;
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return (MOBILE_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
      });
      const videoFiles = files.filter((f) => {
        if (f.type.startsWith('video/')) return true;
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext);
      });
      const videoFile = videoFiles[0] ?? null;

      if (videoFile) {
        if (videoFile.size > VIDEO_MAX_MB * 1024 * 1024) {
          setStatus(t('writeVideoTooLarge').replace('{max}', String(VIDEO_MAX_MB)));
        } else {
          setVideoCompressing(true);
          setStatus(null);
          if (logVideoPreviewUrlRef.current) {
            URL.revokeObjectURL(logVideoPreviewUrlRef.current);
            logVideoPreviewUrlRef.current = null;
          }
          void (async () => {
            try {
              const out = await compressVideoForUpload(videoFile);
              const url = URL.createObjectURL(out);
              logVideoPreviewUrlRef.current = url;
              setLogVideoFile(out);
              setLogVideoPreview(url);
            } catch {
              const url = URL.createObjectURL(videoFile);
              logVideoPreviewUrlRef.current = url;
              setLogVideoFile(videoFile);
              setLogVideoPreview(url);
            } finally {
              setVideoCompressing(false);
            }
          })();
        }
      }

      if (imageFiles.length === 0) {
        e.target.value = '';
        return;
      }

      setImageCompressing(true);
      setStatus(null);
      void (async () => {
        const results: { file: File; previewUrl: string }[] = [];
        let heicFail = false;
        for (const f of imageFiles) {
          try {
            let file = f;
            if (isHeicOrHeif(file)) {
              try {
                file = await convertHeicLikeToJpeg(file);
              } catch {
                heicFail = true;
                continue;
              }
            }
            const r = await compressImageFile(file).catch(() => ({
              file: f,
              previewUrl: URL.createObjectURL(f),
            }));
            results.push(r);
          } catch {
            heicFail = true;
          }
        }
        if (results.length) {
          const newFiles = results.map((r) => r.file);
          const newUrls = results.map((r) => r.previewUrl);
          newUrls.forEach((u) => logPreviewUrlsRef.current.push(u));
          setLogImageFiles((prev) => [...prev, ...newFiles]);
          setLogImagePreviews((prev) => [...prev, ...newUrls]);
        }
        if (heicFail) {
          setStatus('일부 HEIC/HEIF 사진 변환에 실패했습니다. JPEG/PNG로 올려 주세요.');
        }
        setImageCompressing(false);
        e.target.value = '';
      })();
    },
    [imageCompressing, videoCompressing, t]
  );

  const handleInsert = async () => {
    if (!user || !householdId) return;
    if (isEditMode && !editingLogId) return;

    setLoading(true);
    setStatus(null);

    const uploadedImageUrls: string[] = [];
    for (let i = 0; i < logImageFiles.length; i++) {
      const file = logImageFiles[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${householdId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 10)}.${ext === 'jpg' || ext === 'jpeg' ? 'jpg' : ext === 'png' ? 'png' : ext === 'gif' ? 'gif' : 'jpg'}`;
      const contentType = file.type?.startsWith('image/') ? file.type : 'image/jpeg';
      const { error: uploadError } = await supabase.storage.from('log-images').upload(path, file, {
        contentType,
        upsert: false,
      });
      if (uploadError) {
        setStatus(uploadError.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('log-images').getPublicUrl(path);
      uploadedImageUrls.push(urlData.publicUrl);
    }
    const retainedRemoteImageUrls = logImagePreviews.filter((u) => /^https?:\/\//i.test(u));
    const imageUrls = [...retainedRemoteImageUrls, ...uploadedImageUrls];

    let videoUrl: string | null = /^https?:\/\//i.test(logVideoPreview ?? '') ? (logVideoPreview as string) : null;
    if (logVideoFile) {
      const ext = logVideoFile.name.split('.').pop() || 'mp4';
      const path = `${householdId}/v/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('log-images').upload(path, logVideoFile, {
        contentType: logVideoFile.type,
        upsert: false,
      });
      if (uploadError) {
        setStatus(uploadError.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('log-images').getPublicUrl(path);
      videoUrl = urlData.publicUrl;
    }

    const meta: LogMeta = isEditMode
      ? {
          ...editBaselineMetaRef.current,
          locationName: logLocationName.trim() || undefined,
          locationUrl: logLocationUrl.trim() || undefined,
        }
      : {
          locationName: logLocationName.trim() || undefined,
          locationUrl: logLocationUrl.trim() || undefined,
        };

    const payload: Record<string, unknown> = {
      household_id: householdId,
      place_slug: effectivePlaceSlug,
      action: composeActionWithMeta(action || 'clicked', meta),
      actor_user_id: user.id,
      image_url: null,
      image_urls: null,
      video_url: null,
    };
    if (imageUrls.length > 0) {
      payload.image_url = imageUrls[0];
      payload.image_urls = JSON.stringify(imageUrls);
    }
    if (videoUrl) payload.video_url = videoUrl;

    let error: { message: string } | null = null;
    if (isEditMode && editingLogId) {
      const res = await supabase.from('logs').update(payload).eq('id', editingLogId).eq('actor_user_id', user.id);
      error = res.error;
    } else {
      const res = await supabase.from('logs').insert(payload);
      error = res.error;
    }
    if (error && imageUrls.length > 0 && /image_urls|schema\s*cache|column/i.test(error.message)) {
      const fallback = { ...payload };
      delete fallback.image_urls;
      (fallback as Record<string, unknown>).image_url = imageUrls[0];
      const res = isEditMode && editingLogId
        ? await supabase.from('logs').update(fallback).eq('id', editingLogId).eq('actor_user_id', user.id)
        : await supabase.from('logs').insert(fallback);
      error = res.error;
    }
    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setAction('');
    setLogLocationName('');
    setLogLocationUrl('');
    setShowLocationTagEditor(false);
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
    setSelectedLogTag(null);
    setLoading(false);
    router.replace('/');
  };

  const startVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    type RecCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onend: (() => void) | null;
      onerror: ((e: { error?: string }) => void) | null;
      start: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: RecCtor;
      webkitSpeechRecognition?: RecCtor;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setStatus(t('voiceNotSupported'));
      return;
    }
    const rec = new SR();
    rec.lang =
      language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript;
      if (text) setAction((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onend = () => setVoiceListening(false);
    rec.onerror = (e) => {
      setVoiceListening(false);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setStatus(t('voicePermissionDenied'));
        return;
      }
      setStatus(t('voiceNotSupported'));
    };
    setVoiceListening(true);
    try {
      rec.start();
    } catch {
      setVoiceListening(false);
      setStatus(t('voiceNotSupported'));
    }
  }, [language, t]);

  const theme = {
    bg: highContrast ? '#0f0f0f' : 'var(--bg-base)',
    text: highContrast ? '#ffffff' : 'var(--text-primary)',
    textSecondary: highContrast ? '#a1a1a1' : 'var(--text-secondary)',
  };

  if (boot === 'loading') {
    return (
      <main style={{ minHeight: '100vh', padding: 24, background: theme.bg, color: theme.text }}>
        <p style={{ margin: 0, fontSize: 14 }}>…</p>
      </main>
    );
  }

  if (boot === 'needLogin') {
    return (
      <main style={{ minHeight: '100vh', padding: 24, background: theme.bg, color: theme.text }}>
        <p>{t('loginRequired')}</p>
        <Link href="/" style={{ color: 'var(--accent)' }}>
          {t('login')}
        </Link>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '0 0 80px',
        background: theme.bg,
        color: theme.text,
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        ...(Math.abs(fontScale - 1) > 0.02 && ({ zoom: fontScale, minWidth: 0 } as React.CSSProperties)),
        ...(fontBold ? { fontWeight: 600 } : {}),
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: highContrast ? '1px solid #333' : '1px solid var(--divider)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: theme.bg,
        }}
      >
        <Link
          href="/"
          aria-label={t('close')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
            color: theme.text,
          }}
        >
          <ChevronLeft size={22} strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>{isEditMode ? t('edit') : t('writeLogTitle')}</h1>
      </header>

      <div style={{ padding: '16px 16px 24px', maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {status && status !== 'loginRequired' && (
          <p style={{ fontSize: 13, color: theme.textSecondary, margin: '0 0 12px' }}>{status}</p>
        )}

        <p style={{ fontSize: 11, color: theme.textSecondary, margin: '0 0 6px' }}>{t('nextPostTagLabel')}</p>
        <div
          className="horizontal-scroll-hide"
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 12,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
            flexWrap: 'nowrap',
          }}
        >
          {MEMBER_LIKE_TAGS.map((tag) => (
            <button
              key={tag.label}
              type="button"
              className="log-filter-btn"
              onClick={() => {
                hasUserSelectedTagRef.current = true;
                setSelectedLogTag(tag.value);
              }}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 999,
                border: selectedLogTag === tag.value ? '1px solid var(--accent)' : '1px solid var(--divider)',
                background: selectedLogTag === tag.value ? 'var(--accent-light)' : highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                color: selectedLogTag === tag.value ? 'var(--accent)' : highContrast ? '#94a3b8' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: selectedLogTag === tag.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: highContrast ? '#ffffff' : 'var(--text-secondary)' }}>{t('quickPhrases')}</span>
            <button
              type="button"
              onClick={() => setShowPhraseManager(true)}
              aria-label={quickPhrases.length > 0 ? t('manage') : t('add')}
              style={{
                fontSize: 12,
                color: highContrast ? '#ffc107' : 'var(--accent)',
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {quickPhrases.map((phrase, i) => (
                <button
                  key={`${i}-${phrase}`}
                  type="button"
                  onClick={() => setAction((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--divider)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 10 }}>
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t('logPlaceholder')}
            aria-label={t('logPlaceholder')}
            rows={3}
            style={{
              flex: 1,
              minWidth: 0,
              boxSizing: 'border-box',
              resize: 'none',
              borderRadius: 12,
              border: '1px solid var(--divider)',
              padding: 12,
              fontSize: 14,
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: highContrast ? '#fff' : 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={startVoiceInput}
            disabled={voiceListening}
            aria-label={t('voiceInput')}
            title={t('voiceInput')}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              minHeight: 48,
              borderRadius: 12,
              border: '1px solid var(--divider)',
              background: voiceListening ? 'var(--accent-light)' : highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: theme.text,
              cursor: voiceListening ? 'wait' : 'pointer',
            }}
          >
            <Mic size={22} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowLocationTagEditor((v) => !v)}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: highContrast ? '#fff' : 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={20} strokeWidth={1.5} aria-hidden />
              {t('writeLocationPin')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
              {showLocationTagEditor ? t('writeLocationOpen') : t('writeLocationClose')}
            </span>
          </button>

          {showLocationTagEditor && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={logLocationName}
                  onChange={(e) => setLogLocationName(e.target.value)}
                  placeholder={t('writeLocationNamePlaceholder')}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--divider)',
                    padding: '10px 12px',
                    fontSize: 13,
                    background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                    color: highContrast ? '#fff' : 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!logLocationName.trim()) return;
                    const q = encodeURIComponent(logLocationName.trim());
                    setLocationSearching(true);
                    void fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${q}`)
                      .then((r) => r.json())
                      .then((arr: Array<{ display_name?: string; lat?: string; lon?: string }>) => {
                        const next = (arr ?? [])
                          .filter((x) => x.display_name && x.lat && x.lon)
                          .map((x) => ({ name: x.display_name as string, lat: x.lat as string, lon: x.lon as string }));
                        setLocationResults(next);
                      })
                      .catch(() => setLocationResults([]))
                      .finally(() => setLocationSearching(false));
                  }}
                  style={{
                    border: '1px solid var(--divider)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {locationSearching ? '검색 중...' : '장소 찾기'}
                </button>
              </div>
              {locationResults.length > 0 && (
                <div className="horizontal-scroll-hide" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
                  {locationResults.map((result) => (
                    <button
                      key={`${result.lat}-${result.lon}`}
                      type="button"
                      onClick={() => {
                        setLogLocationName(result.name);
                        setLogLocationUrl(`https://www.google.com/maps?q=${result.lat},${result.lon}`);
                        setLocationResults([]);
                      }}
                      style={{
                        flexShrink: 0,
                        maxWidth: 260,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--divider)',
                        background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
                        color: highContrast ? '#fff' : 'var(--text-secondary)',
                        fontSize: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        whiteSpace: 'normal',
                      }}
                    >
                      {result.name}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="url"
                value={logLocationUrl}
                onChange={(e) => setLogLocationUrl(e.target.value)}
                placeholder="선택한 장소 링크가 자동 입력됩니다"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--divider)',
                  padding: '10px 12px',
                  fontSize: 13,
                  background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                  color: highContrast ? '#fff' : 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            type="file"
            accept="image/*,image/heic,image/heif"
            capture="environment"
            id="write-log-camera-input"
            style={{ display: 'none' }}
            multiple
            onChange={(e) => handleMediaSelect(e, true)}
          />
          <input
            type="file"
            accept="image/*,image/heic,image/heif,video/*"
            id="write-log-gallery-input"
            style={{ display: 'none' }}
            multiple
            onChange={(e) => handleMediaSelect(e, false)}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
              marginBottom: 10,
              alignItems: 'stretch',
            }}
          >
            <label
              htmlFor={mediaBusy ? undefined : 'write-log-camera-input'}
              aria-label={t('takePhoto')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--divider)',
                background: mediaBusy ? 'var(--divider)' : 'var(--bg-subtle)',
                color: mediaBusy ? 'var(--text-caption)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: mediaBusy ? 'wait' : 'pointer',
                pointerEvents: mediaBusy ? 'none' : 'auto',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <Camera size={20} strokeWidth={1.5} aria-hidden />
              {t('takePhoto')}
            </label>
            <label
              htmlFor={mediaBusy ? undefined : 'write-log-gallery-input'}
              aria-label={t('fromAlbum')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--divider)',
                background: mediaBusy ? 'var(--divider)' : 'var(--bg-subtle)',
                color: mediaBusy ? 'var(--text-caption)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: mediaBusy ? 'wait' : 'pointer',
                pointerEvents: mediaBusy ? 'none' : 'auto',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <ImageIcon size={20} strokeWidth={1.5} aria-hidden />
              {t('fromAlbum')}
            </label>
            <button
              type="button"
              onClick={() => setShowDrawModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--divider)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              {t('writeSketch')}
            </button>
          </div>
          {(logImagePreviews.length > 0 || logVideoPreview) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0,
                marginBottom: 8,
                marginLeft: -16,
                marginRight: -16,
                width: 'calc(100% + 32px)',
              }}
            >
              {logImagePreviews.map((url, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    flex: isSingleLogMediaPreview ? '0 0 100%' : '0 0 50%',
                    width: isSingleLogMediaPreview ? '100%' : '50%',
                    minWidth: 0,
                  }}
                >
                  <img
                    src={url}
                    alt={t('writePreviewAlt')}
                    style={{
                      width: '100%',
                      height: isSingleLogMediaPreview ? 240 : 160,
                      objectFit: 'cover',
                      borderRadius: 0,
                      border: 'none',
                      display: 'block',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditImageIndex(i);
                      setEditImageTag('');
                      setEditImageFilter('none');
                    }}
                    aria-label={t('writeDecorating')}
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      padding: '2px 6px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'var(--bg-card)',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {t('writeDecorating')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(url);
                      logPreviewUrlsRef.current = logPreviewUrlsRef.current.filter((u) => u !== url);
                      setLogImageFiles((prev) => prev.filter((_, j) => j !== i));
                      setLogImagePreviews((prev) => prev.filter((_, j) => j !== i));
                    }}
                    aria-label={t('writeRemoveMedia')}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'var(--bg-card)',
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={20} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              ))}
              {logVideoPreview && (
                <div
                  style={{
                    position: 'relative',
                    flex: isSingleLogMediaPreview ? '0 0 100%' : '0 0 50%',
                    width: isSingleLogMediaPreview ? '100%' : '50%',
                    minWidth: 0,
                  }}
                >
                  <video
                    src={logVideoPreview}
                    style={{
                      width: '100%',
                      height: isSingleLogMediaPreview ? 240 : 160,
                      objectFit: 'cover',
                      borderRadius: 0,
                      border: 'none',
                      display: 'block',
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
                    aria-label={t('writeRemoveMedia')}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'var(--bg-card)',
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={20} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              )}
            </div>
          )}
          {imageCompressing && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{t('writeCompressing')}</p>
          )}
          {videoCompressing && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{t('writeCompressingVideo')}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleInsert}
          disabled={loading || !householdId || mediaBusy}
          style={{
            width: '100%',
            borderRadius: 12,
            border: 'none',
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !householdId || mediaBusy ? 'not-allowed' : 'pointer',
            background:
              loading || !householdId || mediaBusy
                ? 'color-mix(in srgb, var(--text-secondary) 45%, transparent)'
                : 'var(--accent)',
            color: 'var(--bg-card)',
            minHeight: 42,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {loading ? t('savingLog') : isEditMode ? t('save') : t('quickPost')}
        </button>
      </div>

      {editImageIndex != null && logImagePreviews[editImageIndex] && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 58 }}
            onClick={() => setEditImageIndex(null)}
          />
          <div
            role="dialog"
            aria-labelledby="write-decorate-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(360px, 92vw)',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: 16,
              borderRadius: 16,
              background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
              border: highContrast ? '2px solid #ffc107' : '1px solid var(--divider)',
              zIndex: 59,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 id="write-decorate-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={20} strokeWidth={1.5} aria-hidden />
                {t('writeDecorateTitle')}
              </h3>
              <button type="button" onClick={() => setEditImageIndex(null)} aria-label={t('close')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <img
              src={logImagePreviews[editImageIndex]}
              alt=""
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                borderRadius: 12,
                border: '1px solid var(--divider)',
                ...(editImageFilter === 'grayscale' && { filter: 'grayscale(100%)' }),
                ...(editImageFilter === 'sepia' && { filter: 'sepia(100%)' }),
              }}
            />
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['none', 'grayscale', 'sepia'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEditImageFilter(f)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: editImageFilter === f ? '2px solid var(--accent)' : '1px solid var(--divider)',
                      background: editImageFilter === f ? 'var(--accent-light)' : 'var(--bg-subtle)',
                      color: editImageFilter === f ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {f === 'none' ? t('writeFilterOriginal') : f === 'grayscale' ? t('writeFilterGrayscale') : t('writeFilterSepia')}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: highContrast ? '#94a3b8' : 'var(--text-secondary)', marginBottom: 6 }}>{t('writeCaptionLabel')}</div>
              <input
                type="text"
                value={editImageTag}
                onChange={(e) => setEditImageTag(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--divider)',
                  background: highContrast ? '#0f0f0f' : 'var(--bg-subtle)',
                  color: highContrast ? '#fff' : 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setEditImageIndex(null)} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--divider)', background: 'var(--bg-subtle)', fontSize: 13, cursor: 'pointer' }}>
                {t('cancel')}
              </button>
              <button type="button" onClick={applyImageEdit} style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent)', color: 'var(--bg-card)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {t('writeApply')}
              </button>
            </div>
          </div>
        </>
      )}

      {showDrawModal && (
        <>
          <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 58 }} onClick={() => setShowDrawModal(false)} />
          <div
            role="dialog"
            aria-label={t('writeDrawTitle')}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(360px, 92vw)',
              padding: 16,
              borderRadius: 16,
              background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
              border: highContrast ? '2px solid #ffc107' : '1px solid var(--divider)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              zIndex: 59,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-primary)' }}>{t('writeDrawTitle')}</h3>
              <button type="button" onClick={() => setShowDrawModal(false)} aria-label={t('close')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: highContrast ? '#94a3b8' : 'var(--text-secondary)' }}>{t('writeDrawHint')}</p>
            <canvas
              ref={drawCanvasRef}
              style={{
                display: 'block',
                width: 320,
                maxWidth: '100%',
                height: 280,
                borderRadius: 12,
                border: '2px solid var(--divider)',
                background: 'var(--bg-card)',
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
              onPointerUp={() => {
                const canvas = drawCanvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) {
                  drawHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                }
                drawActiveRef.current = false;
                drawLastRef.current = null;
              }}
              onPointerLeave={() => {
                drawActiveRef.current = false;
                drawLastRef.current = null;
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  const canvas = drawCanvasRef.current;
                  const ctx = canvas?.getContext('2d');
                  if (!ctx || drawHistoryRef.current.length <= 1) return;
                  drawHistoryRef.current.pop();
                  const prev = drawHistoryRef.current[drawHistoryRef.current.length - 1];
                  if (prev) ctx.putImageData(prev, 0, 0);
                }}
                style={{ flex: 1, minHeight: 42, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--divider)', background: 'var(--bg-subtle)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                되돌리기
              </button>
              <button
                type="button"
                onClick={() => {
                  const canvas = drawCanvasRef.current;
                  const ctx = canvas?.getContext('2d');
                  if (ctx && canvas) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 320, 280);
                    ctx.strokeStyle = '#000000';
                    drawHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
                  }
                }}
                style={{ flex: 1, minHeight: 42, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--divider)', background: 'var(--bg-subtle)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {t('writeDrawClear')}
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
                style={{ flex: 1, minHeight: 42, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent)', color: 'var(--bg-card)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center' }}
              >
                {t('writeDrawDone')}
              </button>
            </div>
          </div>
        </>
      )}

      {showPhraseManager && (
        <div
          role="presentation"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => {
            setShowPhraseManager(false);
            setNewPhraseInput('');
          }}
        >
          <div
            role="dialog"
            style={{
              width: '100%',
              maxWidth: 360,
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 20,
              borderRadius: 20,
              background: 'var(--bg-card)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
              border: '1px solid var(--divider)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{t('phraseManageTitle')}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhraseManager(false);
                  setNewPhraseInput('');
                }}
                aria-label={t('close')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--divider)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t('close')}
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-caption)' }}>{t('phraseManageHint')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, minHeight: 32 }}>
              {quickPhrases.map((phrase, i) => (
                <span
                  key={`${i}-${phrase}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--divider)',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {phrase}
                  <button
                    type="button"
                    onClick={() => saveQuickPhrases(quickPhrases.filter((_, j) => j !== i))}
                    aria-label={t('delete')}
                    style={{
                      padding: 0,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'var(--text-caption)',
                      color: 'var(--bg-card)',
                      fontSize: 12,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={20} strokeWidth={1.5} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={newPhraseInput}
                onChange={(e) => setNewPhraseInput(e.target.value)}
                placeholder={t('phrasePlaceholder')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--divider)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const text = newPhraseInput.trim();
                    if (text) {
                      saveQuickPhrases([...quickPhrases, text]);
                      setNewPhraseInput('');
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const text = newPhraseInput.trim();
                  if (text) {
                    saveQuickPhrases([...quickPhrases, text]);
                    setNewPhraseInput('');
                  }
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  color: 'var(--bg-card)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
