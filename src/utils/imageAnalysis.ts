import chroma from 'chroma-js';

export interface ExtractedColorData {
  topColors: string[];        // Top 6 most prominent
  additionalColors: string[]; // Remaining extracted colors
  totalSwatches: number;      // How many distinct colors detected
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

        // Extract all distinct colors with minimum distance
        const allColors: string[] = [];
        const minDistanceTop = 20;
        const minDistanceAdditional = 12;
        const maxTotal = 60;

        for (const [key] of sorted) {
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
            existing => chroma.distance(hex, existing, 'lab') < minDist
          );
          if (tooClose) continue;

          allColors.push(hex);
        }

        // Ensure we have at least 6
        while (allColors.length < 6) {
          if (allColors.length === 0) {
            allColors.push('#3B82F6');
          } else {
            const base = allColors[0];
            const [l, c, h] = chroma(base).lch();
            const offset = allColors.length * 60;
            try {
              allColors.push(chroma.lch(l, c, (h + offset) % 360).hex());
            } catch {
              allColors.push(chroma.lch(60, 40, (h + offset) % 360).hex());
            }
          }
        }

        resolve({
          topColors: allColors.slice(0, 6),
          additionalColors: allColors.slice(6),
          totalSwatches: allColors.length,
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

        if (avgLightness < 40) {
          resolve('dark-professional');
        } else if (avgChroma < 20) {
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
