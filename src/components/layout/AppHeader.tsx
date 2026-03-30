'use client';

import Image from 'next/image';

type AppHeaderProps = {
  t: (key: string) => string;
};

export function AppHeader({ t }: AppHeaderProps) {
  return (
    <header style={{ marginBottom: 0, paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)', borderBottom: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
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
            width={340}
            height={88}
            sizes="(max-width: 480px) 92vw, 340px"
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
    </header>
  );
}
