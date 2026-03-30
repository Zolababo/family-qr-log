'use client';

import { Accessibility } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { FONT_STEPS, type FontScaleStep } from '../../lib/accessibilityFont';

type AccFontDraft = { step: FontScaleStep; bold: boolean };

type AccessibilitySettingsModalProps = {
  t: (key: string) => string;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  accFontDraft: AccFontDraft;
  setAccFontDraft: Dispatch<SetStateAction<AccFontDraft>>;
  simpleMode: boolean;
  setSimpleMode: (v: boolean) => void;
  /** 배경 탭: 미리보기만 버리고 닫음(글자 단계는 적용하지 않음) */
  onDismiss: () => void;
  /** 닫기 버튼: 글자 단계·굵기 적용 후 닫음 */
  onApplyAndClose: () => void;
};

/** 고대비·글자 크기·간단 모드 설정 */
export function AccessibilitySettingsModal({
  t,
  highContrast,
  setHighContrast,
  accFontDraft,
  setAccFontDraft,
  simpleMode,
  setSimpleMode,
  onDismiss,
  onApplyAndClose,
}: AccessibilitySettingsModalProps) {
  return (
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
      onClick={onDismiss}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 24,
          borderRadius: 20,
          background: 'var(--bg-card)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          border: '1px solid var(--divider)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="accessibility-title" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{t('highContrast')}</span>
          </label>
          <p id="high-contrast-desc" style={{ margin: '0 0 0 28px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {t('highContrastDesc')}
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('fontSizeStyle')}</p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{t('bigFontHint')}</p>
          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--divider)',
              background: 'var(--bg-subtle)',
              padding: '14px 14px 12px',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: `clamp(13px, ${0.85 + accFontDraft.step * 0.12}rem, 22px)`,
                fontWeight: accFontDraft.bold ? 700 : 500,
                color: 'var(--text-primary)',
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
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              {t('fontPreviewLine2')}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('fontSizeLabel')}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(FONT_STEPS[accFontDraft.step] * 100)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-caption)', lineHeight: 1 }} aria-hidden>
                A
              </span>
              <input
                type="range"
                min={0}
                max={7}
                step={1}
                value={accFontDraft.step}
                onChange={(e) => setAccFontDraft((d) => ({ ...d, step: Number(e.target.value) as FontScaleStep }))}
                aria-valuetext={`${Math.round(FONT_STEPS[accFontDraft.step] * 100)}%`}
                style={{
                  flex: 1,
                  height: 6,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }} aria-hidden>
                A
              </span>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', padding: '10px 0', borderTop: '1px solid var(--divider)' }}>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('fontBold')}</span>
            <input type="checkbox" checked={accFontDraft.bold} onChange={(e) => setAccFontDraft((d) => ({ ...d, bold: e.target.checked }))} />
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={simpleMode} onChange={(e) => setSimpleMode(e.target.checked)} aria-describedby="simple-mode-desc" />
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{t('simpleMode')}</span>
          </label>
          <p id="simple-mode-desc" style={{ margin: '0 0 0 28px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {t('simpleModeHint')}
          </p>
        </div>

        <button
          type="button"
          onClick={onApplyAndClose}
          style={{
            display: 'block',
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: '1px solid var(--divider)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
