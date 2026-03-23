'use client';

import { Users } from 'lucide-react';
import type { CSSProperties } from 'react';

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
const AVATAR_RING_PAD = 6;

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

  const chipBase = {
    display: 'inline-flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
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

  const avatarRingStyle = (selected: boolean): CSSProperties => ({
    width: selected ? AVATAR_SIZE + AVATAR_RING_PAD * 2 : AVATAR_SIZE,
    height: selected ? AVATAR_SIZE + AVATAR_RING_PAD * 2 : AVATAR_SIZE,
    borderRadius: 999,
    padding: selected ? AVATAR_RING_PAD : 0,
    background: selected ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
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
      {/* 전체 */}
      <button
        className="profile-chip-btn"
        type="button"
        onClick={() => onSelectMember('all')}
        style={{
          ...chipBase,
          color: isSelected('all') ? 'var(--accent)' : 'var(--text-primary)',
          border: 'none',
        }}
      >
        <span
          aria-hidden
          style={avatarRingStyle(isSelected('all'))}
        >
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
        <span style={{ fontSize: 12, lineHeight: 1.1 }}>{t('allMembers')}</span>
      </button>

      {/* 나 */}
      <button
        className="profile-chip-btn"
        type="button"
        onClick={() => onSelectMember('me')}
        style={{
          ...chipBase,
          color: isSelected('me') ? 'var(--accent)' : 'var(--text-primary)',
          border: 'none',
        }}
      >
        <span style={avatarRingStyle(isSelected('me'))}>
                  <span
                    role="button"
                    tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (profileAvatarUrl && !profileAvatarLoadFailed) onEnlargeAvatar(profileAvatarUrl);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (profileAvatarUrl && !profileAvatarLoadFailed) onEnlargeAvatar(profileAvatarUrl);
              }
            }}
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
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block', borderRadius: '50%' }}
              />
            ) : (
              (meDisplayName || t('me')).slice(0, 1).toUpperCase()
            )}
          </span>
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.1, marginTop: 2, color: isSelected('me') ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {meDisplayName}
        </span>
      </button>

      {members
        .filter((m) => m.user_id !== user.id)
        .map((m) => {
          const name = (m.display_name && m.display_name.trim()) || m.user_id.slice(0, 6);
          const active = isSelected(m.user_id);
          const avatarUrl = m.avatar_url ?? null;
          const avatarFailed = avatarFailedUserIds.has(m.user_id);
          const showAvatar = avatarUrl && !avatarFailed;
          return (
            <button
              className="profile-chip-btn"
              key={m.user_id}
              type="button"
              onClick={() => onSelectMember(m.user_id)}
              style={{
                ...chipBase,
                color: active ? 'var(--accent)' : 'var(--text-primary)',
                border: 'none',
              }}
            >
              <span style={avatarRingStyle(active)}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showAvatar && avatarUrl) onEnlargeAvatar(avatarUrl);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (showAvatar && avatarUrl) onEnlargeAvatar(avatarUrl);
                    }
                  }}
                  style={{
                    ...avatarInnerWrap,
                    background: showAvatar ? 'transparent' : 'var(--accent)',
                    color: showAvatar ? undefined : '#fff',
                    cursor: showAvatar ? 'pointer' : undefined,
                  }}
                >
                  {showAvatar ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      onError={() => onMemberAvatarError(m.user_id)}
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block', borderRadius: '50%' }}
                    />
                  ) : (
                    name.slice(0, 1)
                  )}
                </span>
              </span>
              <span style={{ fontSize: 12, lineHeight: 1.1, marginTop: 2, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {name}
              </span>
            </button>
          );
        })}
    </div>
  );
}
