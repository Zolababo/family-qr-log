'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const PLACES = [
  { slug: 'fridge', title: '냉장고' },
  { slug: 'table', title: '식탁' },
  { slug: 'toilet', title: '화장실' },
];

const styles = {
  main: {
    minHeight: '100vh',
    padding: 20,
    background: '#fff',
    color: '#1e293b',
    fontFamily: 'system-ui, sans-serif',
  },
  printArea: {
    maxWidth: 800,
    margin: '0 auto',
  },
  link: { color: '#0ea5e9', textDecoration: 'none', fontSize: 14 },
};

export default function QRPage() {
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const qrUrl = (slug: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${baseUrl}/?place=${slug}`)}`;

  return (
    <main style={styles.main}>
      <div style={styles.printArea}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
          <h1 style={{ fontSize: 22 }}>QR 코드 (프린트용)</h1>
          <div>
            <button
              onClick={() => window.print()}
              className="no-print"
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                background: '#0ea5e9',
                color: '#fff',
              }}
            >
              프린트
            </button>
            <span style={{ marginLeft: 12 }} className="no-print">
              <Link href="/" style={styles.link}>← 홈</Link>
            </span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }} className="no-print">
          각 장소에 붙일 QR 코드입니다. 프린트 후 잘라서 사용하세요.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          {PLACES.map((p) => (
            <div
              key={p.slug}
              style={{
                padding: 20,
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                textAlign: 'center',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{p.title}</div>
              {baseUrl ? (
                <img
                  src={qrUrl(p.slug)}
                  alt={`QR ${p.title}`}
                  width={200}
                  height={200}
                  style={{ display: 'block', margin: '0 auto' }}
                />
              ) : (
                <div style={{ width: 200, height: 200, background: '#f1f5f9', margin: '0 auto' }} />
              )}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                /?place={p.slug}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
