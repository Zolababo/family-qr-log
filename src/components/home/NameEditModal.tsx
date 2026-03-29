'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../ui/Button';

type NameEditModalProps = {
  highContrast: boolean;
  t: (key: string) => string;
  profileName: string;
  setProfileName: Dispatch<SetStateAction<string>>;
  profileSaving: boolean;
  onClose: () => void;
  onSave: () => void;
};

/** 하단 탭 이름 편집 — 저장 로직은 부모 `onSave` */
export function NameEditModal({
  highContrast,
  t,
  profileName,
  setProfileName,
  profileSaving,
  onClose,
  onSave,
}: NameEditModalProps) {
  return (
    <>
      <div
        role="presentation"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 54 }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={t('editName')}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(340px, 92vw)',
          padding: 20,
          borderRadius: 16,
          background: highContrast ? '#1e1e1e' : '#fff',
          border: highContrast ? '2px solid #ffc107' : '1px solid var(--bg-subtle)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          zIndex: 55,
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            marginBottom: 12,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" highContrast={highContrast} onClick={onClose} style={{ flex: 1 }}>
            {t('cancel')}
          </Button>
          <Button variant="primary" highContrast={highContrast} onClick={onSave} disabled={profileSaving} style={{ flex: 1 }}>
            {profileSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </>
  );
}
