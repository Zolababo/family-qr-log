'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';

const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 20,
    background: '#0f172a',
    color: '#e5e7eb',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#020617',
    borderRadius: 16,
    padding: 24,
    border: '1px solid rgba(148,163,184,0.3)',
  },
  btn: {
    padding: '12px 20px',
    borderRadius: 999,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
    color: '#020617',
    minHeight: 44,
  },
  link: { color: '#38bdf8', textDecoration: 'none', fontSize: 14 },
};

export default function InvitePage() {
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [mintError, setMintError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) return;
      setUser(u);

      const { data: members } = await supabase.from('members').select('household_id').eq('user_id', u.id).limit(1);

      const hid = members?.[0]?.household_id;
      if (!hid) return;
      setHouseholdId(hid);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMintError('세션이 없어 초대 링크를 만들 수 없습니다.');
        return;
      }

      const res = await fetch('/api/invite/mint', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = (await res.json()) as { inviteUrl?: string; error?: string };
      if (!res.ok) {
        setMintError(j.error ?? `초대 링크 생성 실패 (${res.status})`);
        if (typeof window !== 'undefined' && res.status === 503) {
          setMintError(
            (j.error ?? '') +
              ' Vercel/서버에 INVITE_SIGNING_SECRET(16자 이상)을 설정해 주세요.'
          );
        }
        return;
      }
      if (j.inviteUrl) setInviteUrl(j.inviteUrl);
    };
    void init();
  }, []);

  const copyLink = () => {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>가족 초대</h1>
          <p style={{ color: '#94a3b8', marginBottom: 20 }}>로그인이 필요합니다.</p>
          <Link href="/login" style={styles.link}>
            로그인하기 →
          </Link>
        </div>
      </main>
    );
  }

  if (!householdId) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>가족 초대</h1>
          <p style={{ color: '#94a3b8' }}>가족 그룹 정보를 찾을 수 없습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>가족 초대</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
          아래 링크를 카카오톡·문자로 보내면 가족이 참여할 수 있습니다. 링크는 일정 기간 후 만료됩니다.
        </p>

        {mintError && (
          <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12, lineHeight: 1.45 }}>{mintError}</p>
        )}

        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid #1e293b',
            fontSize: 12,
            wordBreak: 'break-all' as const,
            color: '#94a3b8',
            marginBottom: 12,
          }}
        >
          {inviteUrl || (mintError ? '—' : '로딩 중...')}
        </div>

        <button onClick={copyLink} disabled={!inviteUrl} style={{ ...styles.btn, width: '100%', opacity: inviteUrl ? 1 : 0.6 }}>
          {copied ? '복사됨!' : '링크 복사'}
        </button>

        <p style={{ marginTop: 24, fontSize: 12, color: '#64748b' }}>
          <Link href="/" style={styles.link}>
            ← 홈으로
          </Link>
        </p>
      </div>
    </main>
  );
}
