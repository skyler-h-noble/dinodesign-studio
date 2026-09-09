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
