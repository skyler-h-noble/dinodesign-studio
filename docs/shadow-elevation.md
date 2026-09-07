# Shadow Elevation — Drop-Colors and the alpha contract

How one shadow colour per background becomes 31 Figma variables, why it has to,
and why the CSS and the Figma payload write the alpha differently on purpose.

**Source of truth:** `src/utils/dropshadow.ts` — `dropshadowBaseHex()`,
`dropshadowAlphas()`, `shadowLayers()`, `dropColorTable()`, `quantizeAlpha()`.
**Applied in:** `generateFigmaJSON.ts` (Drop-Colors, Elevation, Component-Elevations),
`componentElevation.ts` (per-component geometry + alias), `exportToCSS.ts`
(`--Dropshadow-Color` + `--Effect-Level-N`).
**Tested by:** `src/__tests__/dropColors.test.ts`, `shadowExport.test.ts`,
`effectLevels.test.ts`.

---

## One colour per background

A surface casts **one** shadow colour. It is the surface's own hue, saturation
pulled into a moderate band, lightness lowered — `dropshadowBaseHex()`. Elevation
is carried entirely by geometry, layer count and alpha; never by a second colour.

```
#ffffff -> #858585      #1e1e1e -> #141414
#faf6f0 -> #b98f51      #0d1b2a -> #0a121a
#f0f4fa -> #517ab9      #2b1810 -> #1b100b
```

The tint is a real, large variation — grey on white, tan on cream, blue on a cool
surface — and it is driven by the *theme*, not the surface level. Within one
theme the surface levels barely move, because the lightness clamp flattens them:

```
Color-12  #faf6f0 -> #b98f51        max per-channel spread across
Color-11  #f2ebe0 -> #b58f54        Color-12..9 is 10, which at peak
Color-10  #e6dac6 -> #b49055        alpha 0.41 is 1.6% of range
```

That measurement is why `Drop-Colors` varies by theme and not by surface level.

---

## Why CSS and Figma are shaped differently

This is the one place the two exports diverge in **structure**, and it is forced
by Figma, not chosen.

**CSS composes at use time.** One colour, alpha mixed in per layer:

```css
--Dropshadow-Color: 185, 143, 81;      /* r, g, b — no alpha */

--Effect-Level-3:
  0.3px 0.5px 0.7px 0px    rgba(var(--Dropshadow-Color), 0.412),
  0.3px 0.6px 0.8px -0.5px rgba(var(--Dropshadow-Color), 0.329),
  ...
```

**Figma cannot compose at all.** The two relevant API shapes:

```ts
SolidPaint.color         RGB    // "does not have a alpha property, use `opacity`"
DropShadowEffect.color   RGBA   // "the color of the shadow, INCLUDING its opacity"
VariableAlias          { type, id }   // a pointer — no modifier of any kind
```

A **fill** splits colour from opacity, so a fill can bind one colour variable and
set its own alpha. A **shadow** folds them into a single RGBA field, and
`VariableBindableEffectField` is `'color' | 'radius' | 'spread' | 'offsetX' |
'offsetY'` — there is no opacity to bind. Aliasing cannot supply one either,
because an alias resolves to the source's whole RGBA.

So "link to the Drop-Color and apply the level's opacity" — the obvious model,
and the correct one — is expressible in CSS and not in Figma. This is a
long-standing, frequently-requested gap, and the shadow case is the one everyone
hits: teams end up with one variable per opacity.

**But an alias CARRIES an alpha perfectly well — it just cannot APPLY one.** So
the multiplication happens once at the bottom of the chain, and the layers above
are pure aliases. Each collection contributes the mode axis it already owns:

```
Modes        Drop-Color/Level-3/Drop-Color-2/<theme>   #502b6454   Light + Dark
   ↑ alias                                             the mix, baked once
Theme        Drop-Color/Level-3/Drop-Color-2           9 theme modes
   ↑ alias
Drop-Colors  Level-3/Drop-Color-2                      no modes
```

That keeps it **dynamic**. Light/dark comes from `Modes` and the palette from
`Theme` — both already set on every frame — so switching a frame's theme
re-tints every shadow with no regeneration, and `Drop-Colors` needs no modes of
its own. There is no second mode axis to keep in sync, which is the failure
[invariant 1](design-system-architecture.md#invariants) is about.

It also stays a single source: change the background and all 31 move together,
because all 31 derive from the one `dropshadowBaseHex()`.

> This is `DYNO-IP-2025-015` (Channel-Optimized Token Resolution) running in the
> other direction. There, CSS gets resolved hex and Figma keeps the indirection
> chain. Here, CSS keeps the composable form and Figma gets the pre-multiplied
> values. The principle is the same — emit the shape each channel can consume —
> and the direction is decided per token family by what the channel supports.

---

## The collections

### `Drop-Colors` — aliased colour, written opacity

| | |
| --- | --- |
| modes | none |
| variables | `Level-<1-5>/Drop-Color` (COLOR) and `Level-<1-5>/Opacity` (FLOAT) |

The Drop-Color is **aliased in Figma** to `Surface/Dropshadow-Color`, and its
opacity is **bound to its sibling `Opacity` variable**, which the payload writes.

That split is the whole trick. A plugin cannot express "this alias, dimmed" —
checked against plugin-typings 1.138:

```ts
interface VariableAlias { type: 'VARIABLE_ALIAS'; id: string }
type VariableValue = boolean | string | number | RGB | RGBA | MotionEasing | VariableAlias
```

One or the other, no modifier field. But Figma can **bind a colour's opacity to
a number variable**, and a number is trivially writable. So the colour keeps its
alias — and with it the entire `Modes → Theme → Surface` chain, meaning a shadow
follows theme, surface level *and* light/dark with nothing generated for the
tint — while the alpha arrives as a plain float.

Nothing is emitted for the colour. Two earlier attempts bolted on a generated
chain (a 45-variable `Modes/Drop-Color` leaf plus per-level `Theme` aliases)
purely to have somewhere to bake the alpha. This needs none of it: **five
floats**, and `Modes` keeps only its opaque `Dropshadow-Color`.

**One opacity per level, not per layer**, since the alpha is flat across a
level's layers. Which slots are LIVE at the current Resolution is recorded on
`Component-Elevations`, whose spare slots carry a transparent literal.

Emitted as 0..1 — how Figma stores an opacity; the UI renders `0.345` as `35%` —
and quantised through the same `quantizeAlpha()` the CSS uses, so the float
Figma holds and the alpha the CSS paints are one number rather than two that
round differently.

```
Level-1/Opacity  0.345      Level-4/Opacity  0.329
Level-2/Opacity  0.306      Level-5/Opacity  0.333
Level-3/Opacity  0.361
```

### `Elevation` — the reference ladder

`Level-<n>/Shadow-<m>/{offset-x, offset-y, blur-radius, spread-radius, opacity}`.
Kept as the readable ladder and for binding shadows on a node directly.

Its `opacity` variable **cannot be consumed by an effect** — see above — so it is
documentation, not a binding target.

### `Component-Elevations` — which component sits where

| | |
| --- | --- |
| modes | `Standard`, `Elevated` |
| variables | `<Group>/<State>/Level`, `<Group>/<State>/Shadow-<n>/<field>` |

Geometry is written as **literal numbers**; colour is an **alias** into
`Drop-Colors`:

```
Card, Handle, Bottom Sheet/Default/Shadow-2/offset-y      = 2.5
Card, Handle, Bottom Sheet/Default/Shadow-2/blur-radius   = 3.4
Card, Handle, Bottom Sheet/Default/Shadow-2/color         = {Drop-Colors.Level-1.Drop-Color}
Card, Handle, Bottom Sheet/Default/Shadow-3/color         = #00000000      <- spare slot
```

The split is not arbitrary. Geometry does not depend on the theme, so it can be a
literal on a collection whose modes are Standard/Elevated. Colour does depend on
the theme, and this collection has no theme mode to vary it along — so it aliases
into `Drop-Colors`, and the chain above resolves the rest. A node's shadow hue
therefore comes from its **Theme** mode (and Light/Dark from `Modes`), both of
which every frame already sets; Component-Elevations never needs a theme axis of
its own, and neither does `Drop-Colors`.

**Aliasing the colour is possible only because Level is a variable NAME rather
than a mode.** While Level was a mode, no alias could name a particular level —
`Elevation/Shadow-1/offset-y` resolves in whatever Elevation mode the *consuming*
node is in — which is what previously forced the level to ship as a bare number.

`Elevated` is `Standard + 1`, capped at 5. Dialog is the one component that does
not move between the modes, because it is already at the top.

---

## The alpha contract

### An unused slot is marked by alpha `00`, not by zeroed geometry

Below Resolution 1 a level uses fewer layers than it has slots. The tail is still
emitted, at alpha `00`:

```
Level-5 @ Resolution 1.0   69 5E 54 49 3F 34 2A 1F 15 0A
Level-5 @ Resolution 0.5   69 5B 4E 41 34 27 1A 0D 00 00
```

Two reasons it is emitted rather than skipped:

1. **A Figma variable left unwritten keeps its previous value.** A slot dropped
   by a lower Resolution would go on painting the shadow it held before.
2. **Zeroed geometry is not invisible.** A `0 0 0 0` shadow paints the element's
   silhouette at full strength directly behind it — invisible only while the
   spread is also 0 *and* the element is opaque.

The geometry and the colour must agree about which slots are live. Both derive
from `shadowLayerCount()`, and `dropColors.test.ts` pins them in lockstep across
five Resolution settings.

### CSS and Figma hold the same alpha, exactly

A Figma colour is 8-bit. CSS alpha is a float. Written naively the same ramp
value lands on two different numbers:

```
0.35875   ->  byte 91 = 0.3569   (Figma)
0.35875   ->  0.359              (CSS, rounded to 3dp)
```

Nothing visible turns on 0.002 of alpha. What turns on it is being able to assert
that the two exports hold the **same number** rather than two numbers a tolerance
apart — and a tolerance is exactly where a real divergence hides. Invariant 5
says to assert the value a token actually resolves to; a `±1/255` allowance is
not that.

So the quantisation happens at the **emission boundary**, in `quantizeAlpha()`:

```ts
quantizeAlpha(a) = round(round(a * 255) / 255 * 1000) / 1000
```

- **Figma** stores the byte.
- **CSS** emits `k/255` rounded to 3dp, which always parses back to byte `k` —
  the rounding error is at most 0.0005, or 0.13 of a byte.
- **`Elevation/opacity`** emits the same value.

All three now agree, and `dropColors.test.ts` asserts equality rather than
closeness.

**The ramp itself is left exact.** `dropshadowAlphas()` still returns
`intensity × (n−i)/n`, with the peak landing on INTENSITY on the nose — two tests
in `effectLevels.test.ts` pin that. Quantising there would have made the peak
*approximately* the intensity and muddied a clean contract to fix a rounding
artifact. The 8-bit constraint belongs where it actually exists, at the edge.

The visible consequence is that emitted CSS alphas moved by up to 1/510 — `0.41`
became `0.412`. That is the value that was always going to render.

---

## The model, measured

Not inferred — read off **ten captures** of Comeau's generator across the
Resolution slider at Oomph 0.5 / Crispness 0.5.

### Alpha is flat, and inversely proportional to the layer count

```
alpha = TOTAL[level] / N          the same value on every layer
```

| tier | samples | alpha × N |
| --- | --- | --- |
| low (Level-1) | N=2 → 0.52, N=3 → 0.34 | **1.03** |
| medium (Level-3) | N=2 → 0.72, 3 → 0.48, 4 → 0.36, 5 → 0.29 | **1.44** |
| high (Level-5) | N=3 → 0.89, 4 → 0.67, 5 → 0.54, 6 → 0.45, 7 → 0.38, 8 → 0.34, 9 → 0.30, 10 → 0.27 | **2.68** |

Those three totals reproduce all fourteen samples exactly at his 2dp printing,
and the intervals they are consistent with — `[1.030, 1.035)`, `[1.430, 1.450)`,
`[2.680, 2.685)` — pin them to within half a printed digit.

**So Resolution genuinely cannot change a shadow's weight.** Adding layers
subdivides the same envelope *and* splits the same total opacity. Elevation is
carried by the total, which differs per level, and by the geometry. Levels 2 and
4 are the geometric means, 1.218 and 1.965. `INTENSITY` scales all five
linearly, with 0.5 as the unit, so the default preset reproduces his output.

### Layer counts

`round(min + (max−min) × resolution)`, with his low 2..3, medium 2..5, high
3..10 — every observed count reproduced. Levels 2 and 4 interpolate, giving
maxes of **3, 4, 5, 7, 10**.

Note these are *smaller* than the Drop-Colors slot counts of 3, 4, 6, 8, 10. The
slots are pinned to the collection that exists in the Figma file rather than
derived from the ladder, because a Figma variable cannot be deleted and
re-created without unbinding every layer using it. Every max fits inside its
slot count, so levels 3 and 4 leave one spare at alpha `00` and the file needs
no rebuild.

### Geometry

| | |
| --- | --- |
| distance | low/medium/high end at **y = 2 / 10 / 50**; levels 2 and 4 are the geometric means, 4.5 and 22.4 |
| contact layer | always `0.3px 0.5px 0.7px` with no spread, at every tier and every Resolution |
| offset curve | **exponential**, `y = Y_MIN + (yMax − Y_MIN)(a^t − 1)/(a − 1)` with a = 12.14 |
| blur | 1.257 × offset-y at Crispness 0.5 |
| spread | linear, 0 at the contact layer to −2.5 at the outermost, **uncapped** |

The offset curve is the interesting one. His high tier at 9 layers and his
medium at 5 have different envelopes and different layer counts, yet normalise
onto a single curve — `u = 0.086 / 0.220 / 0.494` at `t = ¼, ½, ¾` from both —
so it is a real shared distribution, not a fit to one sample. The exponential
lands at RMS 0.0046 against a cubic's 0.0637.

## What this file previously had wrong

Each of these came from one earlier reverse-engineering pass, and each was
stated in a comment confidently enough to survive:

| | was | measured |
| --- | --- | --- |
| alpha | ramp, peak at INTENSITY, "0.81 → 0.08" | flat; ten layers at 0.27 |
| Level-5 distance | 74px | 50px |
| offset curve | cubic `t^3` | exponential, a = 12.14 |
| blur ratio | 1.35 × y at Crispness 0.5 | 1.257 |
| spread | capped against the envelope *and* the blur | uncapped |
| layer counts | 1..3 / 2..4 / 3..6 / 4..8 / 5..10 | 2..3 / 2..4 / 2..5 / 3..7 / 3..10 |

The caps are worth singling out. Both only ever fired on the small levels, so
they silently made the bottom of the ladder differ *in kind* from the top — his
low tier, whose whole envelope is 2px, runs the spread all the way to −2.5px,
and its middle layer pairs blur 1px with spread −1.2px, which the blur cap
forbade.

Constant-total-per-tier is also close to the model this file used *before* the
ramp, which solved the peak so a level composited to a fixed total. That was
right in shape and wrong only in normalising the total across levels as well,
which flattened elevation out of the ladder.

One thing is still provisional: the **blur ratio's slope**. All ten captures are
at Crispness 0.5, so only the midpoint is measured. The −0.9 slope is carried
over from the earlier pass, which also put the midpoint at 1.36 — contradicted
here. Capture at Crispness 0 and 1 to settle it.
