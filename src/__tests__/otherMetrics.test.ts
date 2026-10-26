/**
 * Component sizes the lib reads by name that the stylesheet did not carry —
 * Progress, TextArea, Rating, the floating label, Sheet (2026-10-26).
 * Both emitters (preview and export) must carry them (invariant 5).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { otherMetricsVars } from '../utils/componentSize';

describe('Other component-size metrics', () => {
  it("carry Figma's numbers", () => {
    const v = otherMetricsVars();
    expect(v['--Progress-Bar-Width']).toBe('8px');
    expect(v['--Sm-Progress-Bar-Width']).toBe('4px');
    expect(v['--Lg-Progress-Bar-Width']).toBe('16px');
    expect(v['--Text-Area-Min-Height']).toBe('88px');
    expect(v['--Rating']).toBe('24px');
    expect(v['--Lg-Rating']).toBe('32px');
    expect(v['--Progress-Dial-Radius']).toBe('var(--Sizing-10, 80px)');
    expect(v['--Floating-Label-Medium-Font-Size']).toBe('12px');
    expect(v['--Floating-Label-Font-Weight']).toBe('500');
    expect(v['--Sheet']).toBe('540px');
  });

  it('every name the lib reads is emitted', () => {
    const v = otherMetricsVars();
    for (const name of ['--Progress-Bar-Width', '--Text-Area-Min-Height', '--Sheet',
      '--Floating-Label-Small-Font-Size', '--Floating-Label-Medium-Font-Size', '--Floating-Label-Large-Font-Size',
      '--Floating-Label-Small-Line-Height', '--Floating-Label-Medium-Line-Height', '--Floating-Label-Large-Line-Height',
      '--Floating-Label-Font-Weight', '--Floating-Label-Letter-Spacing']) {
      expect(v[name], name).toBeTruthy();
    }
  });

  it('both the preview and the export spread them', () => {
    const preview = readFileSync(join(__dirname, '../utils/componentStyleVars.ts'), 'utf8');
    const exporter = readFileSync(join(__dirname, '../utils/cssgen/exportToCSS.ts'), 'utf8');
    expect(preview).toContain('...otherMetricsVars()');
    expect(exporter).toContain('otherMetricsVars()');
  });
});
