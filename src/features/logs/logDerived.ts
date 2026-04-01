import { parseLogMeta } from '@/lib/logActionMeta';
import { LOG_SLUG, normalizeLogSlug } from '@/lib/logTags';
import type { Log } from './logTypes';

const TAG_TEXT_TO_SLUG: Record<string, string> = {
  daily: LOG_SLUG.daily,
  general: LOG_SLUG.general,
  notice: LOG_SLUG.notice,
  daddy: LOG_SLUG.daddy,
  mommy: LOG_SLUG.mommy,
  bamtoli: LOG_SLUG.bamtoli,
  eomniabuji: LOG_SLUG.eomniAbuji,
  motherippadeori: LOG_SLUG.motheriPpadeori,
  danine: LOG_SLUG.danine,
  uchacha: LOG_SLUG.uchacha,
  ttolmorning: LOG_SLUG.ttolMorning,
  일상: LOG_SLUG.daily,
  다같이: LOG_SLUG.general,
  공지사항: LOG_SLUG.notice,
  밤톨대디: LOG_SLUG.daddy,
  밤톨맘: LOG_SLUG.mommy,
  밤톨이: LOG_SLUG.bamtoli,
  엄니아부지: LOG_SLUG.eomniAbuji,
  마더리빠더리: LOG_SLUG.motheriPpadeori,
  단이네: LOG_SLUG.danine,
  우차차: LOG_SLUG.uchacha,
  똘모닝: LOG_SLUG.ttolMorning,
};

export function getParsedLog(log: Log) {
  return parseLogMeta(log.action);
}

function normalizeTagText(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

export function getEffectiveLogSlug(log: Log) {
  const parsed = getParsedLog(log);
  const matches = parsed.text.match(/(^|\s)#([^\s#]+)/g) ?? [];
  for (const match of matches) {
    const tagText = match.replace(/(^|\s)#/, '').trim();
    const mapped = TAG_TEXT_TO_SLUG[normalizeTagText(tagText)];
    if (mapped) return mapped;
  }
  return normalizeLogSlug(log.place_slug);
}

export function isBamtoliLog(log: Log) {
  return getEffectiveLogSlug(log) === LOG_SLUG.bamtoli;
}

export function getLogStickerDisplay(
  log: Log,
  getMemberName: (userId: string) => string
) {
  const { meta } = getParsedLog(log);
  const stickerMap = meta.stickerByUser ?? {};
  const fallbackStickers = meta.stickers ?? [];
  const stickerEntries = Object.entries(stickerMap)
    .filter(([, sticker]) => typeof sticker === 'string' && sticker.trim().length > 0)
    .map(([userId, sticker]) => ({
      userId,
      sticker,
      author: getMemberName(userId),
    }));

  return {
    meta,
    stickerEntries,
    fallbackStickers,
  };
}
