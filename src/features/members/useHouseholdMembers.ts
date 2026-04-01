'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import type { Member } from './memberTypes';

type UseHouseholdMembersResult = {
  members: Member[];
  setMembers: Dispatch<SetStateAction<Member[]>>;
  profileName: string;
  setProfileName: Dispatch<SetStateAction<string>>;
  profileAvatarUrl: string | null;
  setProfileAvatarUrl: Dispatch<SetStateAction<string | null>>;
  profileAvatarLoadFailed: boolean;
  setProfileAvatarLoadFailed: Dispatch<SetStateAction<boolean>>;
  avatarFailedUserIds: Set<string>;
  setAvatarFailedUserIds: Dispatch<SetStateAction<Set<string>>>;
  reloadMembersList: (householdId: string | null) => Promise<void>;
  applyOwnDisplayName: (userId: string, displayName: string) => void;
  applyOwnAvatarUrl: (userId: string, avatarUrl: string) => void;
};

export function useHouseholdMembers(): UseHouseholdMembersResult {
  const [members, setMembers] = useState<Member[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileAvatarLoadFailed, setProfileAvatarLoadFailed] = useState(false);
  const [avatarFailedUserIds, setAvatarFailedUserIds] = useState<Set<string>>(new Set());

  const reloadMembersList = useCallback(async (householdId: string | null) => {
    if (!householdId) return;
    const allRes = await supabase.from('members').select('user_id, display_name, avatar_url').eq('household_id', householdId);
    if (allRes.error && /avatar_url|does not exist|column/i.test(allRes.error.message ?? '')) {
      const fb = await supabase.from('members').select('user_id, display_name').eq('household_id', householdId);
      if (!fb.error && fb.data) setMembers(fb.data);
      return;
    }
    if (!allRes.error && allRes.data) setMembers(allRes.data);
  }, []);

  const applyOwnDisplayName = useCallback((userId: string, displayName: string) => {
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, display_name: displayName } : m)));
  }, []);

  const applyOwnAvatarUrl = useCallback((userId: string, avatarUrl: string) => {
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, avatar_url: avatarUrl } : m)));
  }, []);

  return {
    members,
    setMembers,
    profileName,
    setProfileName,
    profileAvatarUrl,
    setProfileAvatarUrl,
    profileAvatarLoadFailed,
    setProfileAvatarLoadFailed,
    avatarFailedUserIds,
    setAvatarFailedUserIds,
    reloadMembersList,
    applyOwnDisplayName,
    applyOwnAvatarUrl,
  };
}
