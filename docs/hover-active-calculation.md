# Hover / Active State Calculation

How the accessibility report derives a button's hover and active colors from its fill, so contrast checks reflect what the user actually perceives on interaction.

**Source file:** `src/utils/accessibilityReport.ts` — `adaptiveAlpha()` + `mixHex()` + the branch in `collectChecks()`.

## Goal

Instead of trusting whatever `Hover` / `Active` tokens an export happens to emit, compute both states deterministically from the button's resting fill + text pair. The target is a consistent perceived shift across the whole palette — mid-tone fills get a smaller overlay, near-extreme fills (very light or very dark) get a larger one, so hover and active always look distinct from the resting state.

The rule runs the same in Light and Dark mode.

## Step 1 — Pick the overlay direction

Read the button's `text` color.

- **Dark text** (relative luminance ≤ 0.5) → the fill is one of the lighter tones (Color-6 through Color-12), so we **lighten** hover / active with white.
- **Light text** (relative luminance > 0.5) → the fill is one of the darker tones (Color-1 through Color-5), so we **darken** with black.

This mirrors the design system's own rule: tones 1-5 pair with light text, tones 6-12 pair with dark text.

## Step 2 — Set a target luminance shift

Hover and active each have a calibrated target, picked so a fill at `L = 0.5` produces exactly the base percentage you specified:

|                              | Hover target | Active target |
| ---------------------------- | ------------ | ------------- |
| **Dark text** (white overlay)  | 0.15         | 0.25          |
| **Light text** (black overlay) | 0.04         | 0.075         |

`targetShift = baseAlpha × 0.5` — i.e. at mid-lightness, the resulting alpha equals the base (30% / 50% white, 8% / 15% black).

## Step 3 — Compute the required alpha

```
requiredAlpha = targetShift / |L_fill − L_overlay|
```

Where `L_overlay` is `1` for white and `0` for black. As the fill approaches the overlay color, the denominator shrinks and alpha scales up — which is exactly the behavior we want, since mixing white into a nearly-white fill barely moves the needle unless the alpha is high.

## Step 4 — Clamp

```
alpha = min(0.95, max(baseAlpha, requiredAlpha))
```

- **Floor at baseAlpha.** Mid-tone fills keep their base percentage; we never reduce below it.
- **Ceiling at 0.95.** Mixing pure white with white (or black with black) is a no-op, so there is no point going higher. If `|L_fill − L_overlay| < 0.001`, short-circuit to 0.95.

## Step 5 — Blend

Standard source-over alpha composite of overlay onto fill:

```
out = alpha × overlay + (1 − alpha) × fill
```

Result is an opaque 6-digit hex. That's the color that gets contrast-checked against the button text in the report.

## Examples

Values pulled from a live export (Dark mode · Light bucket, Primary palette among others):

| Context                           | fill       | fill L | base α | adaptive α | hover result |
| --------------------------------- | ---------- | ------ | ------ | ---------- | ------------ |
| Primary (very pale cream fill)    | `#eee2be`  | ~0.78  | 30%    | ~68%       | `#f9f4e7`    |
| Neutral (mid gray fill)           | `#c9c9c9`  | ~0.58  | 30%    | ~36%       | `#dcdcdc`    |
| Info (medium blue fill)           | `#5784ff`  | ~0.26  | 30%    | 30% (floor)| `#89a9ff`    |

Active uses the same math with a bigger target shift, so it lands further toward the overlay color than hover. For very-light fills, active can get pushed close to the overlay — e.g. Primary's active on a near-cream fill ends up around `#fefefc`.

## Why this matters for accessibility

The report's Button rows check `contrast(text, hoverComposite)` and `contrast(text, activeComposite)` against the 4.5 : 1 threshold. Because the text / fill pairing was already chosen by the design system to clear contrast, and the hover / active composite always moves *toward* the overlay color (away from text in luminance), the adaptive shift preserves — and usually improves — contrast. The adaptive step just guarantees that, at the same time, the *visual* shift from resting to hover to active is distinguishable to the user, which matters for feedback affordance regardless of whether raw contrast already passed.
