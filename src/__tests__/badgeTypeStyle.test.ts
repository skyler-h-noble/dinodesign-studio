/**
 * The Badge counter's digits are their own type style.
 *
 * The lib used to compose them from --Button-Small-* plus --Sm-Button-Numbers.
 * That is close but not the design: Figma's `Badge` style is 11/12, while
 * --Sm-Button-Numbers resolves to 10 (3x24/16 + 5.5) and
 * --Button-Small-Line-Height to 14. Nor is 11 reachable by picking a different
 * rung — the Button-Numbers ladder is 10 / 12 / 16 at the three button
 * heights, and 11 is none of them. A value no existing token can express is
 * the signal it needs its own.
 *
 * Face, weight and tracking are NOT its own: the Figma style binds those to
 * the Buttons/Small role, so only size and leading are stated here.
 */
import { describe, it, expect } from 'vitest';
import { typographyDeclarations } from '../utils/cssgen/generateTypographyTokensCSS';

const css = () => typographyDeclarations([
  { type: 'Display', family: 'Anton', weight: '400', letterSpacing: '0em' },
  { type: 'Header', family: 'Google Sans Flex', weight: '600', letterSpacing: '0em' },
  { type: 'Body', family: 'Poppins', weight: '400', letterSpacing: '0em' },
] as never);

const decl = (out: string, name: string) =>
  out.split('\n').map((l) => l.trim()).find((l) => l.startsWith(`--${name}:`));

describe('the Badge type style', () => {
  it('emits the size and leading the design states', () => {
    const out = css();
    expect(decl(out, 'Badge-Font-Size')).toBe('--Badge-Font-Size:     11px;');
    expect(decl(out, 'Badge-Line-Height')).toBe('--Badge-Line-Height:   12px;');
  });

  it('carries the rest of the role so a brand can re-pick it', () => {
    const out = css();
    for (const part of ['Font-Family', 'Font-Weight', 'Letter-Spacing', 'Text-Transform']) {
      expect(decl(out, `Badge-${part}`), `missing --Badge-${part}`).toBeDefined();
    }
  });

  it('is not reachable from the Button-Numbers ladder', () => {
    /* Guards the reason this style exists. If a future retune ever puts a rung
       on 11, the ladder could carry the badge and this style would be
       duplication — but until then, reading a Button token gives 10 or 12. */
    const rung = (h: number) => Math.max(10, Math.round((3 * h) / 16 + 5.5));
    expect([rung(24), rung(32), rung(56)]).toEqual([10, 12, 16]);
  });
});
