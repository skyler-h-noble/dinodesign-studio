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

### Direction — decided by the LABEL

The invariant is simple: **the state moves away from the text sitting on it.**

- Label is **lighter** than the fill (light text) → step **darker**.
- Label is **darker** than the fill (dark text) → step **lighter**.

The label is read from `Text.Surfaces.{palette}.Color-N` — the same token the
button actually renders — and compared to the fill by relative luminance.

> **This used to key on the tone index** (1-5 darker, 6-12 lighter), on the
> assumption that every palette's text table flips at tone 6. Measured across
> brands, 23 of 24 palette/mode combinations do. The exception is exactly where
> it broke: an olive primary (`#6b7a4f`, L=49) whose Color-6 still carries a
> LIGHT label. Stepping "lighter" there walked into the label and took a 4.54:1
> button to **2.17:1** pressed.
>
> An earlier revision keyed on the fill's own luminance, which is worse again —
> a saturated mid-tone like `#ef5854` measures "light" by brightness while
> carrying light text.
>
> Reading the label removes the assumption entirely. If the resting pair passes,
> the states cannot fail.

### Pressed — one step, except at the ends

| Fill tone | Pressed |
| --- | --- |
| 2-11 | one full tone in the direction above |
| **1** | **half a step lighter** — see below |
| **12** | `Color-11` — darker, inverted |

**Both ends invert, because neither has headroom.**

Tone 12 is already near-white (`#fcfcfc`); a step toward `#FFFFFF` moves almost
nowhere. It costs nothing — text on `Color-11` still measures ~9.4:1.

Tone 1 previously stepped to `#000000`. From a fill already at `#040404` that is
a contrast ratio of **1.02 against itself** — no visible feedback whatsoever. It
now steps lighter instead.

### Why tone 1 moves only HALF a step

`Color-1 → Color-2` is L=1 → L=10: a tenfold change in luminance. The same step
at the light end (L=98 → L=99) is nothing. A full step at the dark end reads as
the button changing colour rather than responding — `#040404` going visibly grey.

Half a step lands at `#101010`:

```
before   #040404 → hover #020202 (Δ1.012)  pressed #000000 (Δ1.023)   invisible
after    #040404 → hover #0a0a0a (Δ1.036)  pressed #101010 (Δ1.077)
```

Roughly 8× the delta, and the label still sits at ~13:1 because tones 1-5 carry
light text and a slight lightening barely closes on it.

## Worked examples

| Fill tone | Label | Direction | Pressed | Hover |
| --- | --- | --- | --- | --- |
| Color-3 | light | darker | Color-2 | mix(Color-3, Color-2) |
| Color-9 | dark | lighter | Color-10 | mix(Color-9, Color-10) |
| Color-6 *(olive primary)* | **light** | **darker** | Color-5 | mix(Color-6, Color-5) |
| **Color-1** | light | **lighter** — no headroom | **mix(Color-1, Color-2)** | mix(Color-1, Pressed) |
| **Color-12** | dark | **darker** — no headroom | **Color-11** | mix(Color-12, Color-11) |

Row three is the case a tone-index rule gets wrong: same tone as a typical
palette, opposite direction, because its label is light.

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

Because the state always moves *away from the label* — which is now read
directly rather than inferred from the tone — contrast can only improve.

**If the resting pair passes, the states pass.** That is the guarantee, and it
holds for every tone except the two endpoints, where the inversion costs a
little: Color-1 goes 15.79 → 14.63 and Color-12 goes 9.66 → 9.37. Both remain
far above 4.5, which is what makes the inversion safe.

The accessibility report contrast-checks button text against the baked Hover and
Pressed values at 4.5:1, so this is verified rather than assumed.
