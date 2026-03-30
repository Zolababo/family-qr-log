import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { VIDEO_MAX_MB } from './imageCompress';

/** Below this size, skip transcoding (saves load time on tiny clips). */
const SKIP_BELOW_BYTES = 700 * 1024;
const MAX_SIDE = 1280;
const EXEC_TIMEOUT_MS = 5 * 60 * 1000;

let ffmpegReady: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (typeof window === 'undefined') {
    throw new Error('compressVideoForUpload must run in the browser');
  }
  if (ffmpegReady) return ffmpegReady;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    ffmpegReady = ffmpeg;
    return ffmpeg;
  })();
  return loadPromise;
}

function inputExt(file: File): string {
  const n = file.name.split('.').pop()?.toLowerCase() || '';
  if (n && /^[a-z0-9]+$/.test(n)) return n;
  return 'mp4';
}

async function safeDelete(ffmpeg: FFmpeg, path: string) {
  await ffmpeg.deleteFile(path).catch(() => {});
}

/**
 * Re-encode video to H.264/AAC MP4 with a max width, for smaller storage uploads.
 * On failure or if output would not help, returns the original file.
 */
export async function compressVideoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('video/')) return file;
  if (file.size < SKIP_BELOW_BYTES) return file;

  const maxBytes = VIDEO_MAX_MB * 1024 * 1024;

  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await getFFmpeg();
  } catch {
    return file;
  }

  const { fetchFile } = await import('@ffmpeg/util');
  const inName = `in.${inputExt(file)}`;
  const outName = 'out.mp4';

  try {
    await ffmpeg.writeFile(inName, await fetchFile(file));

    const vf = `scale='min(${MAX_SIDE},iw)':-2`;
    const base = [
      '-i',
      inName,
      '-vf',
      vf,
      '-pix_fmt',
      'yuv420p',
      '-c:v',
      'libx264',
      '-crf',
      '28',
      '-preset',
      'veryfast',
      '-movflags',
      '+faststart',
    ];

    let code = await ffmpeg.exec([...base, '-c:a', 'aac', '-b:a', '96k', outName], EXEC_TIMEOUT_MS);
    if (code !== 0) {
      await safeDelete(ffmpeg, outName);
      code = await ffmpeg.exec([...base, '-an', outName], EXEC_TIMEOUT_MS);
    }
    if (code !== 0) {
      await safeDelete(ffmpeg, inName);
      await safeDelete(ffmpeg, outName);
      return file;
    }

    const data = await ffmpeg.readFile(outName);
    await safeDelete(ffmpeg, inName);
    await safeDelete(ffmpeg, outName);

    if (!(data instanceof Uint8Array)) return file;
    const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
    const out = new File([blob], `${baseName}.mp4`, { type: 'video/mp4' });

    if (out.size > maxBytes && file.size <= maxBytes) return file;
    if (out.size >= file.size) return file;
    return out;
  } catch {
    await safeDelete(ffmpeg, inName);
    await safeDelete(ffmpeg, outName);
    return file;
  }
}
