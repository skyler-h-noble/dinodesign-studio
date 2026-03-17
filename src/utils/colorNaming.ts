import chroma from 'chroma-js';

/** Detect a human-readable color name from hue angle */
function getHueName(hue: number): string {
  if (isNaN(hue)) return 'Gray';
  const h = ((hue % 360) + 360) % 360;
  if (h < 15) return 'Red';
  if (h < 40) return 'Orange';
  if (h < 65) return 'Yellow';
  if (h < 80) return 'Lime';
  if (h < 150) return 'Green';
  if (h < 180) return 'Teal';
  if (h < 210) return 'Cyan';
  if (h < 250) return 'Blue';
  if (h < 280) return 'Indigo';
  if (h < 310) return 'Purple';
  if (h < 340) return 'Pink';
  return 'Red';
}

/** Get a descriptive adjective based on lightness and chroma */
function getAdjective(lightness: number, chromaVal: number): string {
  if (chromaVal < 10) {
    if (lightness < 30) return 'Dark';
    if (lightness > 80) return 'Light';
    return 'Muted';
  }

  if (lightness < 20) return 'Deep';
  if (lightness < 35) return 'Rich';
  if (lightness > 85) return 'Soft';
  if (lightness > 75) return 'Pastel';

  if (chromaVal > 60) return 'Vivid';
  if (chromaVal > 45) return 'Bold';
  if (chromaVal > 30) return 'Warm';
  if (chromaVal > 15) return 'Subtle';

  return 'Natural';
}

/**
 * Get a descriptive color name like "Bold Teal" or "Soft Pink"
 */
export function getColorDescription(hex: string): string {
  try {
    const [l, c, h] = chroma(hex).lch();
    const hueName = getHueName(h);
    const adjective = getAdjective(l, c);
    return `${adjective} ${hueName}`;
  } catch {
    return 'Unknown';
  }
}
