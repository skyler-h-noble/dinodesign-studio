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

/**
 * The FAB, all three sizes.
 *
 * FIXED, not a brand choice. A floating action button is 32 / 48 / 56 in every
 * system the studio produces — the user's button-height sliders do not reach
 * it — which is exactly why it belongs here as a literal rather than being
 * derived from anything.
 *
 * It was hand-authored in Figma and mirrored here so the FAB's bevel could be
 * computed (a bevel is a fraction of a height). A mirror of a fixed number is
 * still two copies, and the way that ends is the copy nobody updates. Since
 * nothing about it varies, the studio may as well own it and write it.
 *
 * The ICON is stated, not derived, and the large size is why: width / 2 gives
 * 16 / 24 / 28, and the file holds 16 / 24 / **32**. The three are rungs of the
 * icon ramp, which is a table Material and Apple publish rather than a curve —
 * the same reason platformMetrics states its glyph sizes instead of running a
 * ratio. Deriving these would silently shrink the large FAB's icon by 4px.
 *
 * The FOCUS RADIUS does derive: width + 6, exact at all three sizes. The ring
 * sits 3px outside the button, so its box is 6px wider, and a radius of the
 * full box width keeps it circular at any size.
 *
 * NOT per platform. Devices-Type carries no FAB width or height — only the
 * bevels, which every device column therefore holds identically. If Apple and
 * Google ever publish FAB sizes the way they do button heights, this becomes a
 * per-platform table like PLATFORM_BUTTON and the columns are already there.
 */
export const FAB_SIZE = { small: 32, medium: 48, large: 56 } as const;
export const FAB_ICON = { small: 16, medium: 24, large: 32 } as const;

/** The focus ring's corner, one per size. Derived — see above. */
export const FAB_FOCUS_RADIUS = {
  small: FAB_SIZE.small + 6,
  medium: FAB_SIZE.medium + 6,
  large: FAB_SIZE.large + 6,
} as const;

/** The FAB group of Component-Size, in the Name / Sm- / Lg- shape. */
export function fabMetricsFlat(): Record<string, number> {
  return {
    'FAB-Width': FAB_SIZE.medium,
    'Sm-FAB-Width': FAB_SIZE.small,
    'Lg-FAB-Width': FAB_SIZE.large,
    'FAB-Icon': FAB_ICON.medium,
    'Sm-FAB-Icon': FAB_ICON.small,
    'Lg-FAB-Icon': FAB_ICON.large,
    'FAB-Focus-Radius': FAB_FOCUS_RADIUS.medium,
    'Sm-FAB-Focus-Radius': FAB_FOCUS_RADIUS.small,
    'Lg-FAB-Focus-Radius': FAB_FOCUS_RADIUS.large,
  };
}

/* ── The groups the studio can fill ────────────────────────────────────────
 *
 * Component-Size in Figma holds more than the studio computes. Authored by
 * hand, and NOT written by this payload: Switch, Slider, Rating, most of
 * Other — and Divider, Step bar and No Count Step.
 *
 * FAB used to be on that list and no longer is. Its three sizes are FIXED,
 * so there was never a reason for them to be typed rather than stated; they
 * were only mirrored here to compute the bevel, which made two copies of a
 * number that cannot vary.
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
  iconButtonInnerRadius: number; smIconButtonInnerRadius: number; lgIconButtonInnerRadius: number;
  cardRadius: number; smCardRadius: number; lgCardRadius: number;
  cardInnerRadius: number; smCardInnerRadius: number; lgCardInnerRadius: number;
  cardFocusRadius: number; smCardFocusRadius: number; lgCardFocusRadius: number;
  listItemRadius: number; smListItemRadius: number; lgListItemRadius: number;
  listItemFocusRadius: number; smListItemFocusRadius: number; lgListItemFocusRadius: number;
  listItemPadding: number; smListItemPadding: number; lgListItemPadding: number;
  listItemGap: number; smListItemGap: number; lgListItemGap: number;
  listItemImageRadius: number;
  listItemImageWidth: number; smListItemImageWidth: number; lgListItemImageWidth: number;
  cardPadding: number;
  smCardPadding: number; lgCardPadding: number;
  inputRadius: number; smInputRadius: number; lgInputRadius: number;
  inputFocusRadius: number; inputInnerRadius: number;
  inputSwatchRadius: number; smInputSwatchRadius: number; lgInputSwatchRadius: number;
  accordionRadius: number; accordionFocusRadius: number; accordionInnerFocusRadius: number;
  modalRadius: number; modalPadding: number;
  smModalPadding: number; lgModalPadding: number;
  modalInnerRadius: number; modalFocusRadius: number;
  dropdownFrameRadius: number;
  menuItemRadius: number; menuFocusRadius: number;
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
 * The names are the FILE's. `Nav-Bar Height` still carries a space because the
 * file spells it that way; `App-Bar Height` did too until it was renamed to
 * `App-Bar-Height` on 2026-09-30, and this table followed in the same pass.
 *
 * That is the whole hazard: a tidier name matches nothing, leaves the variable
 * at whatever was last typed by hand, and reports success the whole time. Renaming
 * in Figma is safe for the BINDINGS — the id is preserved, so layers stay wired —
 * but it silently detaches this writer until the string here changes too.
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
  'App-Bar-Height': { medium: 64, small: 56, large: 72 },
  /* The bottom bar. 83 at medium is the design's own figure (Nav-Bar
     7442:31305, 398x83); the other two follow App-Bar-Height's proportions
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
 * Static, like NAV_METRICS and LINE_METRICS: not derived from the brand's
 * radius, heights or type scale. A checkbox is 20 square at medium in every
 * brand.
 *
 * That word STATIC is the whole reason Checkbox-Icon is its own variable
 * rather than the existing `in-button` icon size. Button-Icon is
 * snap(0.625 x button height), and the button height is one of the values the
 * USER sets. Binding the checkmark to it would mean a brand raising its button
 * height to 56 gets a larger checkmark inside a box that did not move — the
 * inset breaks, from a change that had nothing to do with checkboxes. Two
 * unrelated things coupled through one token.
 *
 * It could not express the values anyway: Button-Icon snaps to ICON_RAMP,
 * which starts at 16, and the small checkbox box IS 16. The smallest icon that
 * ramp can produce fills the small box edge to edge.
 *
 * ── Names are the FILE's ──────────────────────────────────────────────────
 * populateComponentSize is UPDATE-ONLY and matches by name, so a name the file
 * does not have is not an error — it is a silent no-op that reports success.
 * Checked against Omni Designs-Aug12 on 2026-09-20:
 *
 *   Radio/Radio              Radio/Dot            Radio/Radio-Gap
 *   Checkbox/Checkbox-Width  Checkbox/Checkbox-Radius  Checkbox/Checkbox-Gap
 *
 * An earlier pass here invented Radio-Size, Radio-Dot and Checkbox-Size. All
 * three would have written nothing, and the run would have looked clean.
 *
 * Checkbox-Icon is the one NEW name, added deliberately — see above.
 *
 * ── The shared values ─────────────────────────────────────────────────────
 * The box and the gap are ONE literal under two names. A checkbox and a radio
 * sit beside each other in one form, so a ring that is not the size of the box
 * next to it reads as a mistake, and a label that sits closer to one than the
 * other reads as a misalignment.
 *
 * This is not hypothetical tidiness — the file had drifted both ways when it
 * was read on 2026-09-20. Checkbox-Gap was 4/4/12 against Radio-Gap's 4/8/12,
 * so the two controls sat at different distances from their labels at MEDIUM,
 * the default size. Checkbox-Width was 16/20/24 while Radio was 16/20/20, so
 * at large the ring was 4px smaller than the box beside it. The lib had a
 * third set again. Nothing selects between a radio's ring and a checkbox's box
 * — they are one decision — so invariant 2 says collapse them. The two NAMES
 * stay because Figma organises by component and CSS is flat.
 *
 * ── Where the ramps came from ─────────────────────────────────────────────
 * Ring and dot were the interesting disagreement. Figma grew the DOT
 * (8/9.5/12) and held the ring flat at large (16/20/20); the lib grew the RING
 * (16/20/24) and held the dot flat (8/9.5/9.5). Each was half right, and
 * neither held a ratio: small was 50%, Figma's large 60%, the lib's large 40%.
 *
 * 16/20/24 with 8/10/12 is a flat 50% at every size, and 9.5 — which is not on
 * the Sizing scale (Quarter 2, Half 4, 1 = 8, 1-and-Half 12) and never was —
 * disappears. Decided 2026-09-20.
 */
const SELECTION_BOX = { medium: 20, small: 16, large: 24 } as const;
const SELECTION_GAP = { medium: 8,  small: 4,  large: 12 } as const;

export const RADIO_METRICS = {
  'Radio':     SELECTION_BOX,
  'Dot':       { medium: 10, small: 8, large: 12 },
  'Radio-Gap': SELECTION_GAP,
} as const;

export const CHECKBOX_METRICS = {
  'Checkbox-Width': SELECTION_BOX,
  /* 20% of the box, and the one metric here the lib ALREADY reads by name:
     Checkbox.js has var(--Checkbox-Radius, 4px) and its Sm-/Lg- siblings.
     Figma has had the variable all along and the studio never emitted it, so
     the fallback has painted in every brand ever generated — the same shape as
     --Rail-Width, and invisible for the same reason: the fallback is correct. */
  'Checkbox-Radius': { medium: 4, small: 3.2, large: 4.8 },
  /* The checkmark glyph. Inset 2 / 3 / 3 a side inside the box.
     
     It lives HERE, in Component-Size, and not in the icon collection — which
     matters because the icon collection is where you would expect it.
     
     Icons & Avatars has `in-check` and `in-button` as its two MODES, and one
     variable `Icon-Size` that ALIASES per mode:
     
         Icon-Size   in-check  -> Checkbox/Checkbox-Icon
                     in-button -> Button/Button-Icon
     
     That is what makes the arrangement work. Icons & Avatars cannot take a
     third mode, so a size ramp cannot live there — but it does not have to.
     The alias lands in Component-Size, which HAS small/medium/large, so the
     ramp is inherited through the pointer. Reading a checkbox node resolves
     Icon-Size to 14 at medium with nothing in the icon collection knowing
     anything about sizes.
     
     So this variable is the one the alias points AT, and renaming it breaks
     the alias rather than just a lookup.
     
     Not bound to Button-Icon for the same reason it is not a constant: that
     is snap(0.625 x button height) and the button height is USER input, so
     the checkmark would resize whenever someone changed their buttons, inside
     a box that did not move. ICON_RAMP starts at 16 besides, and the small
     box IS 16.
     
     Values are the lib's, unchanged: medium sits at 70% of the box where small
     and large are 75%. Left as it ships rather than rounded to a flat
     12/15/18 — this pass regroups and does not recompute, and 15 was not what
     anyone chose. */
  'Checkbox-Icon': { medium: 14, small: 12, large: 18 },
  'Checkbox-Gap':  SELECTION_GAP,
} as const;

/** Both, for the CSS side — which has no groups and emits one flat list. */
/** The arrow's HEIGHT — how far it points away from the bubble. The design's
 *  own table; everything else about the arrow derives from it.
 *  Named `Tooltip-Arrow-Height` in Figma. It was `Tooltip-Arrow` until the width
 *  got its own token, at which point a bare `Arrow` no longer said which
 *  dimension it meant. The payload has to use the new spelling: the import is
 *  update-only and matches by name, so the old one would be skipped in silence
 *  and the variable would keep whatever was last typed. */
const TOOLTIP_ARROW_HEIGHT = { medium: 8, small: 6, large: 10 } as const;

/** 2 x the height, because medium is drawn 16x8 and that 2:1 is the ratio the
 *  design states. It used to be bound to `Sizing-2` — a single generic 16 — so
 *  the height scaled and the width did not, and the arrow's proportion drifted
 *  with size: 2.67:1 small, 2.00:1 medium, 1.60:1 large. A generic cannot carry
 *  three numbers, which is why this is its own token. */
const arrowWidth = (h: number) => h * 2;

/** How much of the arrow shows. The rest tucks behind the bubble.
 *
 *  70% of the height, rounded — which reproduces the design's 4 / 6 / 7 exactly
 *  (4.2, 5.6, 7.0). `height - 2` also gives 4 and 6 and was the tempting read,
 *  but it puts large at 8 and the design says 7, so the subtraction matched two
 *  of three by coincidence. */
const visibleArrowHeight = (h: number) => Math.round(h * 0.7);

const byHeight = (f: (h: number) => number) => ({
  medium: f(TOOLTIP_ARROW_HEIGHT.medium),
  small: f(TOOLTIP_ARROW_HEIGHT.small),
  large: f(TOOLTIP_ARROW_HEIGHT.large),
});

/** Tooltip, per size mode.
 *
 *  Every one of these existed in Figma with NO producer here — bound to layers,
 *  holding typed values, and skipped by every regenerate. That is the mirror of
 *  the update-only writer problem: a name the file has and the generator does
 *  not, so nothing ever reports it stale.
 *
 *  Tooltip-Radius is deliberately absent — it is flat across sizes and the lib
 *  derives it from the brand (`--Style-Border-Radius`), so pinning a number
 *  here would make Tooltip the one radius in the system that ignores the brand. */
const TOOLTIP_PADDING = { medium: 8, small: 4, large: 12 } as const;

/* Half the padding, at every size — 2/4, 4/8, 6/12.
 *
 * Not the rule List-Item uses. There the comment is explicit that "the gap
 * BETWEEN rows equals the padding INSIDE one", which is about separating
 * repeated rows. This gap sits between an icon, a label and an optional button
 * INSIDE one bubble, so it wants to be tighter than the padding around them or
 * the content reads as further from itself than from its own edge.
 *
 * Large held 8 for a while, where half of 12 is 6 — small and medium were
 * already half. Deriving it means the three cannot disagree again. */
const tooltipGap = (padding: number) => padding / 2;

export const TOOLTIP_METRICS = {
  /* Flat — 8 at every size AND every brand. A deliberate choice, not an
     oversight, so it is worth saying what it costs: every other radius in the
     system is brand-derived (Button-Radius is a percentage of height,
     Card-Radius is a corner plus padding, Dropdown-Frame-Radius is
     min(Input-Radius, Card-Radius, 16)). This one is not, so a brand with square
     buttons still gets an 8px tooltip.
     The alternative considered was min(buttonRadius, 12) — 0/4/10/12/12 across
     sharp to pill — which would have tracked the brand. Flat was chosen.
     The lib has to read THIS token rather than --Style-Border-Radius, or the
     two disagree for every brand whose radius is not 8. */
  'Tooltip-Radius': { medium: 8, small: 8, large: 8 },
  'Tooltip-Arrow-Height': TOOLTIP_ARROW_HEIGHT,
  'Tooltip-Arrow-Width': byHeight(arrowWidth),
  'Tooltip-Visible-Arrow-Height': byHeight(visibleArrowHeight),
  'Tooltip-Padding': TOOLTIP_PADDING,
  'Tooltip-Gap': {
    medium: tooltipGap(TOOLTIP_PADDING.medium),
    small: tooltipGap(TOOLTIP_PADDING.small),
    large: tooltipGap(TOOLTIP_PADDING.large),
  },
} as const;

export const SELECTION_METRICS = {
  ...RADIO_METRICS,
  ...CHECKBOX_METRICS,
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

export function radioMetricsFlat(): Record<string, number> {
  return flattenByMode(RADIO_METRICS as never);
}

export function checkboxMetricsFlat(): Record<string, number> {
  return flattenByMode(CHECKBOX_METRICS as never);
}

export function tooltipMetricsFlat(): Record<string, number> {
  return flattenByMode(TOOLTIP_METRICS as never);
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
  'App-Bar-Height': 'App-Bar-Height',
  'Nav-Bar Height': 'Nav-Bar-Height',
};

/* Radio and Checkbox carry no spaces, so this map is the identity — and it is
 * written out anyway rather than skipped. metricsVars() takes a map because
 * the Figma name and the CSS name are allowed to differ; a group that opts
 * out of the map today is a group that has nowhere to put the difference on
 * the day one of these is renamed with a space in it, the way Step bar and
 * App-Bar-Height already are. */
const SELECTION_METRIC_CSS: Record<string, string> = {
  /* The two Radio names are where this map earns its keep. Figma's group
     supplies the scope, so `Radio/Radio` and `Radio/Dot` read fine there. CSS
     custom properties are FLAT — `--Dot` says nothing about what it belongs
     to, and `--Radio` alone is no better. So the CSS side carries the scope in
     the name, which is what the map is for. */
  'Radio': 'Radio-Size',
  'Dot': 'Radio-Dot',
  'Radio-Gap': 'Radio-Gap',
  'Checkbox-Width': 'Checkbox-Width',
  /* Must stay spelled exactly this way: Checkbox.js already reads
     var(--Checkbox-Radius, 4px), --Sm-Checkbox-Radius and --Lg-Checkbox-Radius.
     A "tidier" name here resolves to nothing and the fallback keeps painting,
     silently, which is the state this has been in all along. */
  'Checkbox-Radius': 'Checkbox-Radius',
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

/** Radio and Checkbox as CSS custom properties.
 *
 *  The 24px minimum hit area is deliberately NOT here. Both controls centre
 *  their box inside a constant 24 frame (WCAG 2.2 2.5.8), and it was tempting
 *  to give that its own Touch-Target variable — but the file already expresses
 *  it as `Sizing-3`, the 24 rung of the Sizing scale, and the CSS side already
 *  emits --Sizing-3: 24px (generateDesignSystem.ts). Both sides have a home
 *  for it, so a new name would be a third spelling of a number that has two. */
export function selectionMetricsVars(): Record<string, string> {
  return metricsVars(SELECTION_METRICS as never, SELECTION_METRIC_CSS);
}

/* Figma name -> CSS name. Identical here, unlike Radio's, because the Figma
   group already spells "Tooltip" into every variable. The map still exists so
   metricsVars has one shape for every table. */
const TOOLTIP_METRIC_CSS: Record<string, string> = {
  'Tooltip-Radius': 'Tooltip-Radius',
  'Tooltip-Arrow-Height': 'Tooltip-Arrow-Height',
  'Tooltip-Arrow-Width': 'Tooltip-Arrow-Width',
  'Tooltip-Visible-Arrow-Height': 'Tooltip-Visible-Arrow-Height',
  'Tooltip-Padding': 'Tooltip-Padding',
  'Tooltip-Gap': 'Tooltip-Gap',
};

/** Tooltip metrics as CSS custom properties.
 *
 *  The arrow needs TWO dimensions in code, not one. The lib drove MUI's arrow
 *  through `fontSize`, and MUI computes `width: 1em; height: 0.71em` from it —
 *  a rotated square — so it could express neither the 2:1 the design draws nor
 *  a width and height that move independently. */
export function tooltipMetricsVars(): Record<string, string> {
  return metricsVars(TOOLTIP_METRICS as never, TOOLTIP_METRIC_CSS);
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

/**
 * Metrics Component-Size no longer owns, because Devices-Type does.
 *
 * Button-Height and Button-Icon are ALIASES in the file now:
 *
 *   Component-Size/Button/Button-Height  ->  Devices-Type/{Small,Medium,Large} Button
 *   Component-Size/Button/Button-Icon    ->  Devices-Type/{...} Button Icon
 *
 * which is what makes a button size resolve through the DEVICE as well as the
 * size mode — the same composition Icon-Size uses. A button is then 32 tall on
 * Desktop, 44 on iOS and 48 on Android from one variable.
 *
 * populateComponentSize writes by name and cannot tell an alias from a number.
 * Left in the payload, it overwrites both with literals on the next import and
 * the links are simply gone — no error, no warning, and the platform heights
 * silently collapse back to the Desktop ones. That is why this list exists
 * rather than the entries just being deleted: the names have to be stated
 * somewhere so a future metric added upstream cannot quietly rejoin the
 * payload and clobber an alias.
 *
 * The user's Desktop values still reach Figma — they are written to the
 * Desktop MODE of the Devices-Type variables these point at, which is the one
 * column the studio owns. The platform columns are hand-authored constants.
 */
export const DEVICE_OWNED_METRICS = ['Button-Height', 'Button-Icon'] as const;

/**
 * Button metrics the payload computes but does NOT write to Figma.
 *
 * Different reason from DEVICE_OWNED_METRICS above: those go to Devices-Type
 * instead, so writing them here would put one name in two collections. These
 * go nowhere, because the file has no variable for them and does not want one —
 * the button's label size is covered by Dynamic-Typography/Dynamic-Button-
 * Font-Size, and Component-Size holds Button-Text-Padding without a
 * Button-Text beside it.
 *
 * Kept out rather than left to be skipped. The writer is update-only, so an
 * unmatched name is dropped in silence either way; the difference is that a
 * deliberate absence stated here cannot be mistaken later for an oversight.
 */
export const NOT_IN_FIGMA = ['Button-Text'] as const;

function withoutDeviceOwned(flat: Record<string, number>): Record<string, number> {
  const out = { ...flat };
  for (const base of [...DEVICE_OWNED_METRICS, ...NOT_IN_FIGMA]) {
    delete out[base];
    delete out[`Sm-${base}`];
    delete out[`Lg-${base}`];
  }
  return out;
}

/**
 * The Devices-Type variables the aliases above point AT, keyed by size mode.
 *
 * Names as the file spells them — spaces included, at the root of the
 * collection rather than in a group. Same rule as `Nav-Bar Height`: a tidier
 * name matches nothing and the write is a silent no-op.
 */
export const DEVICE_BUTTON_NAMES: Record<string, Record<SizeMode, string>> = {
  'Button-Height': {
    medium: 'Medium Button', small: 'Small Button', large: 'Large Button',
  },
  'Button-Icon': {
    medium: 'Medium Button Icon', small: 'Small Button Icon', large: 'Large Button Icon',
  },
};

/**
 * The DESKTOP column of those variables, from the user's chosen heights.
 *
 * Desktop is the one column the studio owns. The platform columns are
 * hand-authored constants — iOS 44/32/50, Android 48/32/56 — because they come
 * from Apple's and Google's specs rather than from anything the user picks,
 * and writing all seven modes would overwrite them with the brand's numbers on
 * every import.
 *
 * So this returns ONE mode's worth. The caller merges it into the Desktop mode
 * and leaves the other six alone, which is the whole point of the split: the
 * brand decides how tall its own buttons are, the platforms decide how tall
 * theirs are, and Component-Size aliases into whichever device is in play.
 */
export function desktopButtonMetrics(
  buttonMetrics: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [base, names] of Object.entries(DEVICE_BUTTON_NAMES)) {
    const byMode: Record<SizeMode, number | undefined> = {
      medium: buttonMetrics[base],
      small: buttonMetrics[`Sm-${base}`],
      large: buttonMetrics[`Lg-${base}`],
    };
    for (const mode of SIZE_MODES) {
      const v = byMode[mode];
      if (typeof v === 'number') out[names[mode]] = v;
    }
  }
  return out;
}

export function componentSizePayload(
  r: RadiiForSize,
  buttonMetrics: Record<string, number>,
  /**
   * Input values the caller computes rather than deriving from radii.
   *
   * `Input-Padding` reads the user's own `inputPadding` with a radius-based
   * fallback, so it cannot come from RadiiForSize. Its Button counterparts —
   * swatch, min-width, border-width, padding and the bevel geometry — ride in
   * through `buttonMetrics`, which is already a free-form Name / Sm-Name /
   * Lg-Name bag; Input has no such bag, hence this parameter.
   */
  inputExtras: Record<string, number> = {},
): ComponentSizePayload {
  return componentSizeFigma({
    Button: {
      ...withoutDeviceOwned(buttonMetrics),   // Name / Sm-Name / Lg-Name triples
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
      /* No Button-Icon-Inner-Radius. It came across with the deleted
         `Components` payload and was dropped on request: the file has
         Button-Icon-Radius and Button-Icon-Focus-Radius, and an inner radius
         for the icon button is not wanted. computeRadii still derives it for
         the CSS. */
    },
    /* The bordered list row.
       The group is `List-item` — lowercase i — because that is what the FILE
       calls it. The writer is update-only and matches by name, so `List` would
       have matched nothing and been skipped in silence, leaving all five
       variables holding whatever was last typed by hand.
       Radius, focus radius, padding and image radius have no Sm-/Lg- siblings,
       so componentSizeGroup repeats each into all three size modes. The image
       WIDTH does have them, and they become the modes. */
    'List-item': {
      'List-Item-Radius': r.listItemRadius,
      'Sm-List-Item-Radius': r.smListItemRadius,
      'Lg-List-Item-Radius': r.lgListItemRadius,
      'List-Item-Focus-Radius': r.listItemFocusRadius,
      'Sm-List-Item-Focus-Radius': r.smListItemFocusRadius,
      'Lg-List-Item-Focus-Radius': r.lgListItemFocusRadius,
      'List-Item-Padding': r.listItemPadding,
      'Sm-List-Item-Padding': r.smListItemPadding,
      'Lg-List-Item-Padding': r.lgListItemPadding,
      'List-Item-Gap': r.listItemGap,
      'Sm-List-Item-Gap': r.smListItemGap,
      'Lg-List-Item-Gap': r.lgListItemGap,
      'List-Item-Image-Radius': r.listItemImageRadius,
      'List-Item-Default-Image-Width': r.listItemImageWidth,
      'Sm-List-Item-Default-Image-Width': r.smListItemImageWidth,
      'Lg-List-Item-Default-Image-Width': r.lgListItemImageWidth,
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
      /* The file calls this Card-Focus-Radius; the flat payload called it
         Card-Focus-Border-Radius and would have matched nothing.

         The Sm-/Lg- pair is not a new Figma variable: componentSizeGroup
         strips the prefix and the size becomes the MODE, so these fill the
         small and large columns of Card/Card-Focus-Radius, which were
         echoing medium — a 21px ring on the 14px small card. */
      'Card-Focus-Radius': r.cardFocusRadius,
      'Sm-Card-Focus-Radius': r.smCardFocusRadius,
      'Lg-Card-Focus-Radius': r.lgCardFocusRadius,
      /* Three real values instead of medium repeated three times. No new
         variable in Figma: componentSizeGroup strips the Sm-/Lg- prefix and
         the size becomes the MODE, so this fills the two columns of
         Card/Card-Padding that were echoing medium. */
      'Card-Padding': r.cardPadding,
      'Sm-Card-Padding': r.smCardPadding,
      'Lg-Card-Padding': r.lgCardPadding,
    },
    Input: {
      'Input-Radius': r.inputRadius,
      'Sm-Input-Radius': r.smInputRadius,
      'Lg-Input-Radius': r.lgInputRadius,
      'Input-Focus-Radius': r.inputFocusRadius,
      'Input-Inner-Focus-Radius': r.inputInnerRadius,
      ...inputExtras,
      /* Input-Swatch-Radius is deliberately NOT here — it is a WEB-ONLY token.
       *
       * It came across with the rest of the deleted `Components` payload, and
       * carrying it looked like part of the move. But nothing in Figma draws
       * the thing it measures: the Dropdown and Input pages have no swatch
       * node, and the Input component set has no color mode — its properties
       * are Input Buttons, Input Button Slot, State and Type.
       *
       * The library does have it. Select.js reads
       * `var(--Input-Swatch-Radius, var(--Button-Radius))` for the color-mode
       * swatch, and exportToCSS and buildPreviewCSS both emit all three sizes.
       * So the token is real and stays in the CSS; it simply has no Figma
       * counterpart to write to.
       *
       * Emitting it anyway is not harmless. The writer is update-only, so a
       * name the file lacks is skipped in SILENCE — which makes the payload
       * look like it covers something it does not, and puts a permanent entry
       * on the known-missing list where a real gap would be indistinguishable
       * from this deliberate one.
       *
       * If a color Select is ever built in Figma, this comes back with it. */
      /* `Input-Inner-Focus-Visible` is deliberately NOT carried over. The flat
         payload computed it as Math.max(0, inputRadius - 1), which is exactly
         `inner(inputRadius)` — the same number as Input-Inner-Focus-Radius on
         the line above, under a name that says a STATE where a radius belongs.
         One value under two names is worse than a gap, because both sides look
         complete. */
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
    Tooltip: tooltipMetricsFlat(),
    FAB: fabMetricsFlat(),
    /* The dropdown panel, its rows and their focus ring — one group, because
       the three are one derivation: the frame follows the brand and the other
       two are concentric off it (componentRadii.ts).

       Dropdown-Frame-Radius MOVED HERE from Other on 2026-09-23, matching the
       file. It has to move in the same pass as the Figma group or the writer
       goes quietly dead: populateComponentSize is UPDATE-ONLY and matches on
       the full `Group/Name`, so `Other/Dropdown-Frame-Radius` against a file
       holding `Menu/Dropdown-Frame-Radius` skips silently and leaves the value
       at whatever was last typed by hand. Same shape as the `Accordian`
       rename and `Radio-Size`. */
    Menu: {
      'Dropdown-Frame-Radius': r.dropdownFrameRadius,
      'Menu-Item-Radius': r.menuItemRadius,
      'Menu-Focus-Radius': r.menuFocusRadius,
    },
    Other: {
      'Modal-Radius': r.modalRadius,
      /* Modal-Padding only, of the three that came off `Components`.
       *
       * A modal does not take focus — it is the thing that HOLDS the focusable
       * controls, and the scrim beneath it means nothing outside it is
       * reachable — so a focus radius describes a ring that is never drawn.
       * An inner radius has no use either without one.
       *
       * Single value, no Sm-/Lg- triple: a modal is one size. componentSizeGroup
       * writes the same number into all three modes, which is what the file
       * already holds for Modal-Radius. */
      /* Three values, so the three size modes differ. A single one gave a
         720px-wide modal a 400px one's inset, which is what drove Modal.js to
         hardcode its own 24 / 32 / 40 table. */
      'Modal-Padding': r.modalPadding,
      'Sm-Modal-Padding': r.smModalPadding,
      'Lg-Modal-Padding': r.lgModalPadding,
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
