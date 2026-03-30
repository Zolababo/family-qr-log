'use client';

import { useEffect, useRef, useState } from 'react';

export const STICKER_OPTIONS = [
  '🙂',
  '😄',
  '🥰',
  '😍',
  '😘',
  '🤗',
  '👍',
  '👏',
  '🙏',
  '💪',
  '❤️',
  '💖',
  '✨',
  '🌈',
  '🎉',
  '⭐',
  '🧸',
  '☀️',
  '🍀',
  '💫',
  '사랑해',
  '행복해',
  '최고야',
  '잘했어',
  '고마워',
  '응원해',
  '수고했어',
  '화이팅',
  '멋져',
  '축하해',
];

type StickerPickerSheetProps = {
  highContrast: boolean;
  onClose: () => void;
  /** null = 스티커 제거 */
  onPickSticker: (sticker: string | null) => void;
};

/** 로그 카드 스티커 선택 하단 시트 — `onPickSticker`는 부모에서 `applyStickerToLog` 등과 연결 */
export function StickerPickerSheet({ highContrast, onClose, onPickSticker }: StickerPickerSheetProps) {
  const startYRef = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const DRAG_CLOSE_THRESHOLD = 90;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;

    // Prevent browser pull-to-refresh while the bottom sheet is open.
    html.style.overscrollBehaviorY = 'contain';
    body.style.overflow = 'hidden';
    body.style.overscrollBehaviorY = 'contain';

    return () => {
      html.style.overscrollBehaviorY = prevHtmlOverscroll;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
    };
  }, []);

  return (
    <>
      <div
        role="presentation"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 44,
        }}
        onClick={onClose}
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
          transform: `translateY(${translateY}px)`,
          transition: translateY > 0 ? 'none' : 'transform 0.18s ease-out',
          touchAction: 'pan-y',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, paddingTop: 2, paddingBottom: 4, cursor: 'grab' }}
          onTouchStart={(e) => {
            const t = e.touches?.[0];
            if (!t) return;
            startYRef.current = t.clientY;
            dragYRef.current = 0;
          }}
          onTouchMove={(e) => {
            const t = e.touches?.[0];
            const startY = startYRef.current;
            if (!t || startY == null) return;
            const delta = t.clientY - startY;
            const drag = delta > 0 ? Math.min(delta, 220) : 0;
            dragYRef.current = drag;
            if (drag > 0) e.preventDefault();
            setTranslateY(drag);
          }}
          onTouchEnd={() => {
            const drag = dragYRef.current;
            dragYRef.current = 0;
            startYRef.current = null;
            setTranslateY(0);
            if (drag > DRAG_CLOSE_THRESHOLD) onClose();
          }}
          onTouchCancel={() => {
            dragYRef.current = 0;
            startYRef.current = null;
            setTranslateY(0);
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--divider)' }} aria-hidden />
        </div>
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: highContrast ? '#fff' : '#0f172a', marginBottom: 10 }}>
            스티커 선택
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              onClick={() => onPickSticker(null)}
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
            {STICKER_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPickSticker(s)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid var(--divider)',
                  background: highContrast ? 'rgba(255,255,255,0.04)' : 'var(--bg-subtle)',
                  color: highContrast ? '#fff' : '#0f172a',
                  fontSize: s.length <= 2 ? 20 : 13,
                  cursor: 'pointer',
                  lineHeight: s.length <= 2 ? 1 : 1.2,
                  fontWeight: s.length <= 2 ? 500 : 700,
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
  );
}
