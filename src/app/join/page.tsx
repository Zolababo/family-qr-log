import { Suspense } from 'react';
import JoinClient from './JoinClient';

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            background: '#0f172a',
            color: '#e5e7eb',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div>로딩 중...</div>
        </main>
      }
    >
      <JoinClient />
    </Suspense>
  );
}
