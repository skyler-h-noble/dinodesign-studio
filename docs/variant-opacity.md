# Variant Token Opacity

How `Border-Variant` and `Icon-Variant` derive from their base tokens. The rule
is identical across the generated CSS, the Figma export and the live preview, so
all three agree.

**Source of truth:** `src/utils/variantAlpha.ts` — `adaptiveVariantAlpha()` / `variantHex8()`.
**Applied in:** `generateFigmaJSON.ts` (Border-Variant + Icon-Variant families),
`exportToCSS.ts` (Border-Variant lookup), `exportColorSystem.ts` (Icon-Variant bake).
**Exempt from:** contrast checks — see [Why variants aren't audited](#why-variants-arent-audited).

## What a variant is

A variant is its base colour at reduced opacity:

| Token | Base | Base alpha |
| --- | --- | --- |
| `Border-Variant` | `Border` | **20%** |
| `Icon-Variant` | `Icon` | **50%** |

`Border-Variant` is a subtle divider — a quieter rule line than a real border.
`Icon-Variant` is a de-emphasised icon, for secondary or inactive states.

## The rule

A flat alpha does **not** read consistently. What the eye registers is the
luminance shift the overlay produces, roughly:

```
perceived shift  ≈  alpha × |L(colour) − L(background)|
```

Where a variant sits close to its background that product collapses and the
token becomes invisible. Where they are far apart it reads heavy. Measured
across all 324 theme × surface contexts at a flat 20%:

| | perceived shift | luminance gap |
| --- | --- | --- |
| weakest — Black theme, Surface | 0.0125 | 0.257 |
| strongest — Success, Container-Lowest | 0.3421 | 0.939 |

A **27× spread** from one flat number.

So alpha adapts. The base is a **floor**, raised as the colour approaches its
background, capped so a variant can never become opaque:

```
targetShift = baseAlpha × 0.5          calibrated for a mid-luminance pairing
required    = targetShift / |L(colour) − L(background)|
alpha       = clamp(required, baseAlpha, 0.95)
```

With base 20% this yields alpha **0.20–0.41** and narrows the spread to ~15×.

### Which background

The variant families are indexed by **background tone**, so
`Border-Variant.Surfaces.<palette>.Color-N` is the border for a surface at tone
`N` — and that palette's `Color-N` *is* the background it sits on. That entry is
what gets passed as the second colour.

### Worked examples

| Palette / tone | Base colour | Gap | Alpha | Why |
| --- | --- | --- | --- | --- |
| Info, Surface-Bright | border ≈ surface | 0.246 | 0.41 | close together — lifted |
| White, Surface | border far from surface | 0.697 | 0.20 | wide gap — stays at the floor |

## Why a floor and not a target

Making the base a *target* — lowering alpha where the gap is wide as well as
raising it where narrow — was measured and came out no better (15.0× vs 14.8×).
The floor is kept because it is the more predictable of the two: a variant never
renders weaker than its stated base.

The residual spread is inherent. Compositing is non-linear in luminance because
of sRGB gamma, so `alpha × gap` is an approximation, not an identity. Fully
normalising perceived weight would need a per-pairing solve rather than a
closed-form alpha.

## Why variants aren't audited

Neither token carries a contrast requirement:

- `Border-Variant` is decorative. It conveys no information and has no state, so
  WCAG 1.4.11 does not apply — a real `Border` is checked at 3:1 instead.
- `Icon-Variant` is a de-emphasised alternate. The meaningful icon is `Icon`,
  which is checked at 3:1.

Both are excluded from the accessibility audit by design. **Alpha here is purely
a visual control and cannot move the audit numbers** — which also means a
regression in either is invisible to it. The Figma ↔ CSS parity check is what
covers them.

## History

Both tokens previously shipped wrong, in ways the contrast audit could not see:

- **`Border-Variant` alpha disagreed across the codebase** — 15% (`26`) in the
  exporters, 40% (`66`) in `updateSimplifiedArchitecture.ts`. The studio preview
  and the shipped bundle rendered different weights.
- **`Icon-Variant` had no opacity at all.**
  `generateIconVariantPaletteStructure()` returned `generateIconPaletteStructure()`
  verbatim, so 208 variables duplicated `Icon` exactly — identical values, no
  differentiation, in Figma and CSS alike.
- **`Border-Variant` was baked into the Theme layer**, which is mode-independent,
  freezing the light-mode value into dark mode. 153 tokens diverged between
  `figma.json` and the CSS. It is now emitted as a reference
  (`{Border-Variant.Surfaces|Containers.<palette>.Color-N}`) and resolves per
  mode, exactly as its sibling `Border` does.

## Tuning

`BORDER_VARIANT_ALPHA` and `ICON_VARIANT_ALPHA` in `variantAlpha.ts` are the
knobs. Raising a base raises the whole curve — it is a floor, so every pairing
moves. The `0.5` factor in `targetShift` controls how aggressively narrow-gap
pairings are lifted; the `0.95` cap only binds when a variant is
indistinguishable from its background.
