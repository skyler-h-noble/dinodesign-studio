/** Chart motion: the CSS parses, and the markup asks for it only when set. */
import { describe, it, expect } from 'vitest';
import { chartCSS, chartScript } from '../utils/addOns/charts/chartCode';
import { normalizeChartSpec } from '../utils/addOns/charts/chartSpec';

describe('chart motion', () => {
  it('has balanced braces, so no rule after a stray one is swallowed', () => {
    // A stray "}" sat at the end of this CSS unnoticed until the motion rules
    // followed it, and the browser silently dropped the first keyframes.
    const css = chartCSS().replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    for (const ch of css) {
      if (ch === '{') depth++;
      if (ch === '}') { depth--; expect(depth).toBeGreaterThanOrEqual(0); }
    }
    expect(depth).toBe(0);
  });

  it('defines every keyframe it uses, inside a reduced-motion guard', () => {
    const css = chartCSS();
    for (const k of ['omni-chart-grow-y', 'omni-chart-grow-x', 'omni-chart-reveal', 'omni-chart-open', 'omni-chart-fade']) {
      expect(css).toContain(`@keyframes ${k}`);
    }
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
  });

  it('defaults to no motion and keeps the setting', () => {
    expect(normalizeChartSpec({}).spec.animate).toBe('none');
    expect(normalizeChartSpec({ animate: 'scroll' }).spec.animate).toBe('scroll');
    expect(normalizeChartSpec({ animate: 'spin' }).spec.animate).toBe('none');
    expect(chartScript()).toContain('data-in-view');
  });
});
