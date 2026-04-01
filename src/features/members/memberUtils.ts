import type { Member } from './memberTypes';

function scoreMember(member: Member) {
  let score = 0;
  if (member.display_name && member.display_name.trim()) score += 1;
  if (member.avatar_url && member.avatar_url.trim()) score += 1;
  return score;
}

export function mergeMembersPreferIncoming(prev: Member[], incoming: Member[]) {
  if (incoming.length === 0) return prev;

  const byId = new Map<string, Member>();
  for (const member of prev) {
    byId.set(member.user_id, member);
  }
  for (const member of incoming) {
    const existing = byId.get(member.user_id);
    if (!existing || scoreMember(member) >= scoreMember(existing)) {
      byId.set(member.user_id, {
        ...existing,
        ...member,
      });
    }
  }

  return Array.from(byId.values());
}
