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
  blockSelector, faceSelector, LEGACY_DEVICE_ALIAS, payloadIsAdditive,
  familyName, familyAlias, FAMILY_ROOT_OF, ROOT_ROLE, NON_STYLE_SECTIONS, groupedProp,
  resolveVar,
  mirrorsOmni, figmaFamily,
  variableForSection,
} from '../utils/typographyPlatform';
/* The same `?raw` import the app uses, so this exercises the real path.
   It returned an EMPTY STRING until `test: { css: true }` was set in
   vite.config.ts — vitest stubs CSS imports by default, and a stub is
   indistinguishable from a file with no platform blocks in it. Every
   assertion below would have passed on nothing. */
import { typographyTokensCSS, buildTypographyTokensCSS } from '../utils/typographyTokens';
import { resolveRoles, HEADER_CLAMPED_WEIGHT_FLOOR } from '../utils/typeScale';

/* The four faces, resolved. `resolveRoles(null)` is the real defaulting path,
   not a stub: it returns the fallback family for each role and pins Header to
   Google Sans Flex, which is what a design with no picked faces actually
   gets. */
const FACES = resolveRoles(null);
const P = typographyVariablePayload(typographyTokensCSS, FACES);

describe('the parse', () => {
  it('reads every style out of a platform block', () => {
    const { styles } = parsePlatformBlock(typographyTokensCSS, 'IOS-Mobile');
    /* 32, not 36: the three --Body-<step>-Bold-Font-Weight tokens are excluded
       because Body has no bold, and Button-ExtraSmall because the design does
       not use one. See EXCLUDED_STYLES. */
    expect(Object.keys(styles).length).toBe(32);
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
        expect(P.devices.Desktop[sourceName(face, groupedProp('H1', prop))]).toBeDefined();
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
      expect(P.devices.Desktop[`Typography/${groupedProp('H1', prop)}`]).toBeDefined();
      for (const face of FACE_MODES) {
        expect(`${prop} switched: ${P.devices.Desktop[sourceName(face, groupedProp('H1', prop))] !== undefined}`)
          .toBe(`${prop} switched: false`);
      }
    }
  });

  it('switches only family, weight and tracking', () => {
    expect([...SWITCHED_PROPS]).toEqual(['Font-Weight', 'Letter-Spacing']);
    expect([...DEVICE_PROPS]).toEqual(['Font-Size', 'Line-Height']);
  });

  /* A family is a LITERAL on the face root and an ALIAS on every style.
   *
   * The previous version of this test asserted
   *   expect(String(omni.value)).toContain('Font-Families-Body')
   * which pinned `var(--Platform-Font-Families-Body)` in place as the correct
   * answer. It is a CSS reference written into a Figma STRING: stored as text,
   * bindable by nothing, and pointing at a collection that is being removed.
   * The test passed for as long as the bug survived, which is the whole of its
   * usefulness as a warning. */
  it('puts a literal family on each of the three roots, never a var()', () => {
    for (const d of DEVICE_TYPES) {
      for (const face of FACE_MODES) {
        for (const root of Object.keys(ROOT_ROLE)) {
          const v = P.devices[d][familyName(face, root)];
          expect(v, `${d} ${face} ${root}`).toBeDefined();
          expect(String(v.value)).not.toContain('var(');
          expect(String(v.value)).not.toContain('{');   // a literal, not a link
        }
      }
    }
  });

  it('points every other style at the root it wears', () => {
    /* The structure built by hand in the file: Display, Headers and Body hold
       a name; Subtitle, Caption, Label, Legal, Number, Button and Overline all
       link to Body. */
    for (const d of DEVICE_TYPES) {
      const bag = P.devices[d];
      for (const style of ['Subtitle', 'Caption', 'Label', 'Legal', 'Number', 'Button', 'Eyebrow']) {
        const v = bag[familyName('Omni', style)];
        if (!v) continue;   // a device whose block does not declare that section
        expect(v.value, `${d} ${style}`).toBe(familyAlias('Omni', 'Body'));
      }
    }
  });

  it('gives System the platform face on all three roots, unquoted', () => {
    expect(P.devices['Android-Mobile'][familyName('System', 'Body')].value).toBe('Roboto');
    expect(P.devices['Android-Mobile'][familyName('System', 'Headers')].value).toBe('Roboto');
    expect(P.devices['IOS-Mobile'][familyName('System', 'Body')].value).toBe('SF Pro');
    /* Desktop's System face is Omni's — see mirrorsOmni. It used to be the CSS
       stack, which no Figma family variable can hold. */
    expect(P.devices.Desktop[familyName('System', 'Body')].value)
      .toBe(P.devices.Desktop[familyName('Omni', 'Body')].value);
  });

  it('skips the Omni roots when no faces are given, rather than inventing one', () => {
    /* A wrong family name in Figma renders as a real font and looks deliberate;
       a missing variable is visible in the panel. Absence is the safer failure,
       so the payload declines to guess. */
    const bare = typographyVariablePayload(typographyTokensCSS);
    expect(bare.devices.Desktop[familyName('Omni', 'Body')]).toBeUndefined();
    /* Desktop's System root is the brand face too, so it goes with it. A device
       whose System face is the PLATFORM's still gets one — that value never
       depended on the design. */
    expect(bare.devices.Desktop[familyName('System', 'Body')]).toBeUndefined();
    expect(bare.devices['Android-Mobile'][familyName('System', 'Body')].value).toBe('Roboto');
  });

  it('never reads a face-definition section as a style', () => {
    /* `Faces-Font-Family` — the face DEFINITIONS block read as a type style,
       carrying a var() into the panel. The first thing anyone noticed. */
    for (const d of DEVICE_TYPES) {
      for (const name of Object.keys(P.devices[d])) {
        expect(name).not.toContain('Faces-Font-Family');
        expect(name).not.toContain('Face weights');
      }
    }
  });

  /* The GENERATED Desktop block, which is what actually ships — the static one
     in the asset file is replaced per design system. Every test above reads the
     static file and so never saw this. */
  const GEN = buildTypographyTokensCSS(null);

  it('resolves a weight that the block states once and references per step', () => {
    /* The generated Desktop block writes
         --H1-Font-Weight: var(--Font-Weight-Header);
       and declares the number once under Face weights. parseFloat on that is
       NaN, the property gets dropped, and the Figma variable keeps whatever it
       held — every Desktop weight read 0, while the mobile blocks, which spell
       their numbers out, were fine. */
    const { styles } = parsePlatformBlock(GEN, 'Desktop');
    expect(styles['H1']['Font-Weight']).toBe('600');
    const G = typographyVariablePayload(GEN, resolveRoles(null));
    const weights = Object.keys(G.devices.Desktop).filter((k) => k.includes('Font-Weight'));
    expect(weights.length).toBeGreaterThan(0);
    for (const k of weights) expect(Number(G.devices.Desktop[k].value), k).toBeGreaterThan(0);
  });

  it('resolves only what the block itself declares', () => {
    const declared = { A: '600', B: 'var(--A)' };
    expect(resolveVar('var(--B)', declared)).toBe('600');
    expect(resolveVar('var(--Missing, 400)', declared)).toBe('400');
    /* A name the block does not define is the consumer's to set — left alone so
       the caller drops it, rather than guessed at. */
    expect(resolveVar('var(--Set-Font-Family-Header)', declared))
      .toBe('var(--Set-Font-Family-Header)');
    /* A cycle must not hang the export. */
    expect(() => resolveVar('var(--X)', { X: 'var(--Y)', Y: 'var(--X)' })).not.toThrow();
  });

  it("relays the user's Display and Header weights all the way to Figma", () => {
    /* The whole point of the collection. These read 0 until var() resolution
       landed, because the generated block states each weight once and
       references it per step. */
    const picked: any = [
      { type: 'decorative', family: 'Playfair Display', weight: '800' },
      { type: 'header', family: 'Whatever', weight: '250' },
      { type: 'body', family: 'Source Sans 3', weight: '300' },
    ];
    const css = buildTypographyTokensCSS(picked);
    const roles = resolveRoles(picked);
    const D = typographyVariablePayload(css, roles).devices.Desktop;
    const weight = (k: string) => D[sourceName('Omni', groupedProp(k, 'Font-Weight'))].value;

    expect(weight('Display-Large')).toBe(800);   // the Decorative pick
    expect(weight('H1')).toBe(250);              // the Header pick
    expect(weight('H3')).toBe(250);
    expect(weight('Body-Medium')).toBe(300);

    /* H4-H6 are the user's header weight too, with a FLOOR of 500. Only ever
       raised, never lowered — a 250 that reads elegant at 48px reads washed out
       at 18px — and snapped to a weight the face actually ships, since asking a
       static 400/700 face for 500 gives 400 on some platforms and 700 on
       others. Below the floor: */
    expect(weight('H4')).toBe(HEADER_CLAMPED_WEIGHT_FLOOR);
    expect(weight('H6')).toBe(HEADER_CLAMPED_WEIGHT_FLOOR);

    /* And the families the user picked, as literals. */
    expect(D[familyName('Omni', 'Display')].value).toBe('Playfair Display');
    expect(D[familyName('Omni', 'Body')].value).toBe('Source Sans 3');
  });

  it('passes a header weight AT or ABOVE the floor through to H4-H6 untouched', () => {
    /* The other arm, and the one that says the clamp is a floor rather than a
       value: a design that asked for 700 keeps 700 on every header step. This
       rule exists to strengthen small headers, not to flatten bold ones — and
       without this case a clamp that simply wrote 500 everywhere would pass. */
    const bold: any = [
      { type: 'decorative', family: 'Playfair Display', weight: '800' },
      { type: 'header', family: 'Whatever', weight: '700' },
      { type: 'body', family: 'Source Sans 3', weight: '300' },
    ];
    const D = typographyVariablePayload(
      buildTypographyTokensCSS(bold), resolveRoles(bold)).devices.Desktop;
    for (const step of ['H1', 'H3', 'H4', 'H6'])
      expect(D[sourceName('Omni', groupedProp(step, 'Font-Weight'))].value, step).toBe(700);
  });

  it('offers Body as Semibold, never as Bold', () => {
    /* Body ships standard and semibold; bold at body sizes is what Subtitle is
       for, and the lib resolves variant="body-bold" to the SEMIBOLD style. The
       static mobile blocks still declare --Body-<step>-Bold-Font-Weight: 700,
       and the CSS must keep emitting it because a published stylesheet cannot
       be regenerated. Figma must not: a variable there is an offer, and a
       designer picking Body-Large-Bold would get 700 in the mock against
       semibold in the build, with nothing reporting the difference. */
    for (const d of DEVICE_TYPES) {
      for (const face of FACE_MODES) {
        for (const step of ['Small', 'Medium', 'Large']) {
          expect(P.devices[d][sourceName(face, groupedProp(`Body-${step}-Semibold`, 'Font-Weight'))], `${d} ${step}`)
            .toBeDefined();
          expect(P.devices[d][sourceName(face, groupedProp(`Body-${step}-Bold`, 'Font-Weight'))], `${d} ${step}`)
            .toBeUndefined();
        }
        /* Caption and Legal really do ship those weights, so their names mean
           what they say and must survive the exclusion. */
        expect(P.devices[d][sourceName(face, groupedProp('Caption-Bold', 'Font-Weight'))]).toBeDefined();
      }
    }
  });

  it('carries no paragraph spacing', () => {
    /* Deliberate: the text styles do not take it from this collection. It falls
       out of the parse rather than being filtered, so this is the thing holding
       it — adding Paragraph-Spacing to the prop pattern would start emitting it
       with nothing to say that was intended. */
    for (const d of DEVICE_TYPES)
      for (const name of Object.keys(P.devices[d]))
        expect(name).not.toContain('Paragraph');
  });

  it('gives Desktop the same System values as Omni', () => {
    /* "The system font" is not one font on Desktop — Segoe, SF, whatever the
       distro picked — so the CSS answers with a stack, and a Figma family
       variable holds one NAME. Desktop is also the brand's own surface, so
       there is nothing for System to mean there that Omni does not say. */
    expect(mirrorsOmni('Desktop')).toBe(true);
    const d = P.devices.Desktop;
    const resolve = (v: unknown): unknown => {
      const m = String(v).match(/^\{Typography\.(Omni|System)\.(.+)\}$/);
      /* The path is dotted in the alias and slashed in the name. */
      return m ? d[sourceName(m[1] as 'Omni' | 'System', m[2].split('.').join('/'))].value : v;
    };
    for (const key of Object.keys(d)) {
      if (!key.startsWith('Typography/Omni/')) continue;
      const sys = d[key.replace('/Omni/', '/System/')];
      if (!sys) continue;
      /* Resolved, not literal: a family is an alias on either side and the two
         point at their OWN root, which is correct — flattening System's styles
         onto Omni's root would break the switch on every other device. What has
         to match is what they resolve TO. */
      expect(resolve(sys.value), key).toEqual(resolve(d[key].value));
    }
  });

  it('writes a font NAME, never a CSS stack or a quoted family', () => {
    /* Figma stores a font name. `"SF Pro"` keeps its quotes and matches
       nothing; a comma-separated stack matches nothing either. Both render in a
       fallback and look like a deliberate choice. */
    expect(figmaFamily('"SF Pro"')).toBe('SF Pro');
    for (const dev of DEVICE_TYPES) {
      for (const face of FACE_MODES) {
        for (const root of Object.keys(ROOT_ROLE)) {
          const v = String(P.devices[dev][familyName(face, root)].value);
          expect(v, `${dev} ${face} ${root}`).not.toContain(',');
          expect(v, `${dev} ${face} ${root}`).not.toContain('"');
        }
      }
    }
  });

  it('spells the eyebrow Eyebrow everywhere, and never Overline', () => {
    /* The two blocks disagreed: the generated Desktop one is post-rename and
       writes Eyebrow-*, the static mobile ones still write Overline-*. Read as
       separate styles that produced two variables per property, each filled on
       the devices whose block used its spelling and left at a stale 0 on the
       rest — Overline-Small-Font-Weight read 0 on Desktop and 500 on the
       tablets. */
    for (const d of DEVICE_TYPES) {
      const bag = P.devices[d];
      for (const name of Object.keys(bag)) expect(name, d).not.toContain('Overline');
      for (const step of ['Small', 'Medium', 'Large']) {
        for (const face of FACE_MODES) {
          const w = bag[sourceName(face, groupedProp(`Eyebrow-${step}`, 'Font-Weight'))];
          expect(w, `${d} ${face} ${step}`).toBeDefined();
          expect(Number(w.value)).toBeGreaterThan(0);
        }
        expect(Number(bag[`Typography/${groupedProp(`Eyebrow-${step}`, 'Font-Size')}`].value)).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a back-compat var() alias overwrite the value it points at', () => {
    /* --Overline-<prop>: var(--Eyebrow-<prop>) is emitted right after the
       canonical token. Folding the names without this rule would land the alias
       last; a var() string parses to NaN, the property would be dropped, and
       the Figma variable would silently keep whatever it held before. */
    const { styles } = parsePlatformBlock(typographyTokensCSS, 'Desktop');
    for (const [style, props] of Object.entries(styles))
      for (const [prop, value] of Object.entries(props))
        expect(String(value), `${style} ${prop}`).not.toContain('var(');
  });

  it('emits Eyebrow as the seam, and no Overline family at all', () => {
    /* Eyebrow is where a design repoints the eyebrow face; the text styles bind
       to it. Overline-Font-Family is gone from the file, so emitting one would
       create a variable nothing references. */
    for (const d of DEVICE_TYPES) {
      expect(P.devices[d][familyName('Omni', 'Eyebrow')].value).toBe(familyAlias('Omni', 'Body'));
      expect(P.devices[d][familyName('Omni', 'Overline')]).toBeUndefined();
      expect(P.devices[d][familyName('System', 'Overline')]).toBeUndefined();
    }
  });

  it('has a root for every section the stylesheet declares', () => {
    /* The role table is stated, not derived — this is what stops the two
       drifting apart when a section is added on one side only. */
    for (const d of DEVICE_TYPES) {
      const { families } = parsePlatformBlock(typographyTokensCSS, SEEDS_FROM[d]);
      for (const section of Object.keys(families)) {
        if (NON_STYLE_SECTIONS.has(section)) continue;
        const v = variableForSection(section);
        expect(FAMILY_ROOT_OF[v], `no root for section "${section}" (variable "${v}")`).toBeDefined();
      }
    }
  });

  it('seeds the values from the block each device inherits', () => {
    /* Nothing rendered changes on the day this lands. */
    for (const d of DEVICE_TYPES) {
      const { styles } = parsePlatformBlock(typographyTokensCSS, SEEDS_FROM[d]);
      expect(P.devices[d][`Typography/${groupedProp('H1', 'Font-Size')}`].value)
        .toBe(parseFloat(styles['H1']['Font-Size']));
    }
  });

  it('names nothing outside the Typography group', () => {
    /* Devices-Type already holds ~100 variables that are not typography. This
       payload must ADD to the collection, never define it — an importer that
       creates-or-updates by name then leaves the rest alone.
       
       The consequence of getting it wrong is not a failed import. It is a
       quietly emptied collection, and a deleted Figma variable cannot be
       recovered by re-importing: the recreated one gets a new id and every
       layer bound to the old one stays unbound (invariant 8). */
    for (const d of DEVICE_TYPES) {
      const stray = payloadNames(P.devices[d]).filter((n) => !n.startsWith('Typography/'));
      expect(`${d} stray names: ${stray.join(',') || 'none'}`).toBe(`${d} stray names: none`);
      expect(payloadIsAdditive(P.devices[d])).toBe(true);
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
    const w = groupedProp('H1', 'Font-Weight');
    const dotted = (face: string, n: string) => `{Typography.${face}.${n.split('/').join('.')}}`;
    expect(P.typography.Omni[w].value).toBe(dotted('Omni', w));
    expect(P.typography.System[w].value).toBe(dotted('System', w));
    const ls = groupedProp('H1', 'Letter-Spacing');
    expect(P.typography.Omni[ls].value).toBe(dotted('Omni', ls));
  });

  it('exposes the size too, identically in both modes', () => {
    /* A text style binds to this collection and nothing else, so the size has
       to be reachable here — but it does not switch, so both modes point at
       the one value. */
    for (const prop of DEVICE_PROPS) {
      const key = groupedProp('H1', prop);
      expect(P.typography.Omni[key].value)
        .toBe(`{Typography.${key.split('/').join('.')}}`);
      expect(P.typography.System[key].value).toBe(P.typography.Omni[key].value);
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
