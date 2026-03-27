#!/usr/bin/env node
/**
 * Signed invite token generator (same format as src/lib/invite/inviteToken.ts).
 *
 * Usage (PowerShell):
 *   $env:INVITE_SIGNING_SECRET="your_long_secret"
 *   node scripts/generate-invite-token.mjs <household_uuid> [ttl_days]
 *
 * Output: token string to append as ?token=...
 */

import { createHmac } from 'crypto';

const secret = process.env.INVITE_SIGNING_SECRET;
const householdId = process.argv[2];
const ttlDays = Number(process.argv[3] ?? '7') || 7;

if (!secret || secret.length < 16) {
  console.error('Set INVITE_SIGNING_SECRET (min 16 chars).');
  process.exit(1);
}
if (!householdId?.trim()) {
  console.error('Usage: node scripts/generate-invite-token.mjs <household_uuid> [ttl_days]');
  process.exit(1);
}

const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
const payload = { v: 1, householdId: householdId.trim(), exp };
const payloadJson = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
const sig = createHmac('sha256', secret).update(payloadJson).digest('base64url');
const token = `v1.${payloadJson}.${sig}`;
console.log(token);
