/**
 * Button-Medium / Button-Standard aliasing.
 *
 * Button-Standard was renamed to Button-Medium because `Standard` in this
 * file means "this group has ONE size" — the contract Legal and Badge use —
 * and Button has four. The old name keeps being emitted.
 *
 * This mirrors eyebrowAlias.test.ts deliberately. Both are the same decision:
 * a design system's CSS is frozen in Storage and can never be regenerated, so
 * a name that has ever shipped has to keep resolving no matter what the design
 * calls it now. Figma is the opposite — a live file, so it carries only the
 * new name.
 */
import { describe, it, expect } from 'vitest';
import { typographyDeclarations } from '../utils/cssgen/generateTypographyTokensCSS';
import { EXCLUDED_STYLES } from '../utils/typographyPlatform';

const css = () => typographyDeclarations([
  { type: 'Display', family: 'Anton', weight: '400', letterSpacing: '0em' },
  { type: 'Header', family: 'Google Sans Flex', weight: '600', letterSpacing: '0em' },
  { type: 'Body', family: 'Poppins', weight: '400', letterSpacing: '0em' },
] as any);

const PROPS = ['Font-Size', 'Font-Weight', 'Line-Height', 'Letter-Spacing'];

describe('Button-Medium / Button-Standard aliasing', () => {
  it('emits the Button-Medium names', () => {
    const out = css();
    for (const prop of PROPS) {
      expect(out, `missing --Button-Medium-${prop}`).toContain(`--Button-Medium-${prop}`);
    }
  });

  it('KEEPS the Button-Standard names', () => {
    /* The lib still asks for them:
         var(--Button-Standard-Font-Size, var(--Button-Font-Size))
       (~/DinoDesign/src/components/Typography/Typography.js:539)
       Dropping them leaves an unresolved var(), which paints nothing and
       reports nothing — and the fallback behind it is the unstepped aggregate,
       which disagrees with the ramp on iOS-Tablet (backlog item 17). So the
       failure would not even be uniform. */
    const out = css();
    for (const prop of PROPS) {
      expect(out, `dropped --Button-Standard-${prop}`).toContain(`--Button-Standard-${prop}`);
    }
  });

  it('aliases by reference, and the DIRECTION is Standard -> Medium', () => {
    /* One literal, one name that reads it. Pointed the other way it also
       cannot drift and looks identical in a diff, while quietly making
       Standard canonical again and undoing the rename — which is exactly the
       failure eyebrowAlias.test.ts was written to catch for Overline. */
    const out = css();
    expect(out).toContain('--Button-Standard-Font-Size: var(--Button-Medium-Font-Size);');
    expect(out).not.toContain('--Button-Medium-Font-Size: var(--Button-Standard-Font-Size);');
  });

  it('does not alias the other Button steps', () => {
    /* Only the renamed step gets a back-compat name. Small and Large were
       never called anything else, so an alias there would invent a token that
       has never shipped and then have to be kept forever. */
    const out = css();
    expect(out).not.toContain('--Button-Standard-Small');
    expect(out).not.toContain('--Button-Standard-Large');
  });

  it('keeps Button-Standard OUT of the Figma payload', () => {
    /* The whole point of the split: CSS keeps the old name, Figma does not.
       Without this the payload grows a Button-Standard group beside
       Button-Medium holding the same numbers, and a designer can pick either. */
    expect(EXCLUDED_STYLES.test('Button-Standard')).toBe(true);
    expect(EXCLUDED_STYLES.test('Button-Medium')).toBe(false);
  });

  it('leaves the unstepped aggregate alone', () => {
    /* --Button-Font-Size is core.css's, per platform, and is the FALLBACK
       behind the stepped token rather than another name for it. The alias must
       not collide with it. */
    const out = css();
    expect(out).not.toContain('--Button-Font-Size: var(');
  });
});
