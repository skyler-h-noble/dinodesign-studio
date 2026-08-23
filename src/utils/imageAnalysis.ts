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

/**
 * How colourful this image is, as the mean saturation of its most colourful
 * quarter.
 *
 * NOT the mean over every pixel, which is what this used to be. That statistic
 * is area-weighted, so a large flat background outvotes the subject: a board of
 * vivid popsicles on pale peach measured 0.33 when the popsicles themselves are
 * 0.78. The colours a person would describe the board by were averaged away by
 * the colours they would not mention.
 *
 * That mattered because match_mood() weights this heavily in both directions —
 * whimsical_playful scores s * 0.5 while editorial_modern scores (1 - s) * 0.4
 * — so diluting it handed vivid boards to the mood that rewards being drab.
 *
 * The top quartile was chosen against alternatives (see below); it degrades
 * gracefully as the colourful area shrinks, where the others cliff-edge:
 *
 *   vivid coverage:        30%    10%     5%    none
 *   whole-image mean      0.32   0.19   0.15   0.12   <- outvoted by area
 *   75th percentile       0.78   0.12   0.12   0.12   <- cliff at ~25%
 *   saturated pixels only 0.78   0.78   0.78   0.00   <- one dot reads vivid
 *   TOP QUARTILE MEAN     0.78   0.38   0.25   0.12   <- degrades smoothly
 *
 * A single vivid dot reads 0.25: noticeably colourful, not maximal. That is the
 * intended behaviour — coverage should count for something, just not for
 * everything.
 */
/** Exported for tests: the saturation statistic on its own. */
export function saturationFromPixels(sats: Float64Array): number {
  return topQuartileMeanSaturation(sats);
}

function topQuartileMeanSaturation(sats: Float64Array): number {
  const n = sats.length;
  if (!n) return 0;
  const sorted = Array.from(sats).sort((a, b) => a - b);
  const start = Math.floor(n * 0.75);
  let sum = 0;
  for (let i = start; i < n; i++) sum += sorted[i];
  return sum / (n - start);
}

export interface ImageProps {
  brightness: number;
  saturation: number;
  contrast: number;
  hueFamily: HueFamily;
  /** 0 = one hue, 1 = hues evenly spread (a rainbow). See circularHueStats. */
  hueSpread: number;
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

/**
 * Mean of a set of hues, treating them as ANGLES.
 *
 * Hue wraps: 0.0 and 1.0 are the same red. The arithmetic mean does not know
 * that, so it returns a value that can be nowhere near any input. Two red
 * pixels at 0.02 and 0.98 averaged to 0.50 — cyan, the opposite colour. A
 * rainbow board averaged to green. Every image whose colours straddle the
 * red/pink wrap got a hue family that appeared nowhere in it, and that family
 * then gated which moods could score at all.
 *
 * The circular mean is the correct statistic: convert each hue to a unit
 * vector, average the vectors, take the angle of the result.
 *
 * A near-zero resultant means the hues cancel out — an evenly spread rainbow
 * has no meaningful average direction. That is reported as 'neutral' via NaN
 * rather than an arbitrary angle, because picking one of them would be a
 * fiction the gating then acts on.
 */
export function circularMeanHue(hues: number[]): number {
  return circularHueStats(hues).mean;
}

/**
 * Circular mean AND how tightly the hues cluster around it.
 *
 * `spread` is 1 - R, where R is the length of the mean resultant vector:
 *
 *   spread 0.0  every sampled pixel is the same hue — a monochrome board
 *   spread 0.5  colours favour one region of the wheel
 *   spread 1.0  hues cancel out entirely — a rainbow, no dominant direction
 *
 * This costs nothing: R was already computed to decide when the mean is
 * meaningless, and then discarded. Discarding it collapsed the whole image to
 * ONE hue family, which is why a rainbow board and a monochrome board could
 * look identical to the scorer — a board of eight vivid hues reported
 * 'neutral', the same label a grey board gets, because their average direction
 * is the same: none.
 *
 * "How many colours" is a mood signal in its own right. Kids' primaries and
 * rainbows are high spread; editorial, Scandinavian and industrial palettes are
 * low. Nothing else in ImageProps can express that distinction.
 */
export function circularHueStats(hues: number[]): { mean: number; spread: number } {
  if (!hues.length) return { mean: NaN, spread: 0 };
  let sx = 0;
  let sy = 0;
  for (const h of hues) {
    const a = h * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const n = hues.length;
  sx /= n;
  sy /= n;
  const R = Math.hypot(sx, sy);
  const spread = Math.max(0, Math.min(1, 1 - R));
  // Below this the mean direction is noise, so report no mean — but the SPREAD
  // is still the finding, and is returned rather than thrown away.
  if (R < 0.05) return { mean: NaN, spread };
  const angle = Math.atan2(sy, sx) / (2 * Math.PI);
  return { mean: (angle + 1) % 1, spread };
}

function hueToFamily(h: number): HueFamily {
  // No meaningful mean direction (hues cancel out) — say neutral rather than
  // invent a family. NaN fails every comparison below, so it must be caught
  // explicitly or it would fall through to the final 'pink'.
  if (!Number.isFinite(h)) return 'neutral';
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
        resolve({ brightness: 0.5, saturation: 0.3, contrast: 0.2, hueFamily: 'neutral', hueSpread: 0 });
        return;
      }

      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      const { data } = ctx.getImageData(0, 0, 100, 100);

      const n = data.length / 4;
      const lum = new Float64Array(n);
      const sats = new Float64Array(n);
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
        sats[i] = s;
        if (s > 0.2) satHues.push(h);
      }

      const brightness = sumLum / n;
      const saturation = topQuartileMeanSaturation(sats);

      let sqDev = 0;
      for (let i = 0; i < n; i++) {
        const d = lum[i] - brightness;
        sqDev += d * d;
      }
      const contrast = Math.sqrt(sqDev / n);

      let hueFamily: HueFamily = 'neutral';
      let hueSpread = 0;
      if (satHues.length > 10) {
        const stats = circularHueStats(satHues);
        hueFamily = hueToFamily(stats.mean);
        hueSpread = stats.spread;
      }

      resolve({ brightness, saturation, contrast, hueFamily, hueSpread });
    };

    img.onerror = () => {
      resolve({ brightness: 0.5, saturation: 0.3, contrast: 0.2, hueFamily: 'neutral', hueSpread: 0 });
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
