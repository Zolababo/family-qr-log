'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const householdId = searchParams.get('household');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (!householdId) setError('초대 링크가 올바르지 않습니다.');
  }, [householdId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId) return;
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        if (data.user) {
          const { error: insertErr } = await supabase.from('members').insert({
            household_id: householdId,
            user_id: data.user.id,
            role: 'member',
          });
          if (insertErr) throw insertErr;
          router.push('/');
          router.refresh();
        } else {
          setError('가입 후 이메일 확인이 필요할 수 있습니다.');
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        if (data.user) {
          const { data: existing } = await supabase
            .from('members')
            .select('id')
            .eq('household_id', householdId)
            .eq('user_id', data.user.id)
            .limit(1);
          if (!existing?.length) {
            const { error: insertErr } = await supabase.from('members').insert({
              household_id: householdId,
              user_id: data.user.id,
              role: 'member',
            });
            if (insertErr) throw insertErr;
          }
          router.push('/');
          router.refresh();
        }
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? '오류 발생');
    } finally {
      setLoading(false);
    }
  };

  if (!householdId) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>초대 링크 오류</h1>
          <p style={{ color: '#94a3b8', marginBottom: 20 }}>가족에게 받은 초대 링크를 다시 확인해주세요.</p>
          <Link href="/" style={styles.link}>← 홈으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>가족 참여</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
          로그인 또는 회원가입 후 가족 그룹에 참여합니다.
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
            {loading ? '처리 중...' : isSignUp ? '가입 후 참여' : '로그인 후 참여'}
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
          <Link href="/" style={styles.link}>← 홈으로</Link>
        </p>
      </div>
    </main>
  );
}
