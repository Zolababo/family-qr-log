type CompressOptions = {
  maxSide?: number;
  quality?: number;
};

const DEFAULT_MAX_IMAGE_SIDE = 1080;
const DEFAULT_JPEG_QUALITY = 0.8;

export function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<{ file: File; previewUrl: string }> {
  const maxSide = options.maxSide ?? DEFAULT_MAX_IMAGE_SIDE;
  const quality = options.quality ?? DEFAULT_JPEG_QUALITY;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > maxSide || h > maxSide) {
        if (w >= h) {
          h = Math.round((h * maxSide) / w);
          w = maxSide;
        } else {
          w = Math.round((w * maxSide) / h);
          h = maxSide;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('blob'));
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
          const out = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
          resolve({ file: out, previewUrl: URL.createObjectURL(blob) });
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load'));
    };
    img.src = url;
  });
}

export const VIDEO_MAX_MB = 20;
