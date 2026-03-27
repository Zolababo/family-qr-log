import { NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/invite/inviteToken';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const token = typeof (body as { token?: unknown })?.token === 'string' ? (body as { token: string }).token : '';
  if (!token.trim()) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }
  const payload = verifyInviteToken(token.trim());
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 });
  }
  return NextResponse.json({ householdId: payload.householdId, exp: payload.exp });
}
