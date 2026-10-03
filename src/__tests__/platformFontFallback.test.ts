/**
 * The platform font hook is real, and changing the device changes the face.
 *
 * --Platform-Font-Families-Header / -Body / -Decorative sit in front of every
 * face in the ramp. NOTHING ever defined them, so outside the Desktop block
 * they resolved to nothing: a var() on an undefined property with no fallback
 * computes to the guaranteed-invalid value, the token is invalid at
 * computed-value time, and `font-family: var(--Font-Family-Body)` becomes
 * `unset` — the text inherits the ancestor's face rather than falling back to
 * the brand's. 135 declarations shipped that way, and only Desktop escaped,
 * because the generator regenerates that one block WITH fallbacks. The one
 * device everybody previews on was the one device that worked.
 *
 * The hook was never wrong, only empty. What belongs in it is in Figma under
 * Devices-Type, and it is a choice the design file has always expressed and
 * the CSS could not:
 *
 *   Typography mode   Desktop   iOS       Android
 *   Omni              brand     brand     brand
 *   System            brand     SF Pro    Roboto
 *
 * Three roots carry it: in Devices-Type every other family — Caption, Subtitle,
 * Label, Legal, Eyebrow, Number, Button, Mobile-Nav-Label — is an ALIAS of
 * Body-Font-Family. Only Headers, Body and Display hold their own.
 */
import { describe, it, expect } from 'vitest';
import { buildTypographyTokensCSS } from '../utils/typographyTokens';
import { DEVICE_TYPES, FACE_MODES } from '../utils/typographyPlatform';

const CSS = buildTypographyTokensCSS([
  { type: 'decorative', family: 'Fredoka', weight: '700', displaySize: '76' },
  { type: 'header', family: 'Google Sans Flex', weight: '300' },
  { type: 'body', family: 'Poppins', weight: '400' },
] as never);

/* Each block is a comma list — the new attribute, the legacy data-platform,
   and for System the legacy face spellings too — so a block is located by ANY
   one of its selectors rather than by an exact opening line. */
const declsFor = (selector: string): string => {
  const i = CSS.indexOf(selector);
  if (i === -1) return '';
  const open = CSS.indexOf('{', i);
  return open === -1 ? '' : CSS.slice(open, CSS.indexOf('}', open));
};

describe('every face resolves to a real family', () => {
  it('never references the hook without a fallback', () => {
    /* Belt as well as braces: the blocks below define the hook, but a ramp
       declaration that forgot its fallback would still break on any page that
       sets no data-device at all. */
    const bare = CSS.match(/var\(--Platform-Font-Families-\w+\)\s*;/g) || [];
    expect(`bare hook references: ${bare.length}`).toBe('bare hook references: 0');
  });

  it('defines all three roots for every device and face', () => {
    const missing: string[] = [];
    for (const face of FACE_MODES) {
      for (const device of DEVICE_TYPES) {
        const sel = face === 'Omni'
          ? `[data-device="${device}"],`
          : `[data-device="${device}"][data-typography="System"]`;
        const block = declsFor(sel);
        for (const root of ['Header', 'Body', 'Decorative']) {
          if (!block.includes(`--Platform-Font-Families-${root}:`)) {
            missing.push(`${face}/${device}/${root}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('wears the platform face under System and the brand face under Omni', () => {
    /* The whole point of the hook. If these came out equal, the device switch
       would do nothing and every wrong answer would still be a real font. */
    const sys = (d: string) => declsFor(`[data-device="${d}"][data-typography="System"]`);
    expect(sys('IOS-Mobile')).toMatch(/--Platform-Font-Families-Body:[^;]*SF Pro/);
    expect(sys('Android-Mobile')).toMatch(/--Platform-Font-Families-Body:\s*Roboto/);
    /* Desktop is the exception in the design: System there still means the
       brand's own faces, because there is no "native desktop UI font" to mean. */
    expect(sys('Desktop')).toMatch(/--Platform-Font-Families-Body:\s*var\(--Set-Font-Family-Body\)/);

    for (const d of DEVICE_TYPES) {
      const omni = declsFor(`[data-device="${d}"],`);
      expect(`omni ${d} found: ${omni.length > 0}`).toBe(`omni ${d} found: true`);
      expect(omni).toMatch(/--Platform-Font-Families-Body:\s*var\(--Set-Font-Family-Body\)/);
    }
  });

  it('passes a family for the overline, on the BODY face', () => {
    /* Figma aliases Eyebrow-Font-Family to Body-Font-Family in both Omni and
       System. Three declarations pointed at Decorative instead, which is the
       display face — the eyebrow-in-the-display-font bug, in the one place
       nobody reads. */
    const decls = CSS.match(/--Font-Family-Overline:[^;]+;/g) || [];
    expect(`overline declared: ${decls.length > 0}`).toBe('overline declared: true');
    for (const d of decls) expect(d).toMatch(/--Platform-Font-Families-Body/);
  });
});
