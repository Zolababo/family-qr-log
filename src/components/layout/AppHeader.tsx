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
  children?: React.ReactNode;
};

export function AppHeader({ theme, highContrast, t, children }: AppHeaderProps) {
  return (
    <header style={{ marginBottom: 20, paddingBottom: 12, borderBottom: theme.border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h1
          id="app-title"
          style={{
            margin: 0,
            fontFamily: 'var(--font-outfit), var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: theme.text,
            flex: 1,
            minWidth: 0,
            background: highContrast ? undefined : 'var(--accent)',
            WebkitBackgroundClip: highContrast ? undefined : 'text',
            WebkitTextFillColor: highContrast ? undefined : 'transparent',
            backgroundClip: highContrast ? undefined : 'text',
          }}
        >
          {t('appTitle')}
        </h1>
      </div>
      {children}
    </header>
  );
}
