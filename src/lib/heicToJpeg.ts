/** 갤러리에서 MIME이 비어 있어도 확장자로 허용하는 이미지 (모바일 카메라·앨범) */
export const MOBILE_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'avif',
  'bmp',
  'tif',
  'tiff',
] as const;

/**
 * HEIC/HEIF는 브라우저 `<img>`/캔버스에서 디코딩되지 않는 경우가 많아
 * 업로드 전 JPEG로 바꿉니다. (프로필 아바타와 동일한 heic2any 경로)
 */
export function isHeicOrHeif(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name) ||
    ext === 'heic' ||
    ext === 'heif'
  );
}

export async function convertHeicLikeToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({ blob: file, toType: 'image/jpeg' });
  const blob = result instanceof Blob ? result : Array.isArray(result) ? result[0] : result;
  if (!blob) throw new Error('HEIC conversion failed');
  const base = file.name.replace(/\.[^.]+$/i, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
