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
import { DEVICE_TYPES, FACE_MODES, EYEBROW_WEB_FAMILY } from '../utils/typographyPlatform';

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
  it('never references the hook without a fallback OUTSIDE the block that defines it', () => {
    /* Belt as well as braces for the ramp: a declaration there that forgot its
       fallback breaks on any page that sets no data-device at all.
       The platform blocks are exempt, and only they: a bare reference is safe
       in the one rule that defines the hook two lines above it, where the two
       cannot be separated. Elsewhere there is no such guarantee. */
    const ramp = CSS.slice(0, CSS.indexOf('/* Platform font families'));
    const bare = ramp.match(/var\(--Platform-Font-Families-\w+\)\s*;/g) || [];
    expect(`bare hook references in the ramp: ${bare.length}`)
      .toBe('bare hook references in the ramp: 0');
  });

  it('defines all three roots for every device and face', () => {
    const missing: string[] = [];
    for (const face of FACE_MODES) {
      for (const device of DEVICE_TYPES) {
        const sel = face === 'Omni'
          ? `[data-device="${device}"],`
          : `[data-device="${device}"][data-typography="System"]`;
        const block = declsFor(sel);
        for (const root of ['Header', 'Body', 'Decorative', 'Eyebrow']) {
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

  it('passes a family for the overline, on the EYEBROW face', () => {
    /* Overline is the back-compat name for Eyebrow, so it reads the eyebrow
       hook. It has pointed at two wrong things: first Decorative — the display
       face, which is the eyebrow-in-the-display-font bug in the one block
       nobody reads — then Body, which was right only while Figma had Eyebrow
       aliased to Body and stopped being right the moment it got its own
       variable. Both wrong answers rendered a real font. */
    const decls = CSS.match(/--Font-Family-Overline:[^;]+;/g) || [];
    expect(`overline declared: ${decls.length > 0}`).toBe('overline declared: true');
    /* An ALIAS, not a second copy of the eyebrow's source. Both names have to
       keep resolving — a published system's CSS is frozen — and the direction
       is load-bearing: Eyebrow is the name, so Overline is what reads. Two
       copies of one expression look identical in a diff until they disagree. */
    for (const d of decls) expect(d).toMatch(/var\(--Font-Family-Eyebrow\)/);
  });
});

/**
 * The eyebrow wears the PLATFORM's face, never the brand's.
 *
 * It is the one role that is not a picked face: an eyebrow is an interface
 * label, so Devices-Type fixes it to Inter on Desktop and the native UI face on
 * a phone or tablet — in BOTH Omni and System. Everything else in the ramp
 * follows the face mode; this must not.
 *
 * Inter rather than SF Pro on Desktop for licensing as much as rendering:
 * Apple grants SF only for designing interfaces for Apple platforms, so it
 * cannot ship inside a design system handed to other people.
 */
describe('the eyebrow face', () => {
  const block = (d: string, face: 'Omni' | 'System') => declsFor(
    face === 'Omni' ? `[data-device="${d}"],` : `[data-device="${d}"][data-typography="System"]`);

  it('is Inter on Desktop in both face modes', () => {
    for (const face of ['Omni', 'System'] as const) {
      expect(`${face}: ${/--Platform-Font-Families-Eyebrow:\s*Inter/.test(block('Desktop', face))}`)
        .toBe(`${face}: true`);
    }
  });

  it('is the native face on a device, in both face modes', () => {
    for (const face of ['Omni', 'System'] as const) {
      expect(block('IOS-Mobile', face)).toMatch(/--Platform-Font-Families-Eyebrow:[^;]*apple-system/);
      expect(block('Android-Mobile', face)).toMatch(/--Platform-Font-Families-Eyebrow:\s*Roboto/);
    }
  });

  it('never follows the brand, on any device or face', () => {
    /* The failure this prevents is the quiet one: a brand token in this slot
       still produces a real font, so the eyebrow would simply start speaking
       in the design's voice with nothing to see. */
    for (const face of ['Omni', 'System'] as const) {
      for (const d of DEVICE_TYPES) {
        const decl = block(d, face).match(/--Platform-Font-Families-Eyebrow:[^;]+;/)?.[0] ?? '';
        expect(`${face}/${d}: ${/--Set-Font-Family-/.test(decl)}`).toBe(`${face}/${d}: false`);
      }
    }
  });

  it('asks nothing of the web for a face the device already has', () => {
    /* Only Inter has to arrive over the wire. If a native stack ever ended up
       in the import list it would 404 against Google Fonts — "SF Pro" is not a
       webfont and no CDN serves it. */
    expect(EYEBROW_WEB_FAMILY).toBe('Inter');
  });
});
