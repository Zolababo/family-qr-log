import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signInviteToken } from '@/lib/invite/inviteToken';

const INVITE_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const accessToken = auth?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: members, error: memErr } = await supabase.from('members').select('household_id').eq('user_id', user.id).limit(1);
  if (memErr || !members?.[0]?.household_id) {
    return NextResponse.json({ error: 'No household membership' }, { status: 400 });
  }

  const householdId = members[0].household_id as string;
  const exp = Math.floor(Date.now() / 1000) + INVITE_TTL_SEC;

  let token: string;
  try {
    token = signInviteToken({ v: 1, householdId, exp });
  } catch {
    return NextResponse.json({ error: 'Invite signing not configured (INVITE_SIGNING_SECRET)' }, { status: 503 });
  }

  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const inviteUrl = `${origin}/join?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ inviteUrl, exp });
}
