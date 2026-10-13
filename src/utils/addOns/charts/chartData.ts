/**
 * Data from a spreadsheet, as chart rows.
 *
 * Two ways in, one parser: cells copied from Excel, Google Sheets or Numbers
 * arrive as tab-separated text, and a .csv file is comma- (or semicolon-)
 * separated. Either becomes a grid, and the grid becomes categories and
 * series:
 *
 *   first column     the categories (Jan, Feb, …)
 *   header row       the series names — when the first row is not numbers
 *   other columns    one series each (lines and stacks use them all; bars
 *                    and pies take the first)
 *
 * Numbers are read the way people type them: "1,250", "$40", "35%", "(12)"
 * for a negative. A prefix or suffix every value shares ($, %, …) is lifted
 * out for the axis. Only the data changes — the chart's type, colors and
 * options stay as they are.
 */

export interface ChartTable {
  labels: string[];
  series: string[];
  /** values[row][series]; null where the cell was empty or not a number */
  values: (number | null)[][];
  prefix: string;
  suffix: string;
  notes: string[];
}

/** Split text into rows of cells, honouring quotes ("a, b" is one cell). */
export function parseGrid(text: string): string[][] {
  const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t.trim()) return [];
  const first = t.split('\n')[0];
  const sep = first.includes('\t') ? '\t'
    : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((x) => x !== ''));
}

/** A cell as a number, with whatever surrounded it. */
function readNumber(cell: string): { n: number | null; pre: string; suf: string } {
  const s = cell.trim();
  if (!s) return { n: null, pre: '', suf: '' };
  const m = s.match(/^(\(?)([^\d\-+.(]*?)([-+]?[\d.,\s]*\d[\d.,]*)([^\d)]*?)(\)?)$/);
  if (!m) return { n: null, pre: '', suf: '' };
  const neg = m[1] === '(' && m[5] === ')';
  let digits = m[3].replace(/\s/g, '');
  // "1.250,5" (European) vs "1,250.5": the last separator is the decimal one.
  const lastComma = digits.lastIndexOf(','); const lastDot = digits.lastIndexOf('.');
  if (lastComma > lastDot && digits.length - lastComma - 1 !== 3) digits = digits.replace(/\./g, '').replace(',', '.');
  else digits = digits.replace(/,/g, '');
  const n = Number(digits);
  if (!isFinite(n)) return { n: null, pre: '', suf: '' };
  return { n: neg ? -Math.abs(n) : n, pre: m[2].trim(), suf: m[4].trim() };
}

/** The grid as chart data. */
export function tableFromGrid(grid: string[][]): ChartTable {
  const notes: string[] = [];
  if (!grid.length) throw new Error('Paste some cells, or choose a CSV file.');
  const width = Math.max(...grid.map((r) => r.length));
  if (width < 2) throw new Error('The data needs at least two columns: a label and a number.');

  // A header row is one whose cells after the first are not numbers.
  const isHeader = grid[0].slice(1).some((c) => c !== '' && readNumber(c).n === null);
  const head = isHeader ? grid[0] : null;
  const body = isHeader ? grid.slice(1) : grid;
  if (!body.length) throw new Error('There is a header row but no data under it.');

  const cols = width - 1;
  const series = Array.from({ length: cols }, (_, k) => (head && head[k + 1]) || 'Series ' + (k + 1));
  const pres = new Set<string>(); const sufs = new Set<string>();
  let blanks = 0;
  const values = body.map((r) => Array.from({ length: cols }, (_, k) => {
    const { n, pre, suf } = readNumber(r[k + 1] || '');
    if (n === null) { blanks++; return null; }
    pres.add(pre); sufs.add(suf);
    return n;
  }));
  const labels = body.map((r, i) => r[0] || String(i + 1));
  const prefix = pres.size === 1 ? [...pres][0] : '';
  const suffix = sufs.size === 1 ? [...sufs][0] : '';
  if (blanks) notes.push(blanks + (blanks === 1 ? ' cell was' : ' cells were') + ' empty or not a number; they are left blank.');
  return { labels, series, values, prefix: prefix.slice(0, 4), suffix: suffix.slice(0, 4), notes };
}

/** A round axis maximum at or above the data's largest value, with a step
 *  that divides it into four or five gridlines. */
export function niceAxis(max: number): { max: number; step: number } {
  if (!(max > 0)) return { max: 100, step: 25 };
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const top = m * mag;
    if (top >= max) {
      const step = [top / 4, top / 5].find((s) => Number.isInteger(s / mag * 100)) || top / 4;
      return { max: top, step };
    }
  }
  return { max: 10 * mag, step: 2.5 * mag };
}
