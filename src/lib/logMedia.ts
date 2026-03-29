/**
 * Supabase `logs` 행에서 이미지 URL 목록·영상 URL을 정규화합니다.
 * `image_urls`가 JSON 문자열·깨진 JSON일 때도 가능한 한 URL을 꺼냅니다.
 */

export type LogMediaFields = {
  image_url?: string | null;
  image_urls?: string | string[] | null;
  video_url?: string | null;
};

export type LogMediaResult = { imageUrls: string[]; videoUrl: string | null };

export function getLogMedia(log: LogMediaFields): LogMediaResult {
  let imageUrls: string[] = [];
  const raw = log.image_urls;
  if (Array.isArray(raw)) {
    imageUrls = raw.filter((u): u is string => typeof u === 'string');
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      imageUrls = Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
    } catch {
      const matches = raw.match(/https?:\/\/[^\s",)]+/g);
      const escapedMatches = raw.match(/https?:\\\/\\\/[^\s",)]+/g)?.map((u) => u.replace(/\\\//g, '/'));
      const merged = [...(matches ?? []), ...(escapedMatches ?? [])];
      if (merged.length > 0) imageUrls = merged;
    }
  }
  if (imageUrls.length === 0 && log.image_url) imageUrls = [log.image_url];
  const videoUrl = log.video_url && log.video_url.trim() ? log.video_url : null;
  return { imageUrls, videoUrl };
}
