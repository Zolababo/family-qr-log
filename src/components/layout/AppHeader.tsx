'use client';

import Image from 'next/image';

/** PWA `manifest` / `layout` favicon 과 동일 파일 (`public/icon-192.png`). `next/image` 최적화는 쿼리스트링·작은 아이콘에서 깨질 수 있어 `unoptimized`로 직접 제공 */
const APP_ICON_PATH = '/icon-192.png';

type AppHeaderProps = {
  t: (key: string) => string;
  /** 있으면 타이틀 오른쪽에 작은 설정 버튼(터치 영역은 넓게) */
  onSettingsClick?: () => void;
};

const SETTINGS_ICON_PX = 28;
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
              }}
            >
              <Image
                src={APP_ICON_PATH}
                alt=""
                width={SETTINGS_ICON_PX}
                height={SETTINGS_ICON_PX}
                sizes={`${SETTINGS_ICON_PX}px`}
                unoptimized
                aria-hidden
                style={{
                  display: 'block',
                  width: SETTINGS_ICON_PX,
                  height: SETTINGS_ICON_PX,
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
