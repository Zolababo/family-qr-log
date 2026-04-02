'use client';

import { X } from 'lucide-react';
import type { Lang } from '../../app/translations';

type SettingsMenuModalProps = {
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
  highContrast: boolean;
  language: Lang;
  setLanguage: (lang: Lang) => void;
  langLabels: Record<Lang, string>;
  onNameEdit: () => void;
  onProfilePhotoChange: () => void;
  onInviteFamily: () => void;
  onAccessibility: () => void;
  profileAvatarUploading?: boolean;
};

export function SettingsMenuModal({
  open,
  onClose,
  t,
  highContrast,
  language,
  setLanguage,
  langLabels,
  onNameEdit,
  onProfilePhotoChange,
  onInviteFamily,
  onAccessibility,
  profileAvatarUploading = false,
}: SettingsMenuModalProps) {
  if (!open) return null;

  const modalBg = highContrast ? '#0f0f0f' : 'var(--bg-card)';
  const modalBorder = highContrast ? '2px solid #ffc107' : '1px solid var(--divider)';
  const textColor = highContrast ? '#ffffff' : 'var(--text-primary)';
  const secondaryColor = highContrast ? '#94a3b8' : 'var(--text-secondary)';
  const rowHover = highContrast ? '#333' : 'var(--bg-subtle)';

  const closeAnd = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <>
      <div
        role="presentation"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={t('menu')}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(360px, 92vw)',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 20,
          borderRadius: 16,
          background: modalBg,
          border: modalBorder,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          zIndex: 51,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textColor }}>설정</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: rowHover,
              color: secondaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <section style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: secondaryColor, marginBottom: 8 }}>{t('settingsPersonal')}</div>
          <button
            type="button"
            onClick={() => closeAnd(onNameEdit)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: textColor,
              fontSize: 15,
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: 10,
            }}
          >
            · {t('editName')}
          </button>
          <button
            type="button"
            onClick={() => closeAnd(onProfilePhotoChange)}
            disabled={profileAvatarUploading}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: textColor,
              fontSize: 15,
              textAlign: 'left',
              cursor: profileAvatarUploading ? 'wait' : 'pointer',
              borderRadius: 10,
            }}
          >
            · {profileAvatarUploading ? '업로드 중...' : t('profilePhotoChange')}
          </button>
        </section>

        <section style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: secondaryColor, marginBottom: 8 }}>{t('settingsFamily')}</div>
          <button
            type="button"
            onClick={() => closeAnd(onInviteFamily)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: textColor,
              fontSize: 15,
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: 10,
            }}
          >
            · {t('inviteFamily')}
          </button>
        </section>

        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: secondaryColor, marginBottom: 8 }}>{t('settingsApp')}</div>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 13, color: secondaryColor, marginBottom: 6, paddingLeft: 14 }}>{t('languageChange')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 14, alignItems: 'stretch' }}>
              {(['ko', 'en', 'ja', 'zh'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className="settings-lang-btn log-filter-btn"
                  onClick={() => setLanguage(lang)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--divider)',
                    background: language === lang ? 'var(--accent-light)' : 'transparent',
                    color: textColor,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    margin: 0,
                    verticalAlign: 'middle',
                  }}
                >
                  {langLabels[lang]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeAnd(onAccessibility)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: textColor,
              fontSize: 15,
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: 10,
            }}
          >
            · {t('accessibility')}
          </button>
        </section>
      </div>
    </>
  );
}
