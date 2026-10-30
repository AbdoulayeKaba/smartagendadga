const processedCache = new Map<string, string>();

const WHITE_THRESHOLD = 238;
const FEATHER = 20;

/**
 * Rend transparents les pixels quasi blancs (fond JPEG/PNG des logos institutionnels).
 */
export function stripLogoWhiteBackground(
  img: HTMLImageElement,
  threshold = WHITE_THRESHOLD,
  feather = FEATHER
): string | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const minChannel = Math.min(r, g, b);
    const maxChannel = Math.max(r, g, b);
    const saturation = maxChannel - minChannel;

    if (minChannel >= threshold && saturation < 36) {
      data[i + 3] = 0;
      continue;
    }

    if (minChannel >= threshold - feather && saturation < 48) {
      const t = (threshold - minChannel) / feather;
      data[i + 3] = Math.round(Math.max(0, Math.min(255, t * data[i + 3])));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function getCachedLogoSrc(src: string): string | undefined {
  return processedCache.get(src);
}

export function cacheProcessedLogoSrc(src: string, processed: string): void {
  processedCache.set(src, processed);
}

export async function loadLogoWithoutWhiteBackground(src: string): Promise<string> {
  const cached = processedCache.get(src);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const processed = stripLogoWhiteBackground(img);
      const result = processed ?? src;
      if (processed) processedCache.set(src, processed);
      resolve(result);
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
