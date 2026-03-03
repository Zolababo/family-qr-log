'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../api/supabaseClient';

const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    background: '#0f172a',
    color: '#e5e7eb',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: '#020617',
    borderRadius: 16,
    padding: 24,
    border: '1px solid rgba(148,163,184,0.3)',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #1e293b',
    fontSize: 16,
    background: '#020617',
    color: '#e5e7eb',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  btn: {
    width: '100%',
    padding: '14px',
    borderRadius: 999,
    border: 'none',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
    color: '#020617',
    minHeight: 48,
  },
  link: { color: '#38bdf8', textDecoration: 'none', fontSize: 14 },
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('가입 완료. 이메일 확인 후 로그인하세요. (확인 안 쓰면 Supabase에서 이메일 확인 끄기)');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? '오류 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Family QR Log</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
          {isSignUp ? '회원가입' : '로그인'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ ...styles.input, marginBottom: 12 }}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...styles.input, marginBottom: 16 }}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.5)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? '처리 중...' : isSignUp ? '가입하기' : '로그인'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 13, color: '#94a3b8' }}>
          {isSignUp ? (
            <>
              이미 계정 있음?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                style={{ ...styles.link, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                로그인
              </button>
            </>
          ) : (
            <>
              계정 없음?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                style={{ ...styles.link, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                회원가입
              </button>
            </>
          )}
        </p>

        <p style={{ marginTop: 20, fontSize: 12, color: '#64748b' }}>
          <Link href="/" style={styles.link}>
            ← 홈으로
          </Link>
        </p>
      </div>
    </main>
  );
}
