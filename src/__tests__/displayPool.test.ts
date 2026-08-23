import { describe, it, expect } from 'vitest';
import { resolveDisplayPool, autoLabel, AUTO } from '../utils/displayPool';

const POOLS = {
  'Serif / Editorial': ['Playfair Display', 'Lora'],
  'Sans / Geometric': ['Poppins', 'Montserrat'],
};
const detected = () => [{ family: 'Detected One', category: 'Sans / Clean', label: 'Detected One' }];
const base = { categoryPools: POOLS, detected };

describe('disregard the lettering, but still suggest from the mood', () => {
  it('suggests from the MOOD when lettering is disregarded', () => {
    const r = resolveDisplayPool({ ...base, override: AUTO, ignoreText: true, mood: 'whimsical_playful' });
    expect(r.source).toBe('mood');
    expect(r.key).toBe('Playful');
    expect(r.choices.length).toBeGreaterThan(0);
    // It must NOT fall back to the detected list — that is the whole point.
    expect(r.choices.map((c) => c.family)).not.toContain('Detected One');
  });

  it('names that mood for the dropdown so it reads as the active style', () => {
    expect(autoLabel(true, 'whimsical_playful')).toBe('Playful — from the whimsical_playful mood');
    expect(autoLabel(false, 'whimsical_playful')).toBe('Follow what was detected');
  });

  it('uses the detected lettering when NOT disregarding it', () => {
    const r = resolveDisplayPool({ ...base, override: AUTO, ignoreText: false, mood: 'whimsical_playful' });
    expect(r.source).toBe('detected');
    expect(r.choices.map((c) => c.family)).toEqual(['Detected One']);
  });

  it('lets the user change it — a category override beats the mood', () => {
    const r = resolveDisplayPool({
      ...base, override: 'cat:Serif / Editorial', ignoreText: true, mood: 'whimsical_playful',
    });
    expect(r.source).toBe('override-category');
    expect(r.choices.map((c) => c.family)).toEqual(['Playfair Display', 'Lora']);
  });

  it('lets the user change it to a DIFFERENT mood', () => {
    const r = resolveDisplayPool({
      ...base, override: 'mood:Elegant', ignoreText: true, mood: 'whimsical_playful',
    });
    expect(r.source).toBe('override-mood');
    expect(r.key).toBe('Elegant');
  });

  it('keeps the choice when the disregard switch is toggled', () => {
    // Regression: an override checked AFTER the ignoreText branch was silently
    // discarded the moment the switch flipped.
    const pick = { ...base, override: 'cat:Sans / Geometric', mood: 'whimsical_playful' };
    const on = resolveDisplayPool({ ...pick, ignoreText: true });
    const off = resolveDisplayPool({ ...pick, ignoreText: false });
    expect(on.choices).toEqual(off.choices);
    expect(on.source).toBe('override-category');
  });

  it('handles category names containing a colon-free slash', () => {
    const r = resolveDisplayPool({ ...base, override: 'cat:Serif / Editorial', ignoreText: false, mood: null });
    expect(r.key).toBe('Serif / Editorial');
  });

  it('falls back to a real pool for an unknown mood rather than an empty list', () => {
    const r = resolveDisplayPool({ ...base, override: AUTO, ignoreText: true, mood: 'nobody-defined-this' });
    expect(r.source).toBe('mood');
    expect(r.choices.length).toBeGreaterThan(0);
  });
});
