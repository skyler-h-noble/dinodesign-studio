import { describe, it, expect } from 'vitest';
import { looksLikeLettering } from '../utils/textDetection';

describe('looksLikeLettering', () => {
  it('rejects the popsicle misread that shipped', () => {
    // Nine popsicles in a row, read as nine digits. This is the string that
    // became a Display specimen and drove a whole type system.
    expect(looksLikeLettering('613000001')).toBe(false);
  });

  it('rejects nothing at all', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(looksLikeLettering(v)).toBe(false);
    }
  });

  it('rejects specks and single letters', () => {
    expect(looksLikeLettering('l')).toBe(false);
    expect(looksLikeLettering('.')).toBe(false);
    expect(looksLikeLettering('| |')).toBe(false);
  });

  it('rejects a numeric run with a stray letter in it', () => {
    expect(looksLikeLettering('6130A0001')).toBe(false);
  });

  it('accepts real lettering', () => {
    expect(looksLikeLettering('Vivid Mornings')).toBe(true);
    expect(looksLikeLettering('SALT DAMAGE')).toBe(true);
    expect(looksLikeLettering('of')).toBe(true);
    expect(looksLikeLettering('Été')).toBe(true);
  });

  it('accepts lettering that carries digits alongside it', () => {
    expect(looksLikeLettering('Est. 1972')).toBe(true);
    expect(looksLikeLettering('Blacks Beach 1972')).toBe(true);
  });

  it('accepts punctuation-heavy lettering', () => {
    expect(looksLikeLettering('—  Hello  —')).toBe(true);
  });
});
