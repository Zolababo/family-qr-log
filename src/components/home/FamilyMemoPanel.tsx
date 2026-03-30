'use client';

import { useRef } from 'react';
import { FileText } from 'lucide-react';

type FamilyMemoPanelProps = {
  memoPanelAnimated: boolean;
  onClose: () => void;
  highContrast: boolean;
  t: (key: string) => string;
  memoContent: string;
  onMemoContentChange: (value: string) => void;
  memoSaving: boolean;
  onSave: () => void | Promise<void>;
};

/** 오른쪽 슬라이드 가족 공유 메모 패널 */
export function FamilyMemoPanel({
  memoPanelAnimated,
  onClose,
  highContrast,
  t,
  memoContent,
  onMemoContentChange,
  memoSaving,
  onSave,
}: FamilyMemoPanelProps) {
  const swipeStartXRef = useRef<number | null>(null);

  return (
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
        onClick={onClose}
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
          background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
          borderLeft: highContrast ? '2px solid #ffc107' : '1px solid var(--divider)',
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
        onTouchStart={(e) => {
          const touch = e.changedTouches?.[0];
          if (touch) swipeStartXRef.current = touch.clientX;
        }}
        onTouchEnd={(e) => {
          const touch = e.changedTouches?.[0];
          if (!touch || swipeStartXRef.current == null) return;
          const start = swipeStartXRef.current;
          const end = touch.clientX;
          swipeStartXRef.current = null;
          if (end - start > 50) onClose();
        }}
      >
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} strokeWidth={1.5} aria-hidden />
            {t('memoTitle')}
          </h3>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={memoSaving}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
              color: highContrast ? '#fff' : 'var(--text-secondary)',
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
          onChange={(e) => onMemoContentChange(e.target.value)}
          placeholder="메모를 입력하세요..."
          style={{
            flex: 1,
            width: '100%',
            boxSizing: 'border-box',
            padding: 12,
            borderRadius: 12,
            border: highContrast ? '2px solid #ffc107' : '1px solid var(--divider)',
            background: highContrast ? '#0f0f0f' : 'var(--bg-subtle)',
            color: highContrast ? '#fff' : 'var(--text-primary)',
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
  );
}
