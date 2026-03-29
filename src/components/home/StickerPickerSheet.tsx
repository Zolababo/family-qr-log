'use client';

export const STICKER_OPTIONS = ['✨', '❤️', '⭐', '🎉', '🧸', '🌿', '🌈', '☀️', '🍀', '💫'];

type StickerPickerSheetProps = {
  highContrast: boolean;
  onClose: () => void;
  /** null = 스티커 제거 */
  onPickSticker: (sticker: string | null) => void;
};

/** 로그 카드 스티커 선택 하단 시트 — `onPickSticker`는 부모에서 `applyStickerToLog` 등과 연결 */
export function StickerPickerSheet({ highContrast, onClose, onPickSticker }: StickerPickerSheetProps) {
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
  );
}
