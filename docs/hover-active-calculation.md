# Hover / Pressed State Calculation

How every button's Hover and Pressed colors are derived from its resting fill.
The rule is identical across the generated CSS, the Figma export, the live
preview, and the engine — so all four agree — and the accessibility report reads
these baked values rather than recomputing them.

**Source of truth:** `staticTokenStructures.ts` `buildHoverForPalette()`, applied via
`getStaticHoverTokens()` / `getStaticActiveTokens()` and assigned to
`Modes.{mode}.Hover` / `.Pressed` in `exportColorSystem.ts`.
**Mirrored in:** `exportToCSS.ts` (`pressedToneHex` / `hoverBlendHex`), `buildPreviewCSS.ts` (`activeAndHoverFor`), `generateFigmaJSON.ts` (`pressedHexFor`).
**Consumed by:** `accessibilityReport.ts` reads the baked `Buttons.{palette}.{bucket}.Pressed` / `.Hover` tokens.

> This previously pointed at `_pressedHex()` / `generateHoverColors()` /
> `generateActiveColors()` in `exportColorSystem.ts`. Those were never called —
> a stale duplicate that chose direction from a YIQ brightness threshold rather
> than the tone split below, which disagreed on saturated mid-tones. They have
> been deleted; `buildHoverForPalette()` is the only implementation.

## The rule

For a button whose fill is `Color-N` of a palette:

### Pressed

One step in the **button's own lightness direction**:

- **Dark button** (fill luminance ≤ 0.5, i.e. tones ~1-5) → step **darker**: `Color-(N−1)`.
- **Light button** (fill luminance > 0.5, i.e. tones ~6-12) → step **lighter**: `Color-(N+1)`.

At the extremes there is no next tone, so Pressed goes to a pure endpoint —
never back to the button's own tone (there must always be a visible delta):

- Darkest button (**tone 1**) → **`#000000`** (black).
- Lightest button (**tone 12**) → **`#FFFFFF`** (white).

Direction is keyed on the **tone index**: 1-5 step darker, 6-12 step lighter.
This matches where every `Text.Surfaces.{palette}` table flips from light text
to dark text (Color-1..5 light, Color-6..12 dark), which is what makes the rule
safe: the state always moves *away* from the text sitting on it, so contrast can
only improve. A state can therefore never fail if the resting pair passes.

(An earlier revision of this doc claimed direction was keyed on the fill's
actual luminance. It is not, and it should not be — a luminance threshold
disagrees with the tone split on saturated mid-tones such as `#ef5854`, which
measures "light" by brightness while carrying light text. Keying on the tone
index keeps the state aligned with the text.)

### Hover

A 50% blend of the button background and its Pressed value:

```
Hover = mix50(fill, Pressed)
```

So Hover always sits halfway between the resting fill and the Pressed state —
a subtler version of the same move.

## Worked examples

| Fill tone | Button | Pressed | Hover |
| --------- | ------ | ------- | ----- |
| Color-9 (dark) | dark | Color-8 | mix(Color-9, Color-8) |
| Color-3 (dark) | dark | Color-2 | mix(Color-3, Color-2) |
| Color-10 (light) | light | Color-11 | mix(Color-10, Color-11) |
| **Color-1** (darkest) | dark | **#000000** | mix(Color-1, #000) |
| **Color-12** (lightest) | light | **#FFFFFF** | mix(Color-12, #fff) |

## CSS usage

```css
/* Surface hover/pressed scrims */
.interactive:hover  { background: var(--Hover); }
.interactive:active { background: var(--Pressed); }

/* Button hover/pressed */
.btn:hover  { background: var(--Buttons-Primary-Hover); }
.btn:active { background: var(--Buttons-Primary-Pressed); }
```

## Why this matters for accessibility

Because Pressed always moves *away* from the resting fill in luminance (and the
fill/text pairing was already chosen to clear contrast), the Hover/Pressed states
preserve — and usually improve — text contrast, while guaranteeing a visible
feedback shift from resting → hover → pressed. The accessibility report contrast-
checks button text against the baked Hover and Pressed values at 4.5:1.
