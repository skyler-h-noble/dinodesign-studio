/**
 * Component-Size — one variable per metric, three values keyed by mode.
 *
 * The Figma payload has always carried these as flat triples: Button-Height,
 * Sm-Button-Height, Lg-Button-Height. That shape exists because the old
 * Components collection had a single mode, so the size had to live in the NAME.
 *
 * Component-Size has medium / small / large as real modes, which is a better
 * structure for the same information: one component in the library with one
 * variant, and switching its size switches the mode. Three variants per
 * component — each carrying its own copy of every metric — is the thing this
 * removes.
 *
 * So this regroups rather than recomputes. The numbers are already correct and
 * already agree with the CSS; splitting them by prefix cannot change a value,
 * only where it sits. Recomputing them here would be a second implementation
 * of the sizing rules and the two would drift — the failure this codebase has
 * hit repeatedly.
 */

/** Figma renders a "/" in a variable's name as a group, and the plugin indexes
 *  by that full name. The collection name is NOT part of it. */
const GROUPED = (group: string, name: string) => `${group}/${name}`;

export type SizeMode = 'medium' | 'small' | 'large';
export const SIZE_MODES: SizeMode[] = ['medium', 'small', 'large'];

/** medium has no prefix — it is the base name, which is why a metric with no
 *  Sm-/Lg- sibling still lands in medium rather than being dropped. */
const PREFIX: Record<SizeMode, string> = { medium: '', small: 'Sm-', large: 'Lg-' };

export interface ComponentSizePayload {
  medium: Record<string, number>;
  small: Record<string, number>;
  large: Record<string, number>;
}

/**
 * Regroup one flat group (e.g. the Button metrics) into the three modes.
 *
 * A metric present only at medium is repeated across all three, deliberately:
 * a mode with no value for a variable falls back to nothing in Figma, and a
 * variable that resolves to nothing in two of three modes is worse than one
 * that is simply the same at every size.
 */
export function componentSizeGroup(
  group: string,
  flat: Record<string, number | undefined>,
): ComponentSizePayload {
  const out: ComponentSizePayload = { medium: {}, small: {}, large: {} };

  /* Base names are everything without a size prefix. Derived from the keys
     rather than listed, so a metric added upstream appears here without this
     file being touched — the alternative is a hand-maintained list, and this
     codebase has already paid for several of those. */
  const bases = Object.keys(flat).filter((k) => !k.startsWith('Sm-') && !k.startsWith('Lg-'));

  for (const base of bases) {
    for (const mode of SIZE_MODES) {
      const key = PREFIX[mode] + base;
      const value = flat[key] !== undefined ? flat[key] : flat[base];
      if (typeof value === 'number') out[mode][GROUPED(group, base)] = value;
    }
  }
  return out;
}

/** Merge several groups into one payload keyed by mode. */
export function componentSizeFigma(
  groups: Record<string, Record<string, number | undefined>>,
): ComponentSizePayload {
  const out: ComponentSizePayload = { medium: {}, small: {}, large: {} };
  for (const [group, flat] of Object.entries(groups)) {
    const part = componentSizeGroup(group, flat);
    for (const mode of SIZE_MODES) Object.assign(out[mode], part[mode]);
  }
  return out;
}

/** Names a metric carries at every size, for checking against a real file.
 *  Every mode holds the same key set by construction — a name present in one
 *  mode and absent in another would resolve to nothing at that size. */
export function componentSizeNames(payload: ComponentSizePayload): string[] {
  return Object.keys(payload.medium).sort();
}

/* ── The groups the studio can fill ────────────────────────────────────────
 *
 * Component-Size in Figma holds more than the studio computes — Switch, FAB,
 * Slider, Rating and most of Other are authored by hand. This maps only what
 * the generator actually derives, and the writer leaves everything else alone.
 *
 * Names are the ones IN THE FILE, not the ones the old flat payload used.
 * Two differ and both would have bound nothing:
 *   Card-Focus-Border-Radius  →  Card-Focus-Radius
 *   Accordion-*               →  Accordian-*   (misspelt in the file; the
 *                                GROUP is spelt correctly, so it is only the
 *                                variable name that carries the typo)
 * Matching the file is the whole job — a "correct" name that matches nothing
 * silently leaves the value at whatever was last typed by hand.
 */
export interface RadiiForSize {
  buttonRadius: number; smButtonRadius: number; lgButtonRadius: number;
  buttonInnerRadius: number; smButtonInnerRadius: number; lgButtonInnerRadius: number;
  buttonFocusRadius: number; smButtonFocusRadius: number; lgButtonFocusRadius: number;
  iconButtonRadius: number; smIconButtonRadius: number; lgIconButtonRadius: number;
  iconButtonFocusRadius: number; smIconButtonFocusRadius: number; lgIconButtonFocusRadius: number;
  cardRadius: number; smCardRadius: number; lgCardRadius: number;
  cardInnerRadius: number; smCardInnerRadius: number; lgCardInnerRadius: number;
  cardFocusRadius: number; cardPadding: number;
  inputRadius: number; smInputRadius: number; lgInputRadius: number;
  inputFocusRadius: number; inputInnerRadius: number;
  accordionRadius: number; modalRadius: number; dropdownFrameRadius: number;
}

/* ── Nav chrome: three sizes, and not derived from anything ───────────────
 *
 * Every other metric in this file is computed from the user's own choices —
 * a radius follows their button radius, a padding follows their radius. These
 * do not: a rail is 80 wide in every brand, and the three sizes are a density
 * decision rather than a consequence of the type scale or the corner rounding.
 *
 * So they are CONSTANTS, and they are stated once. Three copies of 80 — the
 * CSS export, the preview and the Figma payload — is exactly the shape that
 * has drifted here before, and it drifts silently because each copy is
 * self-consistent (invariant 5).
 *
 * The names are the FILE's, which is why one of them carries a space:
 * Component-Size holds `App-Bar Height`, not `App-Bar-Height`. A tidier name
 * would match nothing and leave the variable at whatever was last typed by
 * hand, reporting success the whole time.
 */
export const NAV_METRICS = {
  'Rail-Width': { medium: 80, small: 72, large: 96 },
  'App-Bar Height': { medium: 64, small: 56, large: 72 },
} as const;

/** The flat Sm-/Lg- shape componentSizeGroup takes, from the table above. */
export function navMetricsFlat(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, byMode] of Object.entries(NAV_METRICS)) {
    out[name] = byMode.medium;
    out[`Sm-${name}`] = byMode.small;
    out[`Lg-${name}`] = byMode.large;
  }
  return out;
}

/** The same table as CSS custom properties.
 *
 *  CSS has no modes, so a mode becomes the Sm-/Lg- prefix — the idiom Button
 *  and Tabs already use, and what a component's SIZE_MAP picks between. The
 *  hyphenated form is the CSS name even where the Figma variable has a space:
 *  a custom property cannot contain one. */
export function navMetricsCSS(indent = '  '): string[] {
  const out: string[] = [];
  for (const [name, byMode] of Object.entries(NAV_METRICS)) {
    const css = name.replace(/ /g, '-');
    out.push(`${indent}--${css}: ${byMode.medium}px;`);
    out.push(`${indent}--Sm-${css}: ${byMode.small}px;`);
    out.push(`${indent}--Lg-${css}: ${byMode.large}px;`);
  }
  return out;
}

export function componentSizePayload(
  r: RadiiForSize,
  buttonMetrics: Record<string, number>,
): ComponentSizePayload {
  return componentSizeFigma({
    Button: {
      ...buttonMetrics,                       // Name / Sm-Name / Lg-Name triples
      'Button-Radius': r.buttonRadius,
      'Sm-Button-Radius': r.smButtonRadius,
      'Lg-Button-Radius': r.lgButtonRadius,
      'Button-Focus-Radius': r.buttonFocusRadius,
      'Sm-Button-Focus-Radius': r.smButtonFocusRadius,
      'Lg-Button-Focus-Radius': r.lgButtonFocusRadius,
      'Button-Inner-Focus-Radius': r.buttonInnerRadius,
      'Sm-Button-Inner-Focus-Radius': r.smButtonInnerRadius,
      'Lg-Button-Inner-Focus-Radius': r.lgButtonInnerRadius,
      'Button-Icon-Radius': r.iconButtonRadius,
      'Sm-Button-Icon-Radius': r.smIconButtonRadius,
      'Lg-Button-Icon-Radius': r.lgIconButtonRadius,
      'Button-Icon-Focus-Radius': r.iconButtonFocusRadius,
      'Sm-Button-Icon-Focus-Radius': r.smIconButtonFocusRadius,
      'Lg-Button-Icon-Focus-Radius': r.lgIconButtonFocusRadius,
    },
    Card: {
      'Card-Radius': r.cardRadius,
      'Sm-Card-Radius': r.smCardRadius,
      'Lg-Card-Radius': r.lgCardRadius,
      'Card-Inner-Border-Radius': r.cardInnerRadius,
      'Sm-Card-Inner-Border-Radius': r.smCardInnerRadius,
      'Lg-Card-Inner-Border-Radius': r.lgCardInnerRadius,
      // The file calls this Card-Focus-Radius; the flat payload called it
      // Card-Focus-Border-Radius and would have matched nothing.
      'Card-Focus-Radius': r.cardFocusRadius,
      'Card-Padding': r.cardPadding,
    },
    Input: {
      'Input-Radius': r.inputRadius,
      'Sm-Input-Radius': r.smInputRadius,
      'Lg-Input-Radius': r.lgInputRadius,
      'Input-Focus-Radius': r.inputFocusRadius,
      'Input-Inner-Focus-Radius': r.inputInnerRadius,
    },
    // Misspelt in the file. Matching the typo is deliberate: renaming a Figma
    // variable to fix it would unbind every layer using it (invariant 8), so
    // the rename has to be a decision made in Figma, not forced from here.
    Accordion: { 'Accordian-Radius': r.accordionRadius },
    Other: {
      'Modal-Radius': r.modalRadius,
      'Dropdown-Frame-Radius': r.dropdownFrameRadius,
      /* Written, not left hand-authored. populateComponentSize is
         update-only, so these land on the variables already in the file —
         which is the point: the number then has one home instead of living
         in Figma and being re-typed in CSS. */
      ...navMetricsFlat(),
    },
  });
}
