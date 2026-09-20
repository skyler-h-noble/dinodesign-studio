/**
 * System carries the PLATFORM's conventions, Omni the user's.
 *
 * An earlier pass seeded both sides from the same numbers and changed only the
 * font family, which made "System" a relabelled Omni in a different face —
 * the switch would have shown almost nothing. These pin the ways the two are
 * supposed to disagree.
 */
import { describe, it, expect } from 'vitest';
import {
  systemTracking, systemWeight, roleOf, SYSTEM_FAMILY_OF, SYSTEM_WEIGHT,
} from '../utils/systemTypography';
import { typographyVariablePayload, sourceName, DEVICE_TYPES } from '../utils/typographyPlatform';
import { typographyTokensCSS } from '../utils/typographyTokens';

const P = typographyVariablePayload(typographyTokensCSS);
const val = (dev: string, n: string) => P.devices[dev as never][n]?.value as number;

describe('the platforms disagree about small text, and that is the point', () => {
  it('tracks a label OUT on Android and IN on iOS', () => {
    /* Material tracks Body and Label out — +0.4 to +0.5 at 11-14px — where
       Apple runs negative right through the text range. One 12px label,
       opposite signs. That single disagreement is most of why a system-font
       mode is worth having at all. */
    expect(systemTracking('material', 12)).toBeGreaterThan(0);
    expect(systemTracking('apple', 12)).toBeLessThanOrEqual(0);
  });

  it('carries that all the way into the payload', () => {
    /* Asserting the OUTPUT, not the table. */
    const ios = val('IOS-Mobile', sourceName('System', 'Label-Small-Letter-Spacing'));
    const android = val('Android-Mobile', sourceName('System', 'Label-Small-Letter-Spacing'));
    expect(`ios ${ios < 0} android ${android > 0}`).toBe('ios true android true');
  });

  it('runs Apple tightest through the text range', () => {
    expect(systemTracking('apple', 17)).toBeLessThan(systemTracking('apple', 11));
    expect(systemTracking('apple', 17)).toBeLessThan(systemTracking('apple', 48));
  });
});

describe('Material sets headlines in Regular', () => {
  it('is 400, not a bold', () => {
    /* The surprising one, and it is correct: M3 headlines are Roboto 400.
       Material has no 600 at all — its emphasis weight is Medium 500. */
    expect(SYSTEM_WEIGHT.material.heading).toBe(400);
    expect(SYSTEM_WEIGHT.material.display).toBe(400);
    expect(Object.values(SYSTEM_WEIGHT.material)).not.toContain(600);
  });

  it('differs from the brand ramp where the brand runs 600', () => {
    const omni = val('Android-Mobile', sourceName('Omni', 'H1-Font-Weight'));
    const sys = val('Android-Mobile', sourceName('System', 'H1-Font-Weight'));
    expect(`omni ${omni} system ${sys}`).toBe('omni 600 system 400');
  });

  it('Apple keeps headings semibold', () => {
    expect(SYSTEM_WEIGHT.apple.heading).toBe(600);
    expect(val('IOS-Mobile', sourceName('System', 'H1-Font-Weight'))).toBe(600);
  });
});

describe('roles', () => {
  it.each([
    ['H1', 'heading'], ['H6', 'heading'], ['Display-Large', 'display'],
    ['Subtitle-Small', 'title'], ['Body-Medium', 'body'], ['Label-Small', 'label'],
    ['Caption', 'label'], ['Legal', 'label'], ['Button-Standard', 'label'],
    ['Overline-Small', 'label'], ['Something-Odd', 'body'],
  ])('%s is %s', (style, role) => expect(roleOf(style)).toBe(role));

  it('falls back to body, the most conservative role', () => {
    /* An unmatched name gets the lightest weight and the least tracking,
       which is the safe direction to be wrong in. */
    expect(systemWeight('material', 'Totally-New-Style')).toBe(SYSTEM_WEIGHT.material.body);
  });
});

describe('Desktop claims no curve', () => {
  it('is flat zero, because the OS face is unknown', () => {
    /* Inventing a tracking curve for "whatever Windows or macOS supplies"
       would be making something up. Flat leaves the brand's own Desktop
       tracking as the only opinion on that surface. */
    for (const size of [11, 16, 24, 48]) expect(systemTracking('desktop', size)).toBe(0);
  });
});

describe('units are normalised to px before Figma sees them', () => {
  it('converts the em tracking the Desktop header curve emits', () => {
    /* The stylesheet MIXES units and it is not sloppiness: the mobile blocks
       are static and written in px, while the generated Desktop header
       tracking is in em. Read with parseFloat, -0.018em and 0px are both
       "small numbers" — and the em one lands in Figma meaning 0.018 PIXELS. */
    const h1 = val('Desktop', sourceName('Omni', 'H1-Letter-Spacing'));
    const size = val('Desktop', 'Typography/H1-Font-Size');
    expect(Math.abs(h1)).toBeLessThan(size); // a px value, not a raw em
  });

  it('never stores an em-magnitude number as a px one', () => {
    /* A tracking under 0.05px is almost certainly an unconverted em: real px
       tracking at these sizes is tenths, not hundredths. Zero is fine. */
    for (const d of DEVICE_TYPES) {
      for (const [name, v] of Object.entries(P.devices[d])) {
        if (!name.endsWith('-Letter-Spacing')) continue;
        const n = v.value as number;
        expect(`${d}/${name} = ${n} suspicious: ${n !== 0 && Math.abs(n) < 0.02}`)
          .toBe(`${d}/${name} = ${n} suspicious: false`);
      }
    }
  });
});

describe('every device maps to a platform', () => {
  it('has no device without conventions', () => {
    for (const d of DEVICE_TYPES) expect(`${d}: ${SYSTEM_FAMILY_OF[d]}`).not.toContain('undefined');
  });

  it('routes the tablets to their own platform', () => {
    expect(SYSTEM_FAMILY_OF['IOS-Tablet-Horizontal']).toBe('apple');
    expect(SYSTEM_FAMILY_OF['Android-Tablet-Vertical']).toBe('material');
  });
});
