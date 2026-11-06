/**
 * The whitespace-only minifier behind the brotli copies (cssMinifySafe.ts).
 *
 * The rule it has to keep: every declaration value survives byte-for-byte
 * (bar its outer whitespace). Checked two ways — on generated sheets across
 * brands and choices, against an independent parser (postcss), and on the
 * hand-made edge cases a regex minifier gets wrong.
 */
import { describe, it, expect } from 'vitest';
import postcss, { type ChildNode } from 'postcss';
import { minifyCss, minifyCssSafe, stripCssComments } from '../utils/cssMinifySafe';
import { buildSystem, BRANDS, quietly, type Selection } from './__fixtures__/renderedSystem';

/** Rules, at-rules and declarations in order, with their enclosing path. */
function declarationList(css: string): string[] {
  const out: string[] = [];
  const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
  const walk = (nodes: ChildNode[], path: string) => {
    for (const n of nodes) {
      if (n.type === 'decl') out.push(`${path} | ${n.prop}: ${n.value}${n.important ? ' !important' : ''}`);
      else if (n.type === 'rule') {
        const sel = n.selectors.map((x) => ws(x).replace(/\s*,\s*/g, ',')).join(',');
        out.push(`${path} > ${sel}`);
        walk(n.nodes, `${path} > ${sel}`);
      } else if (n.type === 'atrule') {
        const at = `@${n.name} ${ws(n.params)}`;
        out.push(`${path} > ${at}`);
        if (n.nodes) walk(n.nodes, `${path} > ${at}`);
      }
    }
  };
  walk(postcss.parse(css).nodes, '');
  return out;
}

describe('generated sheets keep every declaration', () => {
  const cases: [string, Selection][] = [
    ['Popsicle', { background: 'Neutral/Surface', button: 'tonal', cardColoring: 'white', textColoring: 'black-white' }],
    ['Grape', { background: 'Primary/Surface-Dim', button: 'black-white', cardColoring: 'black', textColoring: 'tonal' }],
  ];
  for (const [brand, sel] of cases) {
    const { files } = quietly(() => buildSystem(BRANDS[brand], sel));
    for (const [name, css] of Object.entries(files)) {
      it(`${brand} ${name}`, () => {
        const min = minifyCss(css);
        expect(declarationList(min)).toEqual(declarationList(css));
        expect(min.length).toBeLessThan(css.length);
        // Idempotent: a minified sheet is already as small as this pass makes it.
        expect(minifyCss(min)).toBe(min);
      });
    }
  }
});

describe('edge cases', () => {
  it('drops comments and the whitespace between tokens', () => {
    expect(minifyCss('/* c */\n:root {\n  --A : 1px ;\n  --B: 2px;\n}\n\n.x , .y\n{ color: red }'))
      .toBe(':root{--A:1px;--B:2px}.x,.y{color:red}');
  });

  it('keeps values byte-for-byte: colors, zero units, inner spacing, !important', () => {
    const css = '.a { color: #AABBCC; margin: 0px 0.50em; box-shadow: 0 1px  2px rgba(0, 0, 0, .2), 0 0 0 1px red; width: calc( 100% - 2px ) !important; }';
    expect(minifyCss(css)).toBe('.a{color:#AABBCC;margin:0px 0.50em;box-shadow:0 1px  2px rgba(0, 0, 0, .2), 0 0 0 1px red;width:calc( 100% - 2px ) !important}');
  });

  it('leaves strings alone — braces, semicolons and comment markers inside quotes', () => {
    const css = `.a::before { content: "a { b; } /* not a comment */"; } [data-x='1, 2'] { --q: ';'; }`;
    expect(minifyCss(css)).toBe(`.a::before{content:"a { b; } /* not a comment */"}[data-x='1, 2']{--q:';'}`);
  });

  it('keeps @import statements, in order, ahead of the rules', () => {
    const css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');\n@import url("x.css");\n:root { --a: 1; }`;
    expect(minifyCss(css)).toBe(`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');@import url("x.css");:root{--a:1}`);
  });

  it('recurses into @media / @container / @scope, and keeps @font-face declarations', () => {
    const css = `@media (min-width: 600px) and (max-width: 900px) {\n  .a { b: c; }\n}\n@container card (min-width: 400px) { .b { c: d } }\n@scope ([data-theme]) to ([data-theme]) { :scope { e: f } }\n@font-face { font-family: "X"; src: url(x.woff2) format("woff2"); }`;
    const min = minifyCss(css);
    expect(min).toBe('@media (min-width: 600px) and (max-width: 900px){.a{b:c}}@container card (min-width: 400px){.b{c:d}}@scope ([data-theme]) to ([data-theme]){:scope{e:f}}@font-face{font-family:"X";src:url(x.woff2) format("woff2")}');
    expect(declarationList(min)).toEqual(declarationList(css));
  });

  it('keeps one space in an empty custom property (older engines drop `--x:;`)', () => {
    expect(minifyCss(':root { --empty: ; --b:1 }')).toBe(':root{--empty: ;--b:1}');
  });

  it('semicolons inside parentheses do not split a declaration', () => {
    expect(minifyCss('.a { background: url(data:image/svg+xml;utf8,<svg/>); }'))
      .toBe('.a{background:url(data:image/svg+xml;utf8,<svg/>)}');
  });

  it('refuses what it does not understand, and the safe form returns the sheet unchanged', () => {
    const nested = '.a { color: red; &:hover { color: blue } }';
    expect(() => minifyCss(nested)).toThrow();
    const saved = console.warn;
    console.warn = () => {};
    try {
      expect(minifyCssSafe(nested)).toBe(nested);
      expect(minifyCssSafe('.a { color: red; ')).toBe('.a { color: red; ');
      expect(minifyCssSafe('color: red;')).toBe('color: red;');
    } finally {
      console.warn = saved;
    }
  });

  it('stripCssComments keeps comment markers inside strings', () => {
    expect(stripCssComments(`a/*x*/b "/*y*/" '*/' c`)).toBe(`ab "/*y*/" '*/' c`);
  });
});
