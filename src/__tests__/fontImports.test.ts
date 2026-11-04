import { describe, it, expect } from 'vitest';
import { extractFontImports, stripFontImports, consolidateFontImports } from '../utils/fontImports';

const IMPORTS = [
  "@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:GRAD,ROND,opsz,slnt,wdth,wght@0..50,0,96,0,72..100,600&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');",
].join('\n');
const sheet = (body: string) => `${IMPORTS}\n\n/* header */\n:root { ${body} }\n`;

describe('font imports at publish', () => {
  it('extracts each URL once and strips them', () => {
    expect(extractFontImports(sheet('--A: 1;'))).toHaveLength(2);
    const stripped = stripFontImports(sheet('--A: 1;'));
    expect(stripped).not.toContain('@import');
    expect(stripped).toContain('--A: 1;');
  });

  it('keeps them in foundation.css only and lists them in theme.json', () => {
    const files = [
      { name: 'theme.json', content: JSON.stringify({ name: 'X', foundation: 'f' }), type: 'application/json' },
      { name: 'foundation.css', content: sheet('--F: 1;'), type: 'text/css' },
      { name: 'core.css', content: sheet('--C: 1;'), type: 'text/css' },
      { name: 'Light-Mode.css', content: sheet('--L: 1;'), type: 'text/css' },
      { name: 'base.css', content: sheet('--B: 1;'), type: 'text/css' },
    ];
    const urls = consolidateFontImports(files);
    expect(urls).toHaveLength(2);
    const css = (n: string) => files.find((f) => f.name === n)!.content;
    expect(css('foundation.css').match(/@import/g)).toHaveLength(2);
    expect(css('foundation.css').startsWith('@import')).toBe(true);   // @import must lead the sheet
    for (const n of ['core.css', 'Light-Mode.css', 'base.css']) expect(css(n)).not.toContain('@import');
    expect(JSON.parse(css('theme.json')).fonts).toEqual(urls);
    expect(css('core.css')).toContain('--C: 1;');
  });

  it('leaves a system without foundation.css alone', () => {
    const files = [{ name: 'core.css', content: sheet(''), type: 'text/css' }];
    expect(consolidateFontImports(files)).toEqual([]);
    expect(files[0].content).toContain('@import');
  });
});
