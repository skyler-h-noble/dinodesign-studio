/**
 * Omni / System typography — the structure and the values.
 *
 * The values are parsed out of the GENERATED stylesheet rather than computed
 * again, so these tests assert the parse and the shape. A second computation
 * of the ramp here would be exactly the divergence invariant 5 describes.
 */
import { describe, it, expect } from 'vitest';
import {
  DEVICE_TYPES, FACE_MODES, SWITCHED_PROPS, DEVICE_PROPS, SEEDS_FROM, SYSTEM_FACE,
  sourceName, parsePlatformBlock, typographyVariablePayload, payloadNames,
  blockSelector, faceSelector, LEGACY_DEVICE_ALIAS,
} from '../utils/typographyPlatform';
/* The same `?raw` import the app uses, so this exercises the real path.
   It returned an EMPTY STRING until `test: { css: true }` was set in
   vite.config.ts — vitest stubs CSS imports by default, and a stub is
   indistinguishable from a file with no platform blocks in it. Every
   assertion below would have passed on nothing. */
import { typographyTokensCSS } from '../utils/typographyTokens';

const P = typographyVariablePayload(typographyTokensCSS);

describe('the parse', () => {
  it('reads every style out of a platform block', () => {
    const { styles } = parsePlatformBlock(typographyTokensCSS, 'IOS-Mobile');
    expect(Object.keys(styles).length).toBe(36);
    expect(styles['H1']).toEqual({
      'Font-Size': '28px', 'Font-Weight': '600',
      'Line-Height': '28px', 'Letter-Spacing': '0px',
    });
  });

  it('takes the LAST family declaration in a section, as the cascade does', () => {
    /* The mobile blocks declare --Font-Family-Body twice: once under Headers
       pointing at the DECORATIVE family, then again under Body pointing at
       Body. The browser uses the second. Reading the first would record a
       value nothing renders. */
    const { families } = parsePlatformBlock(typographyTokensCSS, 'IOS-Mobile');
    expect(families['Body']).toContain('Platform-Font-Families-Body');
  });
});

describe('the Devices-Type source', () => {
  it('gives every device the same variable names', () => {
    /* They are MODES, so the names are one set and only the values differ.
       A name present at one device and absent at another resolves to nothing
       on that device, which is the silent half of this whole class of bug. */
    const sets = DEVICE_TYPES.map((d) => payloadNames(P.devices[d]).join('|'));
    expect(new Set(sets).size).toBe(1);
  });

  it('carries both faces for every switched property', () => {
    for (const prop of SWITCHED_PROPS) {
      for (const face of FACE_MODES) {
        expect(P.devices.Desktop[sourceName(face, `H1-${prop}`)]).toBeDefined();
      }
    }
  });

  it('keeps the vertical rhythm OUT of the face split', () => {
    /* Size AND line-height are the device's, identical across both faces.
       Together they are the vertical rhythm: holding them fixed means
       toggling Omni / System reshapes glyphs and moves nothing down the page.
       Letter-spacing is the one switched property that touches layout, and it
       only widens or narrows a line — horizontal give is absorbed by
       wrapping, vertical give breaks a grid. */
    for (const prop of DEVICE_PROPS) {
      expect(P.devices.Desktop[`Typography/H1-${prop}`]).toBeDefined();
      for (const face of FACE_MODES) {
        expect(`${prop} switched: ${P.devices.Desktop[sourceName(face, `H1-${prop}`)] !== undefined}`)
          .toBe(`${prop} switched: false`);
      }
    }
  });

  it('switches only family, weight and tracking', () => {
    expect([...SWITCHED_PROPS]).toEqual(['Font-Weight', 'Letter-Spacing']);
    expect([...DEVICE_PROPS]).toEqual(['Font-Size', 'Line-Height']);
  });

  it('gives System the platform face and Omni the brand one', () => {
    const omni = P.devices['Android-Mobile'][sourceName('Omni', 'Body-Font-Family')];
    const sys = P.devices['Android-Mobile'][sourceName('System', 'Body-Font-Family')];
    expect(sys.value).toBe('Roboto');
    expect(String(omni.value)).toContain('Font-Families-Body');
    expect(P.devices['IOS-Mobile'][sourceName('System', 'Body-Font-Family')].value).toBe('"SF Pro"');
    expect(String(P.devices.Desktop[sourceName('System', 'Body-Font-Family')].value))
      .toContain('system-ui');
  });

  it('seeds the values from the block each device inherits', () => {
    /* Nothing rendered changes on the day this lands. */
    for (const d of DEVICE_TYPES) {
      const { styles } = parsePlatformBlock(typographyTokensCSS, SEEDS_FROM[d]);
      expect(P.devices[d]['Typography/H1-Font-Size'].value)
        .toBe(parseFloat(styles['H1']['Font-Size']));
    }
  });

  it('numbers are bare, not px strings', () => {
    /* Figma FLOAT variables hold numbers; "28px" would import as a string or
       not at all. */
    for (const [name, v] of Object.entries(P.devices.Desktop)) {
      if (name.endsWith('-Font-Family')) continue;
      expect(`${name}: ${typeof v.value}`).toBe(`${name}: number`);
    }
  });
});

describe('the Typography alias collection', () => {
  it('has exactly the two face modes', () => {
    expect(Object.keys(P.typography).sort()).toEqual(['Omni', 'System']);
  });

  it('points each mode at its own face', () => {
    expect(P.typography.Omni['H1-Font-Weight'].value)
      .toBe('{Typography.Omni.H1-Font-Weight}');
    expect(P.typography.System['H1-Font-Weight'].value)
      .toBe('{Typography.System.H1-Font-Weight}');
    expect(P.typography.Omni['H1-Letter-Spacing'].value)
      .toBe('{Typography.Omni.H1-Letter-Spacing}');
  });

  it('exposes the size too, identically in both modes', () => {
    /* A text style binds to this collection and nothing else, so the size has
       to be reachable here — but it does not switch, so both modes point at
       the one value. */
    for (const prop of DEVICE_PROPS) {
      expect(P.typography.Omni[`H1-${prop}`].value).toBe(`{Typography.H1-${prop}}`);
      expect(P.typography.System[`H1-${prop}`].value)
        .toBe(P.typography.Omni[`H1-${prop}`].value);
    }
  });

  it('every alias resolves to a name that exists in Devices-Type', () => {
    /* The whole point of the structure. A dangling alias is not an error in
       Figma — it is an unbound variable that renders as nothing. */
    const have = new Set(payloadNames(P.devices.Desktop));
    for (const face of FACE_MODES) {
      for (const [token, v] of Object.entries(P.typography[face])) {
        const path = String(v.value).slice(1, -1).replace(/\./g, '/');
        expect(`${face}/${token} -> ${have.has(path)}`).toBe(`${face}/${token} -> true`);
      }
    }
  });

  it('both modes carry the same names', () => {
    expect(payloadNames(P.typography.Omni)).toEqual(payloadNames(P.typography.System));
  });
});

describe('the CSS selectors', () => {
  it('Omni needs no attribute, so it is the default', () => {
    expect(faceSelector('Omni')).toBe('');
  });

  it('System outranks Omni on specificity, not on source order', () => {
    /* What ships today is [data-fonts] against [data-fonts="Default"] — a bare
       attribute selector matches ANY value, "Default" included, so the two
       have identical specificity and only file order decides. Here System
       carries one more attribute. */
    const sys = blockSelector('IOS-Mobile', 'System');
    const omni = blockSelector('IOS-Mobile', 'Omni');
    expect(sys).toContain('[data-typography="System"]');
    expect(omni).not.toContain('[data-typography');
    for (const sel of sys.split(',\n')) {
      expect(`${sel} attrs: ${(sel.match(/\[/g) || []).length >= 2}`)
        .toBe(`${sel} attrs: true`);
    }
  });

  it('keeps data-platform emitted beside data-device', () => {
    /* Generated CSS is frozen per system in Storage. A page written against an
       older system sets data-platform and always will; emitting only the new
       name gives it no block at all, silently. Same call as --Overline-*. */
    const sel = blockSelector('IOS-Mobile', 'Omni');
    expect(sel).toContain('[data-device="IOS-Mobile"]');
    expect(sel).toContain('[data-platform="IOS-Mobile"]');
  });

  it('keeps the old value spellings resolving', () => {
    /* `Android` used to mean the phone. */
    expect(LEGACY_DEVICE_ALIAS['Android']).toBe('Android-Mobile');
    const sel = blockSelector('Android-Mobile', 'Omni');
    expect(sel).toContain('[data-device="Android"]');
    expect(sel).toContain('[data-platform="Android"]');
  });

  it('accepts the old face attribute too', () => {
    const sel = blockSelector('IOS-Mobile', 'System');
    expect(sel).toContain('[data-fonts="Default"]');
  });
});
