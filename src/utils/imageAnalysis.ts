import chroma from 'chroma-js';

export interface ExtractedColor {
  hex: string;
  isSwatch: boolean; // High uniformity region = likely an intentional swatch
}

export interface ExtractedColorData {
  topColors: ExtractedColor[];     // Top 6 most prominent
  additionalColors: ExtractedColor[]; // Remaining extracted colors
  totalSwatches: number;           // How many swatch-like regions detected
}

/**
 * Extract colors from an image using canvas pixel sampling.
 * Returns top 6 most prominent + additional colors (up to ~48 more).
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedColorData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Scale down for performance
        const maxSize = 300;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Sample pixels and bucket them
        const colorMap = new Map<string, number>();
        const step = 2; // Sample every 2nd pixel

        for (let i = 0; i < pixels.length; i += 4 * step) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          if (a < 128) continue;

          // Quantize to reduce color space (round to nearest 12)
          const qr = Math.round(r / 12) * 12;
          const qg = Math.round(g / 12) * 12;
          const qb = Math.round(b / 12) * 12;

          const key = `${qr},${qg},${qb}`;
          colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }

        // Sort by frequency
        const sorted = [...colorMap.entries()]
          .sort((a, b) => b[1] - a[1]);

        // Total pixels sampled for swatch detection threshold
        const totalSampled = sorted.reduce((sum, [, count]) => sum + count, 0);
        const swatchThreshold = totalSampled * 0.005; // 0.5% of pixels = likely a swatch

        // Extract all distinct colors with minimum distance
        const allColors: ExtractedColor[] = [];
        const minDistanceTop = 20;
        const minDistanceAdditional = 12;
        const maxTotal = 60;
        let swatchCount = 0;

        for (const [key, count] of sorted) {
          if (allColors.length >= maxTotal) break;

          const [r, g, b] = key.split(',').map(Number);
          const hex = chroma(r, g, b).hex();

          // Skip near-white and near-black
          const [l, c] = chroma(hex).lch();
          if (l > 96 || l < 4) continue;

          // For the first 6 (top), use stricter distance; for rest, use looser
          const minDist = allColors.length < 6 ? minDistanceTop : minDistanceAdditional;

          // Also skip very desaturated for top colors
          if (allColors.length < 6 && c < 8) continue;

          const tooClose = allColors.some(
            existing => chroma.distance(hex, existing.hex, 'lab') < minDist
          );
          if (tooClose) continue;

          const isSwatch = count >= swatchThreshold;
          if (isSwatch) swatchCount++;

          allColors.push({ hex, isSwatch });
        }

        // Ensure we have at least 6
        while (allColors.length < 6) {
          if (allColors.length === 0) {
            allColors.push({ hex: '#3B82F6', isSwatch: false });
          } else {
            const base = allColors[0].hex;
            const [l, c, h] = chroma(base).lch();
            const offset = allColors.length * 60;
            try {
              allColors.push({ hex: chroma.lch(l, c, (h + offset) % 360).hex(), isSwatch: false });
            } catch {
              allColors.push({ hex: chroma.lch(60, 40, (h + offset) % 360).hex(), isSwatch: false });
            }
          }
        }

        resolve({
          topColors: allColors.slice(0, 6),
          additionalColors: allColors.slice(6),
          totalSwatches: swatchCount,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Image properties consumed by the server-side mood matcher in
 * functions/analyzeMoodboard.js. Field names + value ranges mirror the Python
 * notebook's extract_image_properties() so the server's matchMood() formulas
 * stay identical.
 *
 *   brightness / saturation / contrast — all 0..1
 *   hueFamily — coarse hue bucket of the dominant saturated pixels
 */
export type HueFamily =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'green'
  | 'cyan' | 'blue' | 'purple' | 'pink' | 'neutral';

export interface ImageProps {
  brightness: number;
  saturation: number;
  contrast: number;
  hueFamily: HueFamily;
}

/** RGB → HSV. Matches Python `colorsys.rgb_to_hsv` (h normalized to 0..1). */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h = (h * 60) / 360;
    if (h < 0) h += 1;
  }
  return [h, s, v];
}

function hueToFamily(h: number): HueFamily {
  // Bin edges copied verbatim from the notebook's match_mood logic.
  if (h < 0.05 || h > 0.95) return 'red';
  if (h < 0.10)             return 'orange';
  if (h < 0.17)             return 'amber';
  if (h < 0.25)             return 'yellow';
  if (h < 0.42)             return 'green';
  if (h < 0.52)             return 'cyan';
  if (h < 0.68)             return 'blue';
  if (h < 0.78)             return 'purple';
  return 'pink';
}

/** Browser port of the notebook's extract_image_properties(). 100×100 downsample,
 *  luminance via 0.299/0.587/0.114, contrast = std(luminance), hue family from
 *  mean hue of saturated (s > 0.2) pixels. */
export async function extractImageProps(imageUrl: string): Promise<ImageProps> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ brightness: 0.5, saturation: 0.3, contrast: 0.2, hueFamily: 'neutral' });
        return;
      }

      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      const { data } = ctx.getImageData(0, 0, 100, 100);

      const n = data.length / 4;
      const lum = new Float64Array(n);
      let sumLum = 0;
      let sumSat = 0;
      const satHues: number[] = [];

      for (let i = 0; i < n; i++) {
        const r = data[i * 4]     / 255;
        const g = data[i * 4 + 1] / 255;
        const b = data[i * 4 + 2] / 255;

        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        lum[i] = L;
        sumLum += L;

        const [h, s] = rgbToHsv(r, g, b);
        sumSat += s;
        if (s > 0.2) satHues.push(h);
      }

      const brightness = sumLum / n;
      const saturation = sumSat / n;

      let sqDev = 0;
      for (let i = 0; i < n; i++) {
        const d = lum[i] - brightness;
        sqDev += d * d;
      }
      const contrast = Math.sqrt(sqDev / n);

      let hueFamily: HueFamily = 'neutral';
      if (satHues.length > 10) {
        const meanHue = satHues.reduce((a, b) => a + b, 0) / satHues.length;
        hueFamily = hueToFamily(meanHue);
      }

      resolve({ brightness, saturation, contrast, hueFamily });
    };

    img.onerror = () => {
      resolve({ brightness: 0.5, saturation: 0.3, contrast: 0.2, hueFamily: 'neutral' });
    };

    img.src = imageUrl;
  });
}

/**
 * Detect the surface style of an image based on overall brightness and saturation.
 */
export async function assessImageStyle(
  imageUrl: string
): Promise<'light-tonal' | 'grey-professional' | 'dark-professional'> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('light-tonal');
          return;
        }

        const size = 100;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        let totalLightness = 0;
        let totalChroma = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          try {
            const [l, c] = chroma(r, g, b).lch();
            totalLightness += l;
            totalChroma += c;
            count++;
          } catch {
            // Skip invalid colors
          }
        }

        const avgLightness = totalLightness / count;
        const avgChroma = totalChroma / count;

        if (avgLightness < 30) {
          resolve('dark-professional');
        } else if (avgChroma < 10) {
          resolve('grey-professional');
        } else {
          resolve('light-tonal');
        }
      } catch {
        resolve('light-tonal');
      }
    };

    img.onerror = () => resolve('light-tonal');
    img.src = imageUrl;
  });
}
