'use client';

import { Users } from 'lucide-react';

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

const CHIP_HEIGHT = 40;
const AVATAR_SIZE = 28;

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
    alignItems: 'center',
    gap: 6,
    height: CHIP_HEIGHT,
    padding: '0 14px 0 6px',
    borderRadius: 999,
    border: 'none',
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: 'pointer',
  } as const;

  const avatarWrap = {
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
  };

  return (
    <div
      className="member-filter-scroll"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 14,
        height: CHIP_HEIGHT,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* 전체 */}
      <button
        type="button"
        onClick={() => onSelectMember('all')}
        style={{
          ...chipBase,
          background: isSelected('all') ? 'var(--accent)' : 'transparent',
          color: isSelected('all') ? '#fff' : 'var(--text-primary)',
          border: isSelected('all') ? 'none' : '1.5px solid var(--border-chip)',
        }}
      >
        <span style={{ ...avatarWrap, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
          <Users size={20} strokeWidth={1.5} aria-hidden />
        </span>
        <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('allMembers')}</span>
      </button>

      {/* 나 */}
      <button
        type="button"
        onClick={() => onSelectMember('me')}
        style={{
          ...chipBase,
          background: isSelected('me') ? 'var(--accent)' : 'transparent',
          color: isSelected('me') ? '#fff' : 'var(--text-primary)',
          border: isSelected('me') ? 'none' : '1.5px solid var(--border-chip)',
        }}
      >
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
            ...avatarWrap,
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
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            (meDisplayName || t('me')).slice(0, 1).toUpperCase()
          )}
        </span>
        <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{meDisplayName}</span>
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
              key={m.user_id}
              type="button"
              onClick={() => onSelectMember(m.user_id)}
              style={{
                ...chipBase,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text-primary)',
                border: active ? 'none' : '1.5px solid var(--border-chip)',
              }}
            >
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
                  ...avatarWrap,
                  background: showAvatar ? 'transparent' : 'var(--bg-subtle)',
                  color: showAvatar ? undefined : 'var(--text-secondary)',
                  cursor: showAvatar ? 'pointer' : undefined,
                }}
              >
                {showAvatar ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    onError={() => onMemberAvatarError(m.user_id)}
                    style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  name.slice(0, 1)
                )}
              </span>
              <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            </button>
          );
        })}
    </div>
  );
}
