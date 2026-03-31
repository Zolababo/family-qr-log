'use client';

import { Users } from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';

type Member = {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
};

type MemberFilterProps = {
  user: { id: string };
  members: Member[];
  selectedMemberId: 'all' | 'me' | string;
  onSelectMember: (id: 'all' | 'me' | string) => void;
  t: (key: string) => string;
  meDisplayName: string;
  profileAvatarUrl: string | null;
  profileAvatarLoadFailed: boolean;
  onEnlargeAvatar: (url: string) => void;
  avatarFailedUserIds: Set<string>;
  onProfileAvatarError: () => void;
  onMemberAvatarError: (userId: string) => void;
};

const CHIP_HEIGHT = 78;
const AVATAR_SIZE = 58;
/** 선택 링 두께. 바깥 링 크기는 항상 고정해 이름 줄 위치가 흔들리지 않게 한다. */
const RING_WIDTH = 2;
const AVATAR_RING_OUTER = AVATAR_SIZE + RING_WIDTH * 2;
/** 선택·비선택 동일 — 아바타+링이 들어갈 고정 슬롯 (이름 줄 세로 위치 맞춤) */
const AVATAR_SLOT_SIZE = 70;

export function MemberFilter({
  user,
  members,
  selectedMemberId,
  onSelectMember,
  t,
  meDisplayName,
  profileAvatarUrl,
  profileAvatarLoadFailed,
  onEnlargeAvatar,
  avatarFailedUserIds,
  onProfileAvatarError,
  onMemberAvatarError,
}: MemberFilterProps) {
  const isSelected = (id: string) => selectedMemberId === id;

  const chipKeyActivate =
    (id: 'all' | 'me' | string) =>
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectMember(id);
      }
    };

  const chipBase = {
    display: 'inline-flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    minHeight: CHIP_HEIGHT,
    padding: '4px 8px 6px',
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: 'pointer',
    minWidth: 104,
    outline: 'none',
    boxShadow: 'none',
  } as const;

  const avatarInnerWrap = {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: '50%',
    overflow: 'hidden' as const,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 600,
    background: 'var(--bg-base)',
    color: '#fff',
  };

  const avatarSlotStyle: CSSProperties = {
    width: AVATAR_SLOT_SIZE,
    height: AVATAR_SLOT_SIZE,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
  };

  /** 62×62 고정 — 선택 시에만 기존의 포근한 그라데이션 링을 보여 준다. */
  const avatarRingOuterStyle = (selected: boolean): CSSProperties => ({
    width: AVATAR_RING_OUTER,
    height: AVATAR_RING_OUTER,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    padding: RING_WIDTH,
    background: selected ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
  });

  const memberLabelStyle = (selected: boolean): CSSProperties => ({
    fontSize: 12,
    lineHeight: 1.25,
    minHeight: 16,
    maxHeight: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: selected ? 'var(--accent)' : 'var(--text-secondary)',
  });

  return (
    <div
      className="member-filter-scroll"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
        width: '100%',
        minHeight: CHIP_HEIGHT,
        paddingTop: 0,
        paddingBottom: 0,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* 전체 — iOS 가로 스크롤 안의 <button> 탭 누락 이슈 회피용 div+role */}
      <div
        role="button"
        tabIndex={0}
        className="profile-chip-btn"
        onClick={() => onSelectMember('all')}
        onKeyDown={chipKeyActivate('all')}
        aria-pressed={isSelected('all')}
        style={{
          ...chipBase,
          border: 'none',
        }}
      >
        <span aria-hidden style={avatarSlotStyle}>
          <span style={avatarRingOuterStyle(isSelected('all'))}>
            <span
              style={{
                ...avatarInnerWrap,
                background: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Users size={20} strokeWidth={1.5} aria-hidden />
            </span>
          </span>
        </span>
        <span style={memberLabelStyle(isSelected('all'))}>{t('allMembers')}</span>
      </div>

      {/* 나 */}
      <div
        role="button"
        tabIndex={0}
        className="profile-chip-btn"
        onClick={() => onSelectMember('me')}
        onKeyDown={chipKeyActivate('me')}
        aria-pressed={isSelected('me')}
        style={{
          ...chipBase,
          border: 'none',
        }}
      >
        <span style={avatarSlotStyle}>
          <span style={avatarRingOuterStyle(isSelected('me'))}>
            <span
              style={{
                ...avatarInnerWrap,
                background: profileAvatarUrl && !profileAvatarLoadFailed ? 'transparent' : 'var(--accent)',
                color: profileAvatarUrl && !profileAvatarLoadFailed ? undefined : '#fff',
                cursor: profileAvatarUrl && !profileAvatarLoadFailed ? 'pointer' : undefined,
              }}
            >
            {profileAvatarUrl && !profileAvatarLoadFailed ? (
              <img
                src={profileAvatarUrl}
                alt=""
                onError={onProfileAvatarError}
                onClick={(e) => {
                  e.stopPropagation();
                  onEnlargeAvatar(profileAvatarUrl);
                }}
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block', borderRadius: '50%' }}
              />
            ) : (
              (meDisplayName || t('me')).slice(0, 1).toUpperCase()
            )}
            </span>
          </span>
        </span>
        <span style={memberLabelStyle(isSelected('me'))}>{meDisplayName}</span>
      </div>

      {members
        .filter((m) => m.user_id !== user.id)
        .map((m) => {
          const name = (m.display_name && m.display_name.trim()) || m.user_id.slice(0, 6);
          const active = isSelected(m.user_id);
          const avatarUrl = m.avatar_url ?? null;
          const avatarFailed = avatarFailedUserIds.has(m.user_id);
          const showAvatar = avatarUrl && !avatarFailed;
          return (
            <div
              role="button"
              tabIndex={0}
              className="profile-chip-btn"
              key={m.user_id}
              onClick={() => onSelectMember(m.user_id)}
              onKeyDown={chipKeyActivate(m.user_id)}
              aria-pressed={active}
              style={{
                ...chipBase,
                border: 'none',
              }}
            >
              <span style={avatarSlotStyle}>
                <span style={avatarRingOuterStyle(active)}>
                  <span
                    style={{
                      ...avatarInnerWrap,
                      background: showAvatar ? 'transparent' : 'var(--accent)',
                      color: showAvatar ? undefined : '#fff',
                      cursor: showAvatar ? 'pointer' : undefined,
                    }}
                  >
                  {showAvatar ? (
                    <img
                      src={avatarUrl!}
                      alt=""
                      onError={() => onMemberAvatarError(m.user_id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnlargeAvatar(avatarUrl!);
                      }}
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block', borderRadius: '50%' }}
                    />
                  ) : (
                    name.slice(0, 1)
                  )}
                  </span>
                </span>
              </span>
              <span style={memberLabelStyle(active)}>{name}</span>
            </div>
          );
        })}
    </div>
  );
}
