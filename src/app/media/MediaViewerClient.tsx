'use client';

import { useMemo, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function MediaViewerClient() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') === 'video' ? 'video' : 'image';
  const url = searchParams.get('url') ?? '';
  const urls = useMemo(() => {
    const raw = searchParams.get('urls');
    if (!raw) return [] as string[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
    } catch {
      return [] as string[];
    }
  }, [searchParams]);
  const indexParam = Number(searchParams.get('index') ?? '0');
  const initialIndex = Number.isFinite(indexParam) ? Math.max(0, Math.min(indexParam, Math.max(0, urls.length - 1))) : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const activeImageUrl = urls.length > 0 ? urls[currentIndex] : url;
  const canSwipeImages = type === 'image' && urls.length > 1;

  const downloadMedia = (src: string) => {
    if (typeof window === 'undefined') return;
    const a = document.createElement('a');
    a.href = src;
    a.download = '';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const shareMedia = async (src: string) => {
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      try {
        await navigator.share({ url: src });
        return;
      } catch {
        // 사용자 취소 포함: 조용히 무시
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(src);
      } catch {
        // 권한 문제 시 무시
      }
    }
  };

  return (
    <main
      style={{
        width: '100vw',
        height: '100dvh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
      }}
    >
      {activeImageUrl && type === 'image' ? (
        <img
          src={activeImageUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onTouchStart={(e) => setTouchStartX(e.changedTouches?.[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            if (!canSwipeImages || touchStartX == null) return;
            const endX = e.changedTouches?.[0]?.clientX ?? touchStartX;
            const dx = endX - touchStartX;
            setTouchStartX(null);
            if (Math.abs(dx) < 36) return;
            if (dx < 0) {
              setCurrentIndex((prev) => (prev + 1) % urls.length);
            } else {
              setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
            }
          }}
        />
      ) : null}
      {url && type === 'video' ? (
        <video src={url} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : null}
      {canSwipeImages && (
        <div
          style={{
            position: 'fixed',
            bottom: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.9)',
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          {currentIndex + 1} / {urls.length}
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          right: 12,
          bottom: 12,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => void shareMedia(type === 'image' ? activeImageUrl : url)}
          aria-label="공유"
          title="공유"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            borderRadius: 999,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Share2 size={18} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => downloadMedia(type === 'image' ? activeImageUrl : url)}
          aria-label="다운로드"
          title="다운로드"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            borderRadius: 999,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Download size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </main>
  );
}
