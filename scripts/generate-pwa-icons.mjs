/**
 * scripts/pwa-icon-source.png → public/ PWA 아이콘 (정확한 픽셀 크기)
 * - any: 192 / 512 (manifest, 홈 화면)
 * - maskable: 512, 본문은 캔버스의 80% 안에 배치 (원형·둥근 사각 마스크 대비)
 * - apple-touch-icon: 180×180
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'scripts', 'pwa-icon-source.png');

/** 아이콘 배경(크림) — 소스 여백과 맞춤 */
const BG = { r: 247, g: 243, b: 234, alpha: 1 };

const pngOut = () => ({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 });

function squareIcon(size) {
  return sharp(src).resize(size, size, { fit: 'contain', background: BG }).png(pngOut());
}

async function writeMaskable512(outPath) {
  const safe = Math.floor(512 * 0.8);
  const inner = await sharp(src).resize(safe, safe, { fit: 'inside', background: BG }).toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BG },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png(pngOut())
    .toFile(outPath);
}

async function main() {
  if (!existsSync(src)) {
    console.error('Missing scripts/pwa-icon-source.png — add the square master artwork first.');
    process.exit(1);
  }

  await squareIcon(192).toFile(join(root, 'public', 'icon-192.png'));
  await squareIcon(512).toFile(join(root, 'public', 'icon-512.png'));
  await writeMaskable512(join(root, 'public', 'icon-maskable-512.png'));
  await squareIcon(180).toFile(join(root, 'public', 'apple-touch-icon.png'));
  await squareIcon(192).toFile(join(root, 'public', 'icon.png'));

  console.log('OK: public/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, icon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
