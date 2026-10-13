/** Spreadsheet data — pasted cells or a CSV — as chart rows. */
import { describe, it, expect } from 'vitest';
import { parseGrid, tableFromGrid, niceAxis } from '../utils/addOns/charts/chartData';

describe('importing spreadsheet data', () => {
  it('reads cells pasted from a spreadsheet (tab-separated) with a header row', () => {
    const t = tableFromGrid(parseGrid('Month\tSales\tCosts\nJan\t40\t20\nFeb\t65\t35\n'));
    expect(t.labels).toEqual(['Jan', 'Feb']);
    expect(t.series).toEqual(['Sales', 'Costs']);
    expect(t.values).toEqual([[40, 20], [65, 35]]);
  });

  it('reads a CSV with quoted cells, and numbers the way people type them', () => {
    const t = tableFromGrid(parseGrid('Region,Revenue\n"North, East","$1,250"\nSouth,$980\nWest,($40)'));
    expect(t.labels).toEqual(['North, East', 'South', 'West']);
    expect(t.values.map((r) => r[0])).toEqual([1250, 980, -40]);
    expect(t.prefix).toBe('$');
  });

  it('treats an all-number first row as data, and lifts a shared suffix', () => {
    const t = tableFromGrid(parseGrid('A,35%\nB,60%'));
    expect(t.series).toEqual(['Series 1']);
    expect(t.values).toEqual([[35], [60]]);
    expect(t.suffix).toBe('%');
  });

  it('notes blank cells and refuses what cannot be a chart', () => {
    expect(tableFromGrid(parseGrid('Jan,40\nFeb,')).notes[0]).toMatch(/1 cell was empty/);
    expect(() => tableFromGrid(parseGrid(''))).toThrow(/Paste some cells/);
    expect(() => tableFromGrid(parseGrid('Jan\nFeb'))).toThrow(/at least two columns/);
  });

  it('suggests a round axis that fits', () => {
    expect(niceAxis(85)).toEqual({ max: 100, step: 25 });
    expect(niceAxis(1250).max).toBe(1500);
  });
});
