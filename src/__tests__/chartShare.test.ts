/** A chart comes back into the studio from its link, its HTML or its spec. */
import { describe, it, expect } from 'vitest';
import { encodeChartSpec, extractChartSpec } from '../utils/addOns/charts/chartShare';
import { normalizeChartSpec } from '../utils/addOns/charts/chartSpec';
import { layoutChart } from '../utils/addOns/charts/chartLayout';
import { chartHTML } from '../utils/addOns/charts/chartCode';

const raw = { version: 'chart1', name: 'Café “totals” <&>', type: 'bar', data: [{ label: 'Jän', value: 40, color: 'Chart-1' }] };

describe('loading a chart back', () => {
  it('round-trips through a link, including non-ASCII text', () => {
    const link = 'https://x.test/add-ons/charts/abc#spec=' + encodeChartSpec(raw);
    expect(extractChartSpec(link)).toEqual(raw);
  });

  it('reads the spec off exported HTML', () => {
    const { spec } = normalizeChartSpec(raw);
    const html = chartHTML(spec, layoutChart(spec));
    expect(extractChartSpec(html)).toEqual(spec);
  });

  it('takes a pasted spec, and says what is wrong with anything else', () => {
    expect(extractChartSpec(JSON.stringify(raw))).toEqual(raw);
    expect(() => extractChartSpec('')).toThrow(/Paste a chart first/);
    expect(() => extractChartSpec('<figure class="omni-chart">')).toThrow(/before charts carried their spec/);
    expect(() => extractChartSpec('hello')).toThrow(/does not look like a chart/);
  });
});
