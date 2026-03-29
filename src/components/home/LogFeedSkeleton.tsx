'use client';

/** 홈 피드 최초 로드 전 자리 표시(애니메이션은 prefers-reduced-motion 시 비활성) */
export function LogFeedSkeleton({ highContrast }: { highContrast: boolean }) {
  const bar = (w: string) => (
    <div
      className="log-feed-skeleton-bar"
      role="presentation"
      style={{
        height: 11,
        width: w,
        maxWidth: '100%',
        borderRadius: 6,
        background: highContrast ? '#333' : 'var(--bg-subtle)',
        marginBottom: 8,
      }}
    />
  );

  return (
    <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-caption)', marginBottom: 10, letterSpacing: '0.04em' }}>
        로딩 중…
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: '12px 0',
            borderBottom: `1px solid ${highContrast ? '#333' : 'var(--divider)'}`,
          }}
        >
          {bar('52%')}
          {bar('88%')}
          {bar('72%')}
        </div>
      ))}
    </div>
  );
}
