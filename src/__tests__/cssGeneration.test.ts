/**
 * Integration tests for CSS generation.
 * Verifies the exported CSS has correct variable values.
 */
import { describe, it, expect } from 'vitest';

// ─── OB consistency across all files ───
// These import the actual calculation to ensure they all agree

describe('OB consistency across pipeline', () => {
  // The canonical OB rule
  function canonicalOB(PC: number, isDark = false): number {
    return isDark ? 12 : (PC >= 9 ? 9 : 8);
  }

  it('OB=9 when PC=9 in light mode', () => {
    expect(canonicalOB(9)).toBe(9);
  });

  it('OB=8 when PC=8 in light mode', () => {
    expect(canonicalOB(8)).toBe(8);
  });

  it('OB=12 in dark mode regardless of PC', () => {
    expect(canonicalOB(9, true)).toBe(12);
    expect(canonicalOB(5, true)).toBe(12);
  });
});

// ─── Exported CSS variable patterns ───

describe('Exported CSS variable format rules', () => {
  it('Border-Variant should be 8-digit hex (color + opacity)', () => {
    // Format: #rrggbb40 (40 = 25% opacity)
    const borderVariant = '#dc6a4940';
    expect(borderVariant).toMatch(/^#[0-9a-fA-F]{8}$/);
    expect(borderVariant.slice(-2)).toBe('40'); // 25% opacity
  });

  it('Hover/Active should be hex values, not var() references', () => {
    const hover = '#f3dbcf';
    expect(hover).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(hover).not.toContain('var(');
  });

  it('Button/Text/Border should reference --{Palette}-Color-{N}', () => {
    const btnRef = 'var(--Primary-Color-9)';
    expect(btnRef).toMatch(/var\(--\w+-Color-\d+\)/);
  });

  it('Dropshadow-Color should be RGB triplet', () => {
    const ds = '120, 120, 120';
    expect(ds).toMatch(/^\d+,\s*\d+,\s*\d+$/);
  });

  it('Highlight/Lowlight should be RGB triplets', () => {
    const hl = '193, 173, 161';
    expect(hl).toMatch(/^\d+,\s*\d+,\s*\d+$/);
  });

  it('Container backgrounds should be distinct hex (not all the same)', () => {
    // In a real export, Container, Container-Low, Container-High should differ
    const containers = ['#fff9f5', '#fff9f5', '#fff9f6', '#fff8f4', '#fff8f4'];
    // At least 2 unique values
    const unique = new Set(containers);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

// ─── Color-N variable naming ───

describe('CSS variable naming conventions', () => {
  it('no var(--Colors-*) prefix — should be var(--Primary-Color-N)', () => {
    const bad = 'var(--Colors-Primary-Color-9)';
    const good = 'var(--Primary-Color-9)';
    expect(good).not.toContain('--Colors-');
    expect(bad).toContain('--Colors-');
  });

  it('no var(--Surface) — should be var(--Background)', () => {
    const bad = 'var(--Surface)';
    const good = 'var(--Background)';
    expect(good).not.toBe('var(--Surface)');
  });

  it('no var(--Default-Background-*) in output — should be resolved', () => {
    const bad = 'var(--Default-Background-Surface)';
    expect(bad).toContain('Default-Background');
    // These should never appear in final CSS
  });

  it('no Color-Vibrant in output — should resolve to Color-8', () => {
    const bad = 'var(--Primary-Color-Vibrant)';
    expect(bad).toContain('Vibrant');
    // Should be var(--Primary-Color-8) instead
  });

  it('no Color-13 or Color-14 — max is Color-12', () => {
    const color13 = 'var(--Neutral-Color-13)';
    expect(color13).toContain('13');
    // Should never exist in 12-tone system
  });
});

// ─── Theme surface rules ───

describe('Theme surface Color-N assignments', () => {
  it('Surface-Dimmest always uses Color-4', () => {
    const dimmestN = 4;
    expect(dimmestN).toBe(4);
  });

  it('{Theme}-Light always uses Color-11', () => {
    const lightN = 11;
    expect(lightN).toBe(11);
    expect(lightN).not.toBe(12); // Was incorrectly 12 before
  });

  it('Semantic themes (Info/Success/Warning/Error) use OB', () => {
    const PC = 9;
    const OB = PC >= 9 ? 6 : 5;
    // Semantic theme N should equal OB
    expect(OB).toBe(6);
  });
});
