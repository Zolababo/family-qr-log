'use client';

type Theme = {
  border: string;
  text: string;
  textSecondary: string;
  card: string;
  radius: number;
  radiusLg: number;
};

type AppHeaderProps = {
  theme: Theme;
  highContrast: boolean;
  t: (key: string) => string;
};

export function AppHeader({ theme, highContrast, t }: AppHeaderProps) {
  return (
    <header style={{ marginBottom: 0, paddingBottom: 2, borderBottom: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <h1
          id="app-title"
          style={{
            margin: 0,
            fontFamily: 'var(--font-app-title), var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            textAlign: 'center',
            color: theme.text,
            width: '100%',
            lineHeight: 1.15,
            background: highContrast ? undefined : 'var(--accent)',
            WebkitBackgroundClip: highContrast ? undefined : 'text',
            WebkitTextFillColor: highContrast ? undefined : 'transparent',
            backgroundClip: highContrast ? undefined : 'text',
          }}
        >
          {t('appTitle')}
        </h1>
      </div>
    </header>
  );
}
