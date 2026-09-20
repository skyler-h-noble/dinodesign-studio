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

/* ── Radio and Checkbox ───────────────────────────────────────────────────
 *
 * Static like NAV_METRICS and LINE_METRICS: not derived from the brand's
 * radius or type scale. A checkbox is 20 square at medium in every brand.
 *
 * Three of these values are SHARED, and shared on purpose — a checkbox and a
 * radio sit beside each other in one form, so a ring that is not the same
 * size as the box next to it reads as a mistake. They are written as ONE
 * literal under two names rather than two literals that happen to match.
 *
 * That is not pedantry; it is the bug that already happened. Checkbox's gap
 * was 6 / 8 / 10 while Radio's was 4 / 8 / 12, so the two controls in the
 * same form sat at different distances from their labels at small and large —
 * and neither 6 nor 10 is even on the Sizing scale (the rungs are Quarter 2,
 * Half 4, 1 = 8, 1-and-Half 12). Two literals drifted because nothing held
 * them together. One literal cannot.
 *
 * Invariant 2 asks the right question of a duplicate: not "do the copies
 * match" but "does anything SELECT between them". Nothing selects between a
 * radio's ring and a checkbox's box — they are one decision — so collapsing
 * them is correct. The two NAMES stay because Figma organises by component
 * and the lib reads by component; the single source is here.
 *
 * Radio-Dot is Radio's alone and Checkbox-Icon is Checkbox's alone. Both are
 * carried at the lib's current values: this pass REGROUPS, it does not
 * recompute, for the reason in this file's header. Note the dot does not grow
 * from medium to large (9.5 both) while the ring goes 20 -> 24, and 9.5 is not
 * on the Sizing scale — a design question, not something to silently "fix"
 * here, because writing a different number would move every radio in every
 * brand on the way past.
 */
const SELECTION_BOX = { medium: 20, small: 16, large: 24 } as const;
const SELECTION_GAP = { medium: 8,  small: 4,  large: 12 } as const;

export const RADIO_METRICS = {
  'Radio-Size': SELECTION_BOX,
  'Radio-Dot':  { medium: 9.5, small: 8, large: 9.5 },
  'Radio-Gap':  SELECTION_GAP,
} as const;

export const CHECKBOX_METRICS = {
  'Checkbox-Size': SELECTION_BOX,
  'Checkbox-Icon': { medium: 14, small: 12, large: 18 },
  'Checkbox-Gap':  SELECTION_GAP,
} as const;

/** Both, for the CSS side — which has no groups and emits one flat list. */
export const SELECTION_METRICS = {
  ...RADIO_METRICS,
  ...CHECKBOX_METRICS,
} as const;

/**
 * The minimum hit area for a control, square, in px.
 *
 * ONE number for the same reason DISABLED_OPACITY is one number, and like it
 * this is a REQUIREMENT rather than a taste: WCAG 2.2 Target Size (Minimum),
 * 2.5.8, is 24 by 24 CSS pixels at AA.
 *
 * It does not vary by size mode, and that is the point — a small radio is the
 * one that needs the padding most. Radio and Checkbox both centre a 16 / 20 /
 * 24 box inside a constant 24 frame, so small pads by 4 a side, medium by 2,
 * large by 0.
 *
 * A brand may raise it (2.5.5 Target Size at AAA is 44) and nothing here
 * should stop them, which is what makes it a token rather than a constant in
 * the lib.
 */
export const TOUCH_TARGET = 24;

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

export function radioMetricsFlat(): Record<string, number> {
  return flattenByMode(RADIO_METRICS as never);
}

export function checkboxMetricsFlat(): Record<string, number> {
  return flattenByMode(CHECKBOX_METRICS as never);
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

/* Same job for the nav chrome. Two of the three carry spaces in Figma, so
 * they need the map for the same reason the line weights do. */
const NAV_METRIC_CSS: Record<string, string> = {
  'Rail-Width': 'Rail-Width',
  'App-Bar Height': 'App-Bar-Height',
  'Nav-Bar Height': 'Nav-Bar-Height',
};

/* Radio and Checkbox carry no spaces, so this map is the identity — and it is
 * written out anyway rather than skipped. metricsVars() takes a map because
 * the Figma name and the CSS name are allowed to differ; a group that opts
 * out of the map today is a group that has nowhere to put the difference on
 * the day one of these is renamed with a space in it, the way Step bar and
 * App-Bar Height already are. */
const SELECTION_METRIC_CSS: Record<string, string> = {
  'Radio-Size': 'Radio-Size',
  'Radio-Dot': 'Radio-Dot',
  'Radio-Gap': 'Radio-Gap',
  'Checkbox-Size': 'Checkbox-Size',
  'Checkbox-Icon': 'Checkbox-Icon',
  'Checkbox-Gap': 'Checkbox-Gap',
};

/**
 * A per-mode table as CSS custom properties, `--X` / `--Sm-X` / `--Lg-X`.
 *
 * ONE source for both emitters. The preview and the export are separate
 * implementations (invariant 5) and have diverged before while both looked
 * self-consistent, so the values come from here rather than being written
 * twice.
 */
function metricsVars(
  table: Record<string, { medium: number; small: number; large: number }>,
  cssNames: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [figmaName, byMode] of Object.entries(table)) {
    const css = cssNames[figmaName];
    out[`--${css}`] = `${byMode.medium}px`;
    out[`--Sm-${css}`] = `${byMode.small}px`;
    out[`--Lg-${css}`] = `${byMode.large}px`;
  }
  return out;
}

export function lineMetricsVars(): Record<string, string> {
  return metricsVars(LINE_METRICS as never, LINE_METRIC_CSS);
}

/** The nav chrome as a record — the form App.tsx spreads into inline style. */
export function navMetricsVars(): Record<string, string> {
  return metricsVars(NAV_METRICS as never, NAV_METRIC_CSS);
}

/** Radio and Checkbox, plus the one constant they share.
 *
 *  --Touch-Target is not a per-mode triple, so it is stated here rather than
 *  run through metricsVars — a Sm-/Lg- pair holding the same 24 would imply a
 *  choice that does not exist. */
export function selectionMetricsVars(): Record<string, string> {
  return {
    ...metricsVars(SELECTION_METRICS as never, SELECTION_METRIC_CSS),
    '--Touch-Target': `${TOUCH_TARGET}px`,
  };
}

/** The same values as stylesheet lines, plus --Disabled.
 *
 *  CSS has no modes, so a mode becomes the Sm-/Lg- prefix — the idiom Button
 *  and Tabs already use, and what a component's SIZE_MAP picks between. The
 *  hyphenated form is the CSS name even where the Figma variable has a space:
 *  a custom property cannot contain one.
 *
 *  This builds on navMetricsVars() rather than walking NAV_METRICS again.
 *  It used to do its own walk, and the two coexisted long enough for a second
 *  emitter to be added to exportToCSS against the record form — base.css got
 *  all nine nav values TWICE, and the end-to-end check that was supposed to
 *  prove the new emitter worked was reading the old one's output. Identical
 *  values, so nothing looked wrong. One walk, two shapes. */
export function navMetricsCSS(indent = '  '): string[] {
  const out: string[] = [`${indent}--Disabled: ${DISABLED_OPACITY};`];
  for (const [name, value] of Object.entries(navMetricsVars())) {
    out.push(`${indent}${name}: ${value};`);
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
    /* Radio and Checkbox get a group each, matching how Figma organises its
       components and how the lib reads them — but the shared values come from
       ONE literal (see SELECTION_BOX / SELECTION_GAP), so the two groups
       cannot disagree about a box size or a label gap the way the hand-typed
       versions did. */
    Radio: radioMetricsFlat(),
    Checkbox: checkboxMetricsFlat(),
    Other: {
      'Modal-Radius': r.modalRadius,
      /* WCAG 2.2 2.5.8. One value, no size modes — a small radio is the one
         that needs the padding most. */
      'Touch-Target': TOUCH_TARGET,
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
