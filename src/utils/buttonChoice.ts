/**
 * The Default button choice: a COLOR and a TONE, picked separately.
 *
 *   color  primary | secondary | match | laddered | black-white
 *   tone   fixed | tonal          (black-white has no tone choice)
 *
 * Fixed keeps the brand tone of the chosen color on every background; the
 * button's BORDER carries the 3:1 against the surface. Tonal keeps the same
 * color but moves the fill to the tone that holds 3:1 against the surface it
 * sits on — the tone Border, Icons and Focus already use (iconToneAt) — so the
 * fill is its own border.
 *
 * Tonal never changes the color. Primary + Tonal on a Tertiary background is a
 * Primary button at the Primary tone that clears 3:1 there, not a Tertiary one.
 *
 * Match takes the surface's own color: Primary on Primary, Secondary on
 * Secondary, Tertiary on Tertiary, and Primary on Neutral (a neutral surface
 * has no brand color of its own to match).
 *
 * Laddered picks the color from the surface: Primary → Secondary,
 * Secondary → Tertiary, Tertiary → Primary, Neutral → Primary. The same
 * rotation as the Eyebrow table.
 *
 * Stored as `button` (color) + `buttonTone`. The old single value 'tonal' meant
 * "the primary color at the border tone", which is Primary + Tonal, and is read
 * that way.
 */
export type ButtonColor = 'primary' | 'secondary' | 'match' | 'laddered' | 'black-white';
export type ButtonTone = 'fixed' | 'tonal';
export type ButtonPalette = 'Primary' | 'Secondary' | 'Tertiary' | 'Neutral';

export interface ButtonChoice { color: ButtonColor; tone: ButtonTone }

export function resolveButtonChoice(button?: string | null, buttonTone?: string | null): ButtonChoice {
  const raw = String(button || 'primary');
  if (raw === 'black-white') return { color: 'black-white', tone: 'fixed' };
  // Older stored shapes: 'tonal', and the combined 'primary-fixed' /
  // 'secondary-adaptive' strings the export parser still accepts.
  const head = raw.split('-')[0];
  if (head === 'tonal') return { color: 'primary', tone: 'tonal' };
  const color: ButtonColor = head === 'secondary' || head === 'match' || head === 'laddered' ? head : 'primary';
  return { color, tone: buttonTone === 'tonal' ? 'tonal' : 'fixed' };
}

/** Which palette the Default button draws from on a surface of `surface`. */
export function buttonPaletteFor(color: ButtonColor, surface: ButtonPalette): ButtonPalette {
  switch (color) {
    case 'secondary': return 'Secondary';
    case 'match': return surface === 'Neutral' ? 'Primary' : surface;
    case 'laddered':
      return surface === 'Primary' ? 'Secondary' : surface === 'Secondary' ? 'Tertiary' : 'Primary';
    case 'black-white': return 'Neutral';
    default: return 'Primary';
  }
}

/* ── Advanced: the tone, per background and surface level ─────────────────
 *
 * The COLOR always comes from the main choice — Primary, Secondary, Match,
 * Laddered — so the system stays one decision. What can vary is the TONE, cell
 * by cell: Fixed may be right on a theme's Dimmest and weak on its Brightest,
 * and a person may want a tone neither rule lands on.
 * Keyed 'Theme/Surface-Level'; only cells that differ from the main tone are
 * stored.
 */
/** A cell's tone: Fixed, Tonal, or a tone picked outright (1–12 of the
 *  button's palette, in the current mode's ramp). */
export type CellTone = ButtonTone | number;
export type ButtonCellTones = Partial<Record<string, CellTone>>;
export const BUTTON_BACKGROUNDS: ButtonPalette[] = ['Primary', 'Secondary', 'Tertiary', 'Neutral'];

/** The button on one background: its color from the rule, its tone from the
 *  cell's override if there is one, else the rule. */
export function buttonForSurface(
  choice: ButtonChoice, surface: ButtonPalette, cellTone?: CellTone,
): { color: ButtonPalette | 'black-white'; tone: CellTone } {
  if (choice.color === 'black-white') return { color: 'black-white', tone: 'fixed' };
  return { color: buttonPaletteFor(choice.color, surface), tone: cellTone ?? choice.tone };
}
