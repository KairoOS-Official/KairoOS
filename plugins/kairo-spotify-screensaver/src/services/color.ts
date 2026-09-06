import { getColor } from 'colorthief';

export interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  isDark: boolean;
}

const colorCache = new Map<string, ExtractedColor>();

/**
 * Calcule si une couleur RGB est sombre ou claire
 */
export function isColorDark(r: number, g: number, b: number): boolean {
  // Formule de luminance relative standard ITU-R BT.709
  const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return luminance < 0.5;
}

/**
 * Convertit RGB en Hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extrait la couleur dominante d'une image avec ColorThief (et fallback canvas)
 */
export async function extractDominantColor(imageUrl?: string): Promise<ExtractedColor> {
  const fallback: ExtractedColor = {
    hex: '#1e293b',
    rgb: [30, 41, 59],
    isDark: true,
  };

  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    return fallback;
  }

  const cached = colorCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  return new Promise<ExtractedColor>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    let resolved = false;
    const safeResolve = (res: ExtractedColor) => {
      if (!resolved) {
        resolved = true;
        colorCache.set(imageUrl, res);
        resolve(res);
      }
    };

    const timer = setTimeout(() => {
      safeResolve(fallback);
    }, 4000);

    img.onload = async () => {
      clearTimeout(timer);
      try {
        if (typeof getColor === 'function') {
          const c: any = await getColor(img);
          if (c) {
            let r = 0, g = 0, b = 0;
            if (typeof c.rgb === 'function') {
              const [cr, cg, cb] = c.rgb();
              r = cr; g = cg; b = cb;
            } else if (Array.isArray(c)) {
              [r, g, b] = c;
            } else if (c.r !== undefined) {
              r = c.r; g = c.g; b = c.b;
            }
            const hex = typeof c.hex === 'function' ? c.hex() : rgbToHex(r, g, b);
            safeResolve({
              hex,
              rgb: [r, g, b],
              isDark: isColorDark(r, g, b),
            });
            return;
          }
        }
      } catch (_) {
        // Fallback to Canvas
      }

      // Essai 3 : Fallback direct via Canvas HTML5 (rapide et robuste)
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 16, 16);
          const data = ctx.getImageData(0, 0, 16, 16).data;
          let totalR = 0, totalG = 0, totalB = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
            count++;
          }
          if (count > 0) {
            const r = Math.round(totalR / count);
            const g = Math.round(totalG / count);
            const b = Math.round(totalB / count);
            safeResolve({
              hex: rgbToHex(r, g, b),
              rgb: [r, g, b],
              isDark: isColorDark(r, g, b),
            });
            return;
          }
        }
      } catch (_) {}

      safeResolve(fallback);
    };

    img.onerror = () => {
      clearTimeout(timer);
      safeResolve(fallback);
    };

    img.src = imageUrl;
  });
}
