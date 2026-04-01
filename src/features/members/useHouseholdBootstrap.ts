'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/app/api/supabaseClient';
import type { Member } from './memberTypes';
import { mergeMembersPreferIncoming } from './memberUtils';

type UseHouseholdBootstrapArgs = {
  setUser: (user: User) => void;
  setHouseholdId: (householdId: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setProfileName: (name: string) => void;
  setProfileAvatarUrl: (url: string | null) => void;
  setProfileAvatarLoadFailed: (failed: boolean) => void;
  setMembers: Dispatch<SetStateAction<Member[]>>;
  onError: (message: string) => void;
  onStart?: () => void;
};

export function useHouseholdBootstrap({
  setUser,
  setHouseholdId,
  setIsAdmin,
  setProfileName,
  setProfileAvatarUrl,
  setProfileAvatarLoadFailed,
  setMembers,
  onError,
  onStart,
}: UseHouseholdBootstrapArgs) {
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      onStart?.();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (cancelled) return;
        onError('로그인이 필요합니다.');
        return;
      }

      if (cancelled) return;
      setUser(user);

      let myMembers: { household_id: string; display_name: string | null; user_id: string; avatar_url?: string | null; role?: string }[] | null = null;
      let memberError: { message: string } | null = null;

      const res = await supabase
        .from('members')
        .select('household_id, display_name, user_id, avatar_url, role')
        .eq('user_id', user.id)
        .limit(1);

      myMembers = res.data;
      memberError = res.error;

      if (memberError && /avatar_url|role|does not exist|column/i.test(memberError.message)) {
        const fallback = await supabase
          .from('members')
          .select('household_id, display_name, user_id')
          .eq('user_id', user.id)
          .limit(1);
        myMembers = fallback.data;
        memberError = fallback.error;
      }

      if (cancelled) return;
      if (memberError) {
        onError(`members 조회 실패: ${memberError.message}`);
        return;
      }

      const myMember = myMembers?.[0];
      if (!myMember) {
        onError('members 조회 실패: row 없음 (members 테이블에 user_id 확인)');
        return;
      }

      if (cancelled) return;
      setHouseholdId(myMember.household_id);
      setIsAdmin((myMember as { role?: string }).role === 'master');

      const baseName = (myMember.display_name && myMember.display_name.trim()) || (user.email ? user.email.split('@')[0] : '나');
      setProfileName(baseName);
      const initialAvatar = 'avatar_url' in myMember ? (myMember.avatar_url ?? null) : null;
      setProfileAvatarUrl(initialAvatar);
      setProfileAvatarLoadFailed(false);

      let allMembers: { user_id: string; display_name: string | null; avatar_url?: string | null }[] | null = null;
      let allMembersError: { message: string } | null = null;

      const allRes = await supabase
        .from('members')
        .select('user_id, display_name, avatar_url')
        .eq('household_id', myMember.household_id);

      allMembers = allRes.data;
      allMembersError = allRes.error;

      if (allMembersError && /avatar_url|does not exist|column/i.test(allMembersError.message)) {
        const fallbackAll = await supabase
          .from('members')
          .select('user_id, display_name')
          .eq('household_id', myMember.household_id);
        allMembers = fallbackAll.data;
        allMembersError = fallbackAll.error;
      }

      if (cancelled) return;
      if (!allMembersError && allMembers) {
        setMembers((prev) =>
          mergeMembersPreferIncoming(prev, [
            {
              user_id: myMember.user_id,
              display_name: myMember.display_name,
              avatar_url: 'avatar_url' in myMember ? (myMember.avatar_url ?? null) : null,
            },
            ...allMembers,
          ])
        );
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [
    setUser,
    setHouseholdId,
    setIsAdmin,
    setProfileName,
    setProfileAvatarUrl,
    setProfileAvatarLoadFailed,
    setMembers,
    onError,
    onStart,
  ]);
}
