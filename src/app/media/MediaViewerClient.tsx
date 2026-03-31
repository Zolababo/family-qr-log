'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { sanitizeMediaUrl } from '@/lib/safeUrl';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clampTranslate = (next: { x: number; y: number }, scale: number) => {
  if (typeof window === 'undefined' || scale <= 1) return { x: 0, y: 0 };
  const maxX = ((window.innerWidth * scale) - window.innerWidth) / 2;
  const maxY = ((window.innerHeight * scale) - window.innerHeight) / 2;
  return {
    x: clamp(next.x, -maxX, maxX),
    y: clamp(next.y, -maxY, maxY),
  };
};

const distanceBetweenTouches = (touches: { length: number; [index: number]: { clientX: number; clientY: number } | undefined }) => {
  if (touches.length < 2) return 0;
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot((b?.clientX ?? 0) - (a?.clientX ?? 0), (b?.clientY ?? 0) - (a?.clientY ?? 0));
};

export default function MediaViewerClient() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') === 'video' ? 'video' : 'image';
  const url = searchParams.get('url') ?? '';
  const urlsKey = searchParams.get('urlsKey');
  const urls = useMemo(() => {
    const cleanList = (arr: string[]) =>
      arr.map((u) => sanitizeMediaUrl(u)).filter((u): u is string => typeof u === 'string' && u.length > 0);
    if (urlsKey) {
      try {
        const stored = sessionStorage.getItem(urlsKey);
        if (stored) {
          const parsedStored = JSON.parse(stored);
          if (Array.isArray(parsedStored)) {
            return cleanList(parsedStored.filter((u): u is string => typeof u === 'string' && u.trim().length > 0));
          }
        }
      } catch {
        // storage access failed; fallback to query
      }
    }
    const raw = searchParams.get('urls');
    if (!raw) return [] as string[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [] as string[];
      return cleanList(parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0));
    } catch {
      return [] as string[];
    }
  }, [searchParams, urlsKey]);

  const indexParam = Number(searchParams.get('index') ?? '0');
  const initialIndex = Number.isFinite(indexParam) ? Math.max(0, Math.min(indexParam, Math.max(0, urls.length - 1))) : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const safePrimaryUrl = sanitizeMediaUrl(url);
  const activeImageUrl = urls.length > 0 ? urls[currentIndex] : safePrimaryUrl;
  const canSwipeImages = type === 'image' && urls.length > 1;
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchScaleStartRef = useRef(1);
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setZoomScale(1);
    setTranslate({ x: 0, y: 0 });
    setTouchStartX(null);
    pinchDistanceRef.current = null;
    panStartRef.current = null;
  }, [activeImageUrl]);

  const downloadMedia = async (src: string) => {
    if (typeof window === 'undefined') return;
    const confirmed = window.confirm(type === 'video' ? '이 영상을 다운로드할까요?' : '이 사진을 다운로드할까요?');
    if (!confirmed) return;
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const fallbackName = type === 'video' ? 'family-log-video' : 'family-log-photo';
      const urlPath = (() => {
        try {
          return new URL(src).pathname.split('/').pop() ?? fallbackName;
        } catch {
          return fallbackName;
        }
      })();
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = urlPath || fallbackName;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Fallback for browsers/storage responses that block fetch-to-blob downloads.
      const a = document.createElement('a');
      a.href = src;
      a.download = '';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const shareMedia = async (src: string) => {
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      try {
        await navigator.share({ url: src });
        return;
      } catch {
        // ignore including user cancel
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(src);
      } catch {
        // ignore clipboard permission errors
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
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: pinchDistanceRef.current == null ? 'transform 120ms ease-out' : 'none',
            touchAction: 'none',
            userSelect: 'none',
          }}
          onTouchStart={(e) => {
            if (e.touches.length >= 2) {
              pinchDistanceRef.current = distanceBetweenTouches(e.touches);
              pinchScaleStartRef.current = zoomScale;
              setTouchStartX(null);
              panStartRef.current = null;
              return;
            }

            const touch = e.changedTouches?.[0];
            if (!touch) return;
            if (zoomScale > 1.01) {
              panStartRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                originX: translate.x,
                originY: translate.y,
              };
              setTouchStartX(null);
              return;
            }
            setTouchStartX(touch.clientX);
          }}
          onTouchMove={(e) => {
            if (e.touches.length >= 2) {
              const nextDistance = distanceBetweenTouches(e.touches);
              const startDistance = pinchDistanceRef.current;
              if (!startDistance) return;
              const nextScale = clamp((nextDistance / startDistance) * pinchScaleStartRef.current, MIN_SCALE, MAX_SCALE);
              setZoomScale(nextScale);
              if (nextScale <= 1.01) {
                setTranslate({ x: 0, y: 0 });
              } else {
                setTranslate((prev) => clampTranslate(prev, nextScale));
              }
              e.preventDefault();
              return;
            }

            if (zoomScale > 1.01 && panStartRef.current) {
              const touch = e.touches?.[0];
              if (!touch) return;
              const nextX = panStartRef.current.originX + (touch.clientX - panStartRef.current.x);
              const nextY = panStartRef.current.originY + (touch.clientY - panStartRef.current.y);
              setTranslate(clampTranslate({ x: nextX, y: nextY }, zoomScale));
              e.preventDefault();
            }
          }}
          onTouchEnd={(e) => {
            if (e.touches.length >= 2) return;
            if (pinchDistanceRef.current != null) {
              pinchDistanceRef.current = null;
              pinchScaleStartRef.current = zoomScale;
            }
            if (zoomScale <= 1.01) {
              if (zoomScale !== 1 || translate.x !== 0 || translate.y !== 0) {
                setZoomScale(1);
                setTranslate({ x: 0, y: 0 });
              }
              panStartRef.current = null;
            }
            if (!canSwipeImages || touchStartX == null || zoomScale > 1.01) return;
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
          onDoubleClick={() => {
            if (zoomScale > 1.01) {
              setZoomScale(1);
              setTranslate({ x: 0, y: 0 });
            } else {
              const nextScale = 2.5;
              setZoomScale(nextScale);
              setTranslate(clampTranslate({ x: 0, y: 0 }, nextScale));
            }
          }}
        />
      ) : null}
      {safePrimaryUrl && type === 'video' ? (
        <video src={safePrimaryUrl} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : null}
      {canSwipeImages && zoomScale <= 1.01 && (
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
          onClick={() => void shareMedia(type === 'image' ? activeImageUrl : safePrimaryUrl)}
          aria-label="Share"
          title="Share"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.35)',
            color: 'var(--color-text-strong)',
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
          onClick={() => void downloadMedia(type === 'image' ? activeImageUrl : safePrimaryUrl)}
          aria-label="Download"
          title="Download"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.35)',
            color: 'var(--color-text-strong)',
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
