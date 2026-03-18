import chroma from 'chroma-js';
import { colorMoodMapping } from '../data/colorMoodMapping';
import type { ComponentStyle } from '../types';

/**
 * Detect the mood from a color and suggest a component style.
 * Uses chroma.deltaE color distance to find the closest mood.
 */

const MOOD_TO_STYLE: Record<string, ComponentStyle> = {
  'Playful': 'playful',
  'Bold': 'bold',
  'Professional': 'professional',
  'Modern': 'modern',
  'Energetic': 'bold',
  'Fun': 'playful',
  'Serious': 'professional',
  'Minimal': 'modern',
  'Creative': 'playful',
  'Tech': 'modern',
  'Calm': 'modern',
  'Elegant': 'professional',
  'Sophisticated': 'professional',
  'Warm': 'modern',
  'Cute': 'playful',
  'Happy': 'playful',
  'Romantic': 'modern',
  'Rebellious': 'bold',
  'Passionate': 'bold',
  'Sassy': 'bold',
  'Giddy': 'playful',
  'Spirited': 'playful',
  'Determined': 'professional',
  'Formal': 'professional',
  'Security': 'professional',
  'Timeless': 'professional',
  'Vintage': 'modern',
  'Feminine': 'modern',
  'Delicate': 'modern',
  'Charming': 'modern',
};

export function suggestComponentStyle(primaryColor: string): ComponentStyle {
  try {
    const chromaColor = chroma(primaryColor);
    let closestMood: string | null = null;
    let minDistance = Infinity;

    for (const mapping of colorMoodMapping) {
      for (const moodColor of mapping.colors) {
        try {
          const distance = chroma.deltaE(chromaColor, chroma(moodColor));
          if (distance < minDistance) {
            minDistance = distance;
            closestMood = mapping.mood;
          }
        } catch {
          continue;
        }
      }
    }

    if (closestMood) {
      const baseMood = closestMood.split('-')[0];
      return MOOD_TO_STYLE[baseMood] || 'modern';
    }
  } catch {
    // fallback
  }

  return 'modern';
}
