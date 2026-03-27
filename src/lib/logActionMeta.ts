import { sanitizeLocationUrlForMeta } from './safeUrl';

export type LogMeta = {
  locationName?: string;
  locationUrl?: string;
  stickers?: string[];
  stickerByUser?: Record<string, string>;
};

function sanitizeMeta(meta: LogMeta): LogMeta {
  const locationUrl = sanitizeLocationUrlForMeta(meta.locationUrl);
  return {
    ...meta,
    ...(locationUrl ? { locationUrl } : { locationUrl: undefined }),
  };
}

export function parseLogMeta(actionText: string): { text: string; meta: LogMeta } {
  const safeText = String(actionText ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const marker = '\n@@meta:';
  const idx = safeText.lastIndexOf(marker);
  if (idx < 0) return { text: safeText, meta: {} };
  const text = safeText.slice(0, idx).trim();
  const raw = safeText.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(raw) as LogMeta;
    return { text, meta: sanitizeMeta(parsed ?? {}) };
  } catch {
    // meta 파싱이 깨져도 본문 텍스트는 노출되도록 유지
    return { text, meta: {} };
  }
}

export function composeActionWithMeta(text: string, meta: LogMeta): string {
  const cleanText = text.trim() || 'clicked';
  const safeMeta = sanitizeMeta(meta);
  const hasMeta = !!(
    safeMeta.locationName ||
    safeMeta.locationUrl ||
    (safeMeta.stickers && safeMeta.stickers.length > 0) ||
    (safeMeta.stickerByUser && Object.keys(safeMeta.stickerByUser).length > 0)
  );
  if (!hasMeta) return cleanText;
  return `${cleanText}\n@@meta:${JSON.stringify(safeMeta)}`;
}
