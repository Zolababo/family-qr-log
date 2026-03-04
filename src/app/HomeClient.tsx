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

const PLACES = [
  { slug: 'fridge', label: '냉장고' },
  { slug: 'table', label: '식탁' },
  { slug: 'toilet', label: '화장실' },
] as const;

const getPlaceLabel = (slug: string) => {
  const p = PLACES.find((x) => x.slug === slug);
  return p ? p.label : slug;
};

const getPlaceChipStyle = (slug: string) => {
  switch (slug) {
    case 'fridge':
      return { background: 'rgba(56,189,248,0.25)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.5)' };
    case 'table':
      return { background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.5)' };
    case 'toilet':
      return { background: 'rgba(251,191,36,0.2)', color: '#fde047', border: '1px solid rgba(251,191,36,0.5)' };
    default:
      return { background: 'rgba(148,163,184,0.2)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.4)' };
  }
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const date = d.getDate().toString().padStart(2, '0');
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdayNames[d.getDay()];

  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 || 12;

  return `${year}.${month}.${date} (${weekday}) · ${ampm} ${hour12}:${minutes}`;
};

export default function HomeClient() {
  const searchParams = useSearchParams();
  const placeSlug = searchParams.get('place') ?? 'fridge';

  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<'all' | 'me' | string>('all');
  const [placeScope, setPlaceScope] = useState<'current' | 'all'>('current');
  const [selectedPlaceSlug, setSelectedPlaceSlug] = useState<string>(placeSlug);

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

  useEffect(() => {
    setSelectedPlaceSlug(placeSlug);
  }, [placeSlug]);

  const effectivePlaceSlug = selectedPlaceSlug;

  const loadLogs = useCallback(
    async (hid: string, slug: string | undefined, actorUserId?: string) => {
      let query = supabase
        .from('logs')
        .select('*')
        .eq('household_id', hid)
        .order('created_at', { ascending: false })
        .limit(30);

      if (slug) {
        query = query.eq('place_slug', slug);
      }

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

    const placeFilterSlug = placeScope === 'current' ? effectivePlaceSlug : undefined;

    loadLogs(householdId, placeFilterSlug, actorFilter);
  }, [householdId, effectivePlaceSlug, placeScope, selectedMemberId, user, loadLogs]);

  const handleInsert = async () => {
    if (!user || !householdId) return;

    setLoading(true);
    setStatus(null);

    const { error } = await supabase.from('logs').insert({
      household_id: householdId,
      place_slug: effectivePlaceSlug,
      action: action || 'clicked',
      actor_user_id: user.id,
    });

    if (error) {
      setStatus(`logs insert 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setAction('');
    const placeFilterSlug = placeScope === 'current' ? effectivePlaceSlug : undefined;
    await loadLogs(
      householdId,
      placeFilterSlug,
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
  const placeLabel = getPlaceLabel(effectivePlaceSlug);

  const logsByDate = logs.reduce<{ dateKey: string; dateLabel: string; items: Log[] }[]>((acc, log) => {
    const d = new Date(log.created_at);
    const dateKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dateLabel = `${dateKey.slice(0, 4)}.${dateKey.slice(5, 7)}.${dateKey.slice(8, 10)} (${weekdayNames[d.getDay()]})`;
    let group = acc.find((g) => g.dateKey === dateKey);
    if (!group) {
      group = { dateKey, dateLabel, items: [] };
      acc.push(group);
    }
    group.items.push(log);
    return acc;
  }, []);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <Link
                href="/qr"
                style={{ color: '#38bdf8', textDecoration: 'none' }}
              >
                QR코드
              </Link>
              <Link href="/invite" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                가족초대
              </Link>
              {user && (
                <div
                  title={meDisplayName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(56,189,248,0.15)',
                    border: '1px solid rgba(56,189,248,0.4)',
                    fontSize: 12,
                    color: '#7dd3fc',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'rgba(56,189,248,0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {meDisplayName.slice(0, 1)}
                  </span>
                  <span style={{ maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {meDisplayName}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {PLACES.map((p) => {
              const active = effectivePlaceSlug === p.slug;
              return (
                <button
                  key={p.slug}
                  onClick={() => setSelectedPlaceSlug(p.slug)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: active ? '2px solid #38bdf8' : '1px solid #334155',
                    background: active ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.8)',
                    color: active ? '#7dd3fc' : '#94a3b8',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 0, color: '#94a3b8' }}>
            장소: <span style={{ color: '#e5e7eb' }}>{placeLabel}</span>
          </h1>
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
                {loading ? '저장 중...' : `"${placeLabel}"에 로그 남기기`}
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
                  onClick={() => setPlaceScope('current')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border:
                      placeScope === 'current'
                        ? '1px solid #22c55e'
                        : '1px solid #1f2937',
                    backgroundColor:
                      placeScope === 'current' ? 'rgba(34,197,94,0.2)' : 'transparent',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  이 장소
                </button>
                <button
                  onClick={() => setPlaceScope('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border:
                      placeScope === 'all'
                        ? '1px solid #22c55e'
                        : '1px solid #1f2937',
                    backgroundColor:
                      placeScope === 'all' ? 'rgba(34,197,94,0.2)' : 'transparent',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  모든 장소
                </button>

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
                  maxHeight: 320,
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

                {logsByDate.map((group) => (
                  <div key={group.dateKey} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#64748b',
                        marginBottom: 6,
                        paddingBottom: 4,
                        borderBottom: '1px solid rgba(51,65,85,0.8)',
                      }}
                    >
                      {group.dateLabel}
                    </div>
                    {group.items.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(30,64,175,0.5)',
                          background: 'rgba(15,23,42,0.9)',
                          marginBottom: 6,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: 6 }}>
                          {log.action}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 8,
                            justifyContent: 'space-between',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 999,
                              ...getPlaceChipStyle(log.place_slug),
                            }}
                          >
                            {getPlaceLabel(log.place_slug)}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(51,65,85,0.6)',
                            }}
                          >
                            {getMemberName(log.actor_user_id)}
                          </span>
                        </div>
                      </div>
                    ))}
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