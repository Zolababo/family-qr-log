export type LogMeta = {
  locationName?: string;
  locationUrl?: string;
  stickers?: string[];
  stickerByUser?: Record<string, string>;
};

export function parseLogMeta(actionText: string): { text: string; meta: LogMeta } {
  const marker = '\n@@meta:';
  const idx = actionText.lastIndexOf(marker);
  if (idx < 0) return { text: actionText, meta: {} };
  const text = actionText.slice(0, idx).trim();
  const raw = actionText.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(raw) as LogMeta;
    return { text, meta: parsed ?? {} };
  } catch {
    return { text: actionText, meta: {} };
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
