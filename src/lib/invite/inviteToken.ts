import { createHmac, timingSafeEqual } from 'crypto';

export type InvitePayload = { v: 1; householdId: string; exp: number };

function getSecret(): string {
  const s = process.env.INVITE_SIGNING_SECRET;
  if (!s || s.length < 16) {
    throw new Error('INVITE_SIGNING_SECRET is not configured');
  }
  return s;
}

function getSecretOptional(): string | null {
  const s = process.env.INVITE_SIGNING_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

/** exp: Unix seconds */
export function signInviteToken(payload: InvitePayload): string {
  const secret = getSecret();
  const payloadJson = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadJson).digest('base64url');
  return `v1.${payloadJson}.${sig}`;
}

const MAX_INVITE_TOKEN_CHARS = 4096;

export function verifyInviteToken(token: string): InvitePayload | null {
  const secret = getSecretOptional();
  if (!secret) return null;
  if (token.length > MAX_INVITE_TOKEN_CHARS) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, payloadJson, sig] = parts;
  if (!payloadJson || !sig) return null;
  const expected = createHmac('sha256', secret).update(payloadJson).digest('base64url');
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadJson, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (typeof p.householdId !== 'string' || !p.householdId.trim()) return null;
  if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null;
  if (p.exp < Math.floor(Date.now() / 1000)) return null;
  return { v: 1, householdId: p.householdId.trim(), exp: p.exp };
}
