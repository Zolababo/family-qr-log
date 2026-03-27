/**
 * Sanitize URLs for href=, img/video src=, and @@meta locationUrl.
 * Allows only http(s) whose host is NEXT_PUBLIC_SUPABASE_URL host or NEXT_PUBLIC_MEDIA_ALLOWED_HOSTS.
 * Blocks javascript:, data:, etc. If no allowlist is configured, absolute URLs are rejected (empty string).
 */

function getAllowedMediaHosts(): Set<string> {
  const hosts = new Set<string>();
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (u) hosts.add(new URL(u).host);
  } catch {
    /* ignore */
  }
  const extra = process.env.NEXT_PUBLIC_MEDIA_ALLOWED_HOSTS;
  if (extra) {
    extra.split(',').forEach((h) => {
      const t = h.trim();
      if (t) hosts.add(t);
    });
  }
  return hosts;
}

const allowedHostsCache = getAllowedMediaHosts();

/** Relative app paths only (same-origin). */
export function isSafeRelativePath(raw: string): boolean {
  const s = String(raw ?? '').trim();
  if (!s.startsWith('/') || s.startsWith('//')) return false;
  if (/[\u0000-\u001F\u007F]/.test(s)) return false;
  return true;
}

/**
 * Returns a safe https URL or empty string. Allows http(s) only; host must be in allowlist.
 */
export function sanitizeExternalUrl(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  let candidate = trimmed;
  try {
    if (candidate.startsWith('//')) candidate = `https:${candidate}`;
    const u = new URL(candidate);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    const host = u.hostname.toLowerCase();
    if (allowedHostsCache.size === 0) {
      // If env not set, allow only relative paths elsewhere; block absolute URLs.
      return '';
    }
    if (!allowedHostsCache.has(host)) return '';
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
}

/** For <img>/<video> /media: allowlist + same-origin relative paths. */
export function sanitizeMediaUrl(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (isSafeRelativePath(trimmed)) return trimmed;
  return sanitizeExternalUrl(trimmed);
}

export function sanitizeLocationUrlForMeta(raw: string | null | undefined): string | undefined {
  const s = sanitizeExternalUrl(raw);
  return s || undefined;
}
