'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import jsQR from 'jsqr';

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
  const [selectedMemberId, setSelectedMemberId] = useState<'me' | string>('me');
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
  const [profileSaving, setProfileSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNameEditInMenu, setShowNameEditInMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [actionPopupLogId, setActionPopupLogId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logPreviewUrlsRef = useRef<string[]>([]);

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
        .select('household_id, display_name, user_id')
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

      const { data: allMembers, error: allMembersError } = await supabase
        .from('members')
        .select('user_id, display_name')
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
        .limit(30);

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

  useEffect(() => {
    if (!householdId || !user) return;

    const actorId = selectedMemberId === 'me' ? user.id : selectedMemberId;
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
          if (logVideoPreview) URL.revokeObjectURL(logVideoPreview);
          setLogVideoFile(videoFile);
          setLogVideoPreview(URL.createObjectURL(videoFile));
        }
      }

      if (imageFiles.length === 0) {
        e.target.value = '';
        if (imageFiles.length === 0 && videoFile) setStatus('사진/영상이 준비되었습니다.');
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
    [imageCompressing, logVideoPreview]
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

    const { error } = await supabase.from('logs').insert(payload);

    if (error) {
      setStatus(`logs insert 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setAction('');
    logPreviewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    logPreviewUrlsRef.current = [];
    if (logVideoPreview) URL.revokeObjectURL(logVideoPreview);
    setLogImageFiles([]);
    setLogImagePreviews([]);
    setLogVideoFile(null);
    setLogVideoPreview(null);
    const placeSlugFilter = placeViewFilter === 'all' ? undefined : placeViewFilter;
    await loadLogs(householdId, placeSlugFilter, selectedMemberId === 'me' ? user.id : selectedMemberId);
    setStatus('로그가 추가되었습니다.');
    setLoading(false);
    router.replace(pathname || '/');
  };

  const refreshLogs = useCallback(() => {
    if (!householdId || !user) return;
    const placeSlugFilter = placeViewFilter === 'all' ? undefined : placeViewFilter;
    const actorId = selectedMemberId === 'me' ? user.id : selectedMemberId;
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
    if (!window.confirm('이 로그를 삭제할까요?')) return;
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

  const getMemberName = (userId: string) => {
    const m = members.find((mm) => mm.user_id === userId);
    const name = m?.display_name;
    if (name && name.trim().length > 0) return name.trim();
    if (user && user.id === userId && user.email) return user.email.split('@')[0];
    return `${userId.slice(0, 8)}...`;
  };

  const meDisplayName =
    profileName || (user?.email ? user.email.split('@')[0] : '나');
  const currentPlaceLabel = getPlaceLabel(placeSlug);

  const logsByDate = logs.reduce<{ dateKey: string; dateLabel: string; items: Log[] }[]>((acc, log) => {
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

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '24px 16px',
        background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 24,
          padding: 20,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        <header style={{ marginBottom: 16, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Family QR log
            </h1>
            {user && (
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="메뉴"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#475569',
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
                      background: '#fff',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px #e2e8f0',
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
                            color: '#0f172a',
                            textDecoration: 'none',
                            fontSize: 14,
                          }}
                        >
                          QR코드
                        </Link>
                        <Link
                          href="/invite"
                          onClick={() => setMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '12px 16px',
                            color: '#0f172a',
                            textDecoration: 'none',
                            fontSize: 14,
                          }}
                        >
                          가족초대
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
                            color: '#0f172a',
                            fontSize: 14,
                            cursor: 'pointer',
                          }}
                        >
                          이름 수정
                        </button>
                      </>
                    ) : (
                      <div style={{ padding: '0 16px 12px' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>가족에게 보일 이름</div>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="예: 아빠, 엄마"
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
                          {profileSaving ? '저장 중' : '저장'}
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
                onClick={() => setSelectedMemberId('me')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
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
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    color: '#fff',
                  }}
                >
                  나
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
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: active ? 'rgba(56,189,248,0.35)' : '#e2e8f0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 12,
                          color: active ? '#0369a1' : '#64748b',
                        }}
                      >
                        {name.slice(0, 1)}
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
          <div style={{ fontSize: 13, color: '#475569' }}>
            <Link
              href="/login"
              style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
            >
              로그인
            </Link>
            하거나, 가족 초대 링크로{' '}
            <Link href="/join" style={{ color: '#2563eb', textDecoration: 'none' }}>
              참여
            </Link>
            하세요.
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
                <div style={{ fontSize: 11, letterSpacing: '0.05em', color: '#64748b', marginBottom: 8 }}>
                  이 QR 장소에 기록하기
                </div>
                <p style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                  현재 장소: <strong style={{ color: '#0f172a' }}>{currentPlaceLabel}</strong> (QR로 접속됨)
                </p>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, letterSpacing: '0.03em', color: '#64748b' }}>자주 쓰는 문구</span>
                    <button
                      type="button"
                      onClick={() => setShowPhraseManager(true)}
                      style={{
                        fontSize: 12,
                        color: '#3b82f6',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                    >
                      {quickPhrases.length > 0 ? '관리' : '추가'}
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
                  placeholder="예: 문 닫음, 약 복용함 등"
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
                      앨범에서 선택
                    </label>
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
                              URL.revokeObjectURL(logVideoPreview);
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
                  {loading ? '저장 중...' : `"${currentPlaceLabel}"에 로그 남기기`}
                </button>
              </section>
            ) : (
              <section
                style={{
                  marginBottom: 20,
                  padding: '24px 20px',
                  borderRadius: 16,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                <div style={{ maxWidth: 280, margin: '0 auto 20px', lineHeight: 1.6 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>
                    로그를 남기려면 해당 장소의
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#0f172a' }}>
                    <strong>QR코드를 스캔</strong>해 접속해 주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 24px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
                  }}
                >
                  <span style={{ fontSize: 22 }}>📷</span>
                  QR 스캔
                </button>
                <div style={{ maxWidth: 280, margin: '16px auto 0', lineHeight: 1.6 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    카메라가 켜지면
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    QR코드를 사각형 안에 맞춰 주세요.
                  </p>
                </div>
              </section>
            )}

            <section>
              <div style={{ fontSize: 11, letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 10 }}>
                최근 로그 (30)
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
                  { key: 'fridge' as const, label: '냉장고', bg: 'rgba(56,189,248,0.2)', border: 'rgba(56,189,248,0.6)', color: '#0369a1' },
                  { key: 'table' as const, label: '식탁', bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.6)', color: '#166534' },
                  { key: 'toilet' as const, label: '화장실', bg: 'rgba(251,191,36,0.25)', border: 'rgba(251,191,36,0.6)', color: '#a16207' },
                  { key: 'all' as const, label: '모든 장소', bg: '#f1f5f9', border: '#cbd5e1', color: '#475569' },
                ].map(({ key, label, bg, border, color }) => {
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
                      {label}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  maxHeight: 340,
                  overflowY: 'auto',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  padding: 10,
                }}
              >
                {logs.length === 0 && (
                  <div
                    style={{
                      padding: 24,
                      fontSize: 13,
                      color: '#64748b',
                      textAlign: 'center',
                    }}
                  >
                    아직 로그가 없습니다.
                  </div>
                )}

                {logsByDate.map((group) => (
                  <div key={group.dateKey} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      {group.dateLabel}
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
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            marginBottom: 8,
                            fontSize: 13,
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
                                  저장
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
                                  취소
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
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
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: 8,
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    ...getPlaceChipStyle(log.place_slug),
                                  }}
                                >
                                  {getPlaceLabel(log.place_slug)}
                                </span>
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  {formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#64748b',
                                    padding: '3px 10px',
                                    borderRadius: 8,
                                    background: '#f1f5f9',
                                  }}
                                >
                                  {getMemberName(log.actor_user_id)}
                                </span>
                              </div>
                              {isMine && (
                                <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                                  길게 누르면 수정·삭제
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

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
          <div style={{ fontSize: 16, color: '#fff', marginBottom: 12 }}>QR 코드를 사각형 안에 맞춰 주세요</div>
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
            닫기
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
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    수정
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
                    삭제
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
              자주 쓰는 문구
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              저장한 문구는 로그 입력 시 탭해서 바로 넣을 수 있어요.
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
                    aria-label="삭제"
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
                placeholder="예: 약 먹음, 문 잠금"
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
                추가
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
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}