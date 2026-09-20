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
 * Component-Size in Figma holds more than the studio computes. Authored by
 * hand, and NOT written by this payload: Switch, FAB, Slider, Rating, most of
 * Other — and Divider, Step bar and No Count Step.
 *
 * Those last three matter more than the rest, because the LIB now carries the
 * same numbers as literals:
 *
 *   Divider        0.5 / 1 / 2   Divider.js SIZE_MAP
 *   Step bar       1 / 2 / 4     Stepper.js connectorThickness
 *   No Count Step  8 / 12 / 16   Stepper.js dot (variant="noCount")
 *
 * They were caught disagreeing: the lib's Divider was wearing the STEP BAR's
 * 1/2/4 while the connector sat pinned at 2 for every size — the two ramps
 * had been swapped between the components, and nothing could detect it
 * because nothing wrote them. They ARE written now (LINE_METRICS, into the
 * Other group), so the Figma side has one source; the lib still holds the
 * same numbers as literals until it consumes the generated tokens.
 *
 * Names are the ones IN THE FILE, not the ones the old flat payload used.
 *   Card-Focus-Border-Radius  →  Card-Focus-Radius
 * Matching the file is the whole job — a "correct" name that matches nothing
 * silently leaves the value at whatever was last typed by hand.
 *
 * The Accordion entry used to be listed here as a second such case: the file
 * spelt it `Accordian-*` and this payload matched the typo deliberately. It
 * was renamed in Figma on 2026-09-19 and the payload moved with it, so that
 * exception is gone — see the note on the Accordion group below.
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
  accordionRadius: number; accordionFocusRadius: number; accordionInnerFocusRadius: number;
  modalRadius: number; dropdownFrameRadius: number;
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
/**
 * How faded an unavailable control is.
 *
 * ONE number, and stating it is the whole point: the library decided this ten
 * separate times — 0.6 twenty-six times, 0.5 twenty-four, and 0.85, 0.7, 0.45,
 * 0.4, 0.38, 0.3, 0.25 between them — with Autocomplete and NumberField each
 * using two different values in the same file. Nothing chose between them
 * because nothing was asked to.
 *
 * 0.38 is the value Figma already binds (the Rail's Disabled variant), and it
 * is a LEGIBILITY figure rather than a taste one: far enough down to read as
 * unavailable, not so far that the label stops being readable. 0.25 on a dim
 * surface is not.
 *
 * ── Why a token and not a constant in the lib ─────────────────────────────
 * It needs no per-theme or per-surface derivation the way --Hover does, which
 * makes it a thinner token than the rest — but Figma binds to it, and a value
 * that exists there and not in CSS is the divergence this codebase keeps
 * paying for. A brand with a high-contrast requirement also has a real reason
 * to raise it, which is what a token is for.
 *
 * ── Scale ─────────────────────────────────────────────────────────────────
 * Figma stores 38 because its UI expresses opacity in percent; CSS opacity is
 * 0–1. The two are the same decision at different scales, so the CSS side
 * emits the ratio and nothing has to remember to divide.
 */
export const DISABLED_OPACITY = 0.38;

export const NAV_METRICS = {
  'Rail-Width': { medium: 80, small: 72, large: 96 },
  'App-Bar Height': { medium: 64, small: 56, large: 72 },
  /* The bottom bar. 83 at medium is the design's own figure (Nav-Bar
     7442:31305, 398x83); the other two follow App-Bar Height's proportions
     rather than being measured, because the design has no small or large
     Nav-Bar to read.
     
     Stated here rather than left implicit because a PAGE needs it: a pinned
     bottom bar covers the last 83px of content, and the inset that clears it
     has to track the size mode or it is right at exactly one of the three. */
  'Nav-Bar Height': { medium: 83, small: 73, large: 93 },
} as const;

/* Line and dot weights. Static, like NAV_METRICS above: not derived from the
 * user's radius or heights — these are the design's own weights, read off
 * Component-Size / Other.
 *
 * They are here because the LIB carries the same three numbers as literals:
 *
 *   Divider        Divider.js      SIZE_MAP
 *   Step bar       Stepper.js      connectorThickness
 *   No Count Step  Stepper.js      dot (variant="noCount")
 *
 * One value in two places, three times over — and they were caught
 * disagreeing: the lib's Divider was wearing the STEP BAR's 1/2/4 while the
 * connector sat pinned at 2 for every size. The two ramps had been swapped
 * between the components and nothing could detect it, because nothing wrote
 * them. Writing them gives the number one home.
 *
 * 0.5 at small is a deliberate hairline — a true half-pixel on 2x, rounded by
 * the browser on 1x, which is the usual hairline trade. */
export const LINE_METRICS = {
  'Divider':       { medium: 1,  small: 0.5, large: 2 },
  'Step bar':      { medium: 2,  small: 1,   large: 4 },
  'No Count Step': { medium: 12, small: 8,   large: 16 },
} as const;

/** The flat Sm-/Lg- shape componentSizeGroup takes, from a per-mode table.
 *  The prefixes are INPUT only — componentSizeGroup regroups them into the
 *  three modes under one variable name, which is how Figma stores them. */
function flattenByMode(
  table: Record<string, { medium: number; small: number; large: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, byMode] of Object.entries(table)) {
    out[name] = byMode.medium;
    out[`Sm-${name}`] = byMode.small;
    out[`Lg-${name}`] = byMode.large;
  }
  return out;
}

export function navMetricsFlat(): Record<string, number> {
  return flattenByMode(NAV_METRICS as never);
}

export function lineMetricsFlat(): Record<string, number> {
  return flattenByMode(LINE_METRICS as never);
}

/* Figma name -> CSS custom-property base.
 *
 * The two differ HERE and only here. A Figma variable may carry spaces
 * ("Step bar", "No Count Step"); a CSS custom property cannot, so one of the
 * two names has to bend and it is this one. Stated as a MAP rather than
 * derived by replacing spaces, because a derivation would silently invent a
 * name the moment a Figma variable is renamed — and the lib reads these by
 * name, so an invented one resolves to nothing and the fallback paints
 * forever with no error.
 *
 * If the Figma variables are ever renamed to Step-Bar / No-Count-Step, this
 * map collapses to identity and LINE_METRICS' keys move with them. */
const LINE_METRIC_CSS: Record<string, string> = {
  'Divider': 'Divider',
  'Step bar': 'Step-Bar',
  'No Count Step': 'No-Count-Step',
};

/**
 * The line weights as CSS custom properties, `--X` / `--Sm-X` / `--Lg-X`.
 *
 * ONE source for both emitters. The preview and the export are separate
 * implementations (invariant 5) and have diverged before while both looked
 * self-consistent, so the values come from here rather than being written
 * twice.
 */
export function lineMetricsVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [figmaName, byMode] of Object.entries(LINE_METRICS)) {
    const css = LINE_METRIC_CSS[figmaName];
    out[`--${css}`] = `${byMode.medium}px`;
    out[`--Sm-${css}`] = `${byMode.small}px`;
    out[`--Lg-${css}`] = `${byMode.large}px`;
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
  const out: string[] = [`${indent}--Disabled: ${DISABLED_OPACITY};`];
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
      /* Renamed in Figma on 2026-09-20, from Card-Inner-Border-Radius. The
         CSS already spelled it --Card-Inner-Radius, so the two sides now
         agree; before this they described one value under two names, which
         is worse than a gap because both sides looked complete. */
      'Card-Inner-Radius': r.cardInnerRadius,
      'Sm-Card-Inner-Radius': r.smCardInnerRadius,
      'Lg-Card-Inner-Radius': r.lgCardInnerRadius,
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
    /* Was 'Accordian-Radius' (sic), deliberately matching a misspelling in the
       file — populateComponentSize is UPDATE-ONLY, so it writes by name and a
       name that does not exist is skipped silently. The rename happened in
       Figma on 2026-09-18, so this had to move in the same pass or the writer
       would have gone quietly dead against the old name.

       The two focus radii are new here. They are not needed by the CSS — an
       `outline` is drawn concentric with the border-radius, so the browser
       derives them — but Figma cannot do arithmetic on a variable, so they had
       been hand-typed at 11 and 5 and would have stopped matching the moment
       the brand's radius moved. */
    Accordion: {
      'Accordion-Radius': r.accordionRadius,
      'Accordion-Focus-Radius': r.accordionFocusRadius,
      'Accordion-Inner-Focus-Radius': r.accordionInnerFocusRadius,
    },
    Other: {
      'Modal-Radius': r.modalRadius,
      'Dropdown-Frame-Radius': r.dropdownFrameRadius,
      /* Written, not left hand-authored. populateComponentSize is
         update-only, so these land on the variables already in the file —
         which is the point: the number then has one home instead of living
         in Figma and being re-typed in CSS. */
      ...navMetricsFlat(),
      /* Divider / Step bar / No Count Step — see LINE_METRICS. Same reason as
         the nav metrics: the lib holds these as literals too, so writing them
         keeps one number in one place. */
      ...lineMetricsFlat(),
    },
  });
}
