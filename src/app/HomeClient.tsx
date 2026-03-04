'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';

type Log = {
  id: string;
  household_id: string;
  place_slug: string;
  action: string;
  actor_user_id: string;
  created_at: string;
};

type Member = {
  user_id: string;
  display_name: string | null;
};

export default function HomeClient() {
  const searchParams = useSearchParams();
  const placeSlug = searchParams.get('place') ?? 'fridge';

  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<'all' | 'me' | string>('all');

  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setStatus(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus('로그인이 필요합니다.');
        return;
      }

      setUser(user);

      const {
        data: myMembers,
        error: memberError,
      } = await supabase
        .from('members')
        .select('household_id, display_name, user_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberError) {
        setStatus(`members 조회 실패: ${memberError.message}`);
        return;
      }

      const myMember = myMembers?.[0];
      if (!myMember) {
        setStatus('members 조회 실패: row 없음 (members 테이블에 user_id 확인)');
        return;
      }

      setHouseholdId(myMember.household_id);

      const baseName =
        (myMember.display_name && myMember.display_name.trim()) ||
        (user.email ? user.email.split('@')[0] : '나');
      setProfileName(baseName);

      const { data: allMembers, error: allMembersError } = await supabase
        .from('members')
        .select('user_id, display_name')
        .eq('household_id', myMember.household_id);

      if (!allMembersError && allMembers) {
        setMembers(allMembers);
      }
    };

    init();
  }, []);

  const loadLogs = useCallback(
    async (hid: string, slug: string, actorUserId?: string) => {
      let query = supabase
        .from('logs')
        .select('*')
        .eq('household_id', hid)
        .eq('place_slug', slug)
        .order('created_at', { ascending: false })
        .limit(30);

      if (actorUserId) {
        query = query.eq('actor_user_id', actorUserId);
      }

      const { data, error } = await query;

      if (error) {
        setStatus(`logs 조회 실패: ${error.message}`);
        return;
      }

      setLogs(data ?? []);
    },
    []
  );

  useEffect(() => {
    if (!householdId) return;

    let actorFilter: string | undefined;
    if (selectedMemberId === 'me') {
      if (!user) return;
      actorFilter = user.id;
    } else if (selectedMemberId !== 'all') {
      actorFilter = selectedMemberId;
    }

    loadLogs(householdId, placeSlug, actorFilter);
  }, [householdId, placeSlug, selectedMemberId, user, loadLogs]);

  const handleInsert = async () => {
    if (!user || !householdId) return;

    setLoading(true);
    setStatus(null);

    const { error } = await supabase.from('logs').insert({
      household_id: householdId,
      place_slug: placeSlug,
      action: action || 'clicked',
      actor_user_id: user.id,
    });

    if (error) {
      setStatus(`logs insert 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setAction('');
    await loadLogs(
      householdId,
      placeSlug,
      selectedMemberId === 'me' ? user.id : selectedMemberId === 'all' ? undefined : selectedMemberId
    );
    setStatus('로그가 추가되었습니다.');
    setLoading(false);
  };

  const handleProfileSave = async () => {
    if (!user || !householdId) return;
    const trimmed = profileName.trim();
    if (!trimmed) {
      setStatus('이름을 입력하세요.');
      return;
    }

    setProfileSaving(true);
    const { error } = await supabase
      .from('members')
      .update({ display_name: trimmed })
      .eq('household_id', householdId)
      .eq('user_id', user.id);

    if (error) {
      setStatus(`프로필 저장 실패: ${error.message}`);
      setProfileSaving(false);
      return;
    }

    setMembers((prev) =>
      prev.map((m) => (m.user_id === user.id ? { ...m, display_name: trimmed } : m))
    );
    setStatus('프로필이 저장되었습니다.');
    setProfileSaving(false);
  };

  const getMemberName = (userId: string) => {
    const m = members.find((mm) => mm.user_id === userId);
    const name = m?.display_name;
    if (name && name.trim().length > 0) return name.trim();
    if (user && user.id === userId && user.email) return user.email.split('@')[0];
    return `${userId.slice(0, 8)}...`;
  };

  const meDisplayName =
    profileName || (user?.email ? user.email.split('@')[0] : '나');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '40px 16px',
        background: '#0f172a',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#020617',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 24px 60px rgba(15,23,42,0.8)',
          border: '1px solid rgba(148,163,184,0.3)',
        }}
      >
        <header style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: '#64748b',
              }}
            >
              Family QR Log
            </div>
            <div style={{ fontSize: 12 }}>
              <Link
                href="/qr"
                style={{ color: '#38bdf8', textDecoration: 'none', marginRight: 12 }}
              >
                QR코드
              </Link>
              <Link href="/invite" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                가족초대
              </Link>
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            Place: <span style={{ color: '#38bdf8' }}>{placeSlug}</span>
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>
            URL 예시: <code>/?place=fridge</code>
          </p>
        </header>

        {status && (
          <div
            style={{
              marginBottom: 16,
              fontSize: 13,
              padding: '8px 10px',
              borderRadius: 8,
              background:
                status.includes('실패') || status.includes('필요')
                  ? 'rgba(248,113,113,0.15)'
                  : 'rgba(34,197,94,0.12)',
              border:
                status.includes('실패') || status.includes('필요')
                  ? '1px solid rgba(248,113,113,0.6)'
                  : '1px solid rgba(34,197,94,0.6)',
            }}
          >
            {status}
          </div>
        )}

        {!user && (
          <div style={{ fontSize: 13, color: '#cbd5f5' }}>
            <Link
              href="/login"
              style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
            >
              로그인
            </Link>
            하거나, 가족 초대 링크로{' '}
            <Link href="/join" style={{ color: '#38bdf8', textDecoration: 'none' }}>
              참여
            </Link>
            하세요.
          </div>
        )}

        {user && householdId && (
          <>
            <section
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 12,
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid rgba(51,65,85,0.9)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, color: '#94a3b8' }}>내 이름</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  가족에게 이렇게 보입니다.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="예: 아빠, 엄마, 민수"
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    border: '1px solid #1e293b',
                    padding: '8px 10px',
                    fontSize: 13,
                    background: '#020617',
                    color: '#e5e7eb',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  style={{
                    borderRadius: 999,
                    border: 'none',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: profileSaving ? 'not-allowed' : 'pointer',
                    background: profileSaving
                      ? 'rgba(148,163,184,0.5)'
                      : 'linear-gradient(135deg, #22c55e, #0ea5e9)',
                    color: '#020617',
                    minWidth: 72,
                  }}
                >
                  {profileSaving ? '저장중' : '저장'}
                </button>
              </div>
            </section>

            <section
              style={{
                marginBottom: 20,
                padding: 12,
                borderRadius: 12,
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid rgba(51,65,85,0.9)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: '#64748b',
                  marginBottom: 6,
                }}
              >
                New Log
              </div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                액션 내용
              </label>
              <textarea
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="예: 문 닫음, 약 복용함 등"
                rows={2}
                style={{
                  width: '100%',
                  resize: 'none',
                  borderRadius: 10,
                  border: '1px solid #1e293b',
                  padding: 10,
                  fontSize: 13,
                  background: '#020617',
                  color: '#e5e7eb',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleInsert}
                disabled={loading}
                style={{
                  marginTop: 10,
                  width: '100%',
                  borderRadius: 999,
                  border: 'none',
                  padding: '14px 16px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading
                    ? 'rgba(148,163,184,0.5)'
                    : 'linear-gradient(135deg, #22c55e, #0ea5e9)',
                  color: '#020617',
                  minHeight: 48,
                  boxShadow: '0 12px 30px rgba(34,197,94,0.4)',
                  transition: 'transform 0.08s ease-out, box-shadow 0.08s ease-out',
                }}
              >
                {loading ? '저장 중...' : '이 장소에 로그 남기기'}
              </button>
            </section>

            <section>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 8,
                }}
              >
                <h2 style={{ fontSize: 14, fontWeight: 600 }}>최근 로그 (30)</h2>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  household_id: {householdId.slice(0, 8)}...
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 10,
                  fontSize: 11,
                }}
              >
                <button
                  onClick={() => setSelectedMemberId('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border:
                      selectedMemberId === 'all'
                        ? '1px solid #38bdf8'
                        : '1px solid #1f2937',
                    backgroundColor:
                      selectedMemberId === 'all' ? 'rgba(56,189,248,0.2)' : 'transparent',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  전체
                </button>
                <button
                  onClick={() => setSelectedMemberId('me')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border:
                      selectedMemberId === 'me'
                        ? '1px solid #38bdf8'
                        : '1px solid #1f2937',
                    backgroundColor:
                      selectedMemberId === 'me' ? 'rgba(56,189,248,0.2)' : 'transparent',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  나 ({meDisplayName})
                </button>
                {members
                  .filter((m) => !user || m.user_id !== user.id)
                  .map((m) => {
                    const name =
                      (m.display_name && m.display_name.trim()) ||
                      m.user_id.slice(0, 6);
                    const selected = selectedMemberId === m.user_id;
                    return (
                      <button
                        key={m.user_id}
                        onClick={() => setSelectedMemberId(m.user_id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: selected ? '1px solid #38bdf8' : '1px solid #1f2937',
                          backgroundColor: selected ? 'rgba(56,189,248,0.2)' : 'transparent',
                          color: '#e5e7eb',
                          cursor: 'pointer',
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
              </div>

              <div
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  borderRadius: 12,
                  border: '1px solid rgba(30,41,59,0.9)',
                  background: 'rgba(15,23,42,0.8)',
                  padding: 8,
                }}
              >
                {logs.length === 0 && (
                  <div
                    style={{
                      padding: 16,
                      fontSize: 13,
                      color: '#64748b',
                      textAlign: 'center',
                    }}
                  >
                    아직 로그가 없습니다.
                  </div>
                )}

                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(30,64,175,0.7)',
                      background:
                        'radial-gradient(circle at top left, rgba(59,130,246,0.4), rgba(15,23,42,0.9))',
                      marginBottom: 6,
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#e5e7eb' }}>{log.action}</span>
                      <span style={{ color: '#bae6fd' }}>{log.place_slug}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>
                        {getMemberName(log.actor_user_id)}
                      </span>
                      <span style={{ color: '#9ca3af' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}