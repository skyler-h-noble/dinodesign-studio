/**
 * No font-family token may resolve to nothing on a non-Desktop device.
 *
 * `--Platform-Font-Families-Header` / `-Body` / `-Decorative` are the Figma-side
 * names. NOTHING ever defines them — not the lib, not foundation.css, not a
 * brand's generated bundle. They are an override hook that is, in practice,
 * always empty.
 *
 * A `var()` on an undefined custom property with NO fallback computes to the
 * guaranteed-invalid value, so the token it is assigned to is invalid at
 * computed-value time and `font-family: var(--Font-Family-Body)` becomes
 * `unset`. The text does not fall back to the brand's face — it inherits
 * whatever the ancestor had, which on a plain page is the UA default.
 *
 * The shipped asset had 135 such declarations. Only the Desktop block escaped,
 * because generateTypographyTokensCSS splices Desktop away and regenerates it
 * WITH the fallbacks — so the one device every developer previews on was the
 * one device that worked, and every phone and tablet silently lost the brand's
 * body, label, button, number, subtitle and nav faces.
 *
 * This is the var()-fallback rule in CLAUDE.md, in its least visible form:
 * the fallback does not fire when the variable is defined, and here the token
 * does not resolve at all when it is not. Either way, stating the brand's own
 * token is what makes the value right.
 */
import { describe, it, expect } from 'vitest';
import { buildTypographyTokensCSS } from '../utils/typographyTokens';

const CSS = buildTypographyTokensCSS([
  { type: 'decorative', family: 'Fredoka', weight: '700', displaySize: '76' },
  { type: 'header', family: 'Google Sans Flex', weight: '300' },
  { type: 'body', family: 'Poppins', weight: '400' },
] as never);

describe('platform font hooks always name a brand fallback', () => {
  it('leaves no var(--Platform-Font-Families-*) without one', () => {
    /* Matching on the SHIPPED output, not the source asset: the Desktop block
       is regenerated, so only the built file shows what a consumer receives. */
    const bare = CSS.match(/var\(--Platform-Font-Families-[A-Za-z]+\)\s*;/g) || [];
    expect(`bare platform vars: ${bare.length}`).toBe('bare platform vars: 0');
  });

  it('falls back to the role that matches the hook', () => {
    /* Header must not fall back to the body face, and vice versa — a mapping
       slip here still produces a real font, so nothing looks wrong. */
    for (const [hook, role] of [['Header', 'Header'], ['Body', 'Body'],
                                ['Decorative', 'Decorative']] as const) {
      const re = new RegExp(`var\\(--Platform-Font-Families-${hook},\\s*var\\(--Set-Font-Family-(\\w+)\\)`, 'g');
      const roles = new Set(Array.from(CSS.matchAll(re), (m) => m[1]));
      if (roles.size === 0) continue;
      expect(`${hook} -> ${[...roles].join(',')}`).toBe(`${hook} -> ${role}`);
    }
  });

  it('every device block gets a body family that resolves', () => {
    for (const device of ['Desktop', 'IOS-Mobile', 'IOS-Tablet',
                          'Android-Tablet', 'Android-Mobile']) {
      const block = CSS.match(
        new RegExp(`\\[data-device="${device}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      const decls = block.match(/--Font-Family-Body:[^;]+;/g) || [];
      const allResolve = decls.every((d) => /--Set-Font-Family-\w+\)/.test(d));
      expect(`${device}: ${decls.length > 0} ${allResolve}`).toBe(`${device}: true true`);
    }
  });
});
