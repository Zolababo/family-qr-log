'use client';

import Image from 'next/image';
import { Settings } from 'lucide-react';

type AppHeaderProps = {
  t: (key: string) => string;
  /** 있으면 타이틀 오른쪽에 작은 설정 버튼(터치 영역은 넓게) */
  onSettingsClick?: () => void;
};

const SETTINGS_ICON = 18;
const SETTINGS_HIT = 44;

export function AppHeader({ t, onSettingsClick }: AppHeaderProps) {
  return (
    <header style={{ marginBottom: 0, paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-1)', borderBottom: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: SETTINGS_HIT,
        }}
      >
        <div style={{ width: SETTINGS_HIT, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <h1
            id="app-title"
            className="app-title-logo-heading"
            style={{
              margin: 0,
              textAlign: 'center',
              width: '100%',
              lineHeight: 0,
            }}
          >
            <Image
              className="app-title-logo-img"
              src="/logo-title.png"
              alt={t('appTitleLogoAlt')}
              width={400}
              height={100}
              sizes="(max-width: 480px) 96vw, 400px"
              priority
              style={{
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </h1>
        </div>
        <div style={{ width: SETTINGS_HIT, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {onSettingsClick ? (
            <button
              type="button"
              onClick={onSettingsClick}
              aria-label={t('menu')}
              style={{
                width: SETTINGS_HIT,
                height: SETTINGS_HIT,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <Settings size={SETTINGS_ICON} strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
