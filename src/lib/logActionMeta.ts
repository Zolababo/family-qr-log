export type LogMeta = {
  locationName?: string;
  locationUrl?: string;
  stickers?: string[];
  stickerByUser?: Record<string, string>;
};

export function parseLogMeta(actionText: string): { text: string; meta: LogMeta } {
  const safeText = String(actionText ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const marker = '\n@@meta:';
  const idx = safeText.lastIndexOf(marker);
  if (idx < 0) return { text: safeText, meta: {} };
  const text = safeText.slice(0, idx).trim();
  const raw = safeText.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(raw) as LogMeta;
    return { text, meta: parsed ?? {} };
  } catch {
    // meta 파싱이 깨져도 본문 텍스트는 노출되도록 유지
    return { text, meta: {} };
  }
}

export function composeActionWithMeta(text: string, meta: LogMeta): string {
  const cleanText = text.trim() || 'clicked';
  const hasMeta = !!(
    meta.locationName ||
    meta.locationUrl ||
    (meta.stickers && meta.stickers.length > 0) ||
    (meta.stickerByUser && Object.keys(meta.stickerByUser).length > 0)
  );
  if (!hasMeta) return cleanText;
  return `${cleanText}\n@@meta:${JSON.stringify(meta)}`;
}
