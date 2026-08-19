# Accessibility Coverage — What Gets Contrast-Checked

Every colour pairing the system validates, and against which threshold.

Figures below are from a live run of the resolved CSS cascade (`Light-Mode.css` +
`Dark-Mode.css`), not from the token source — so they measure what a browser
actually paints after `data-theme` and `data-surface` resolve.

**Standard:** WCAG 2.2 AA — 4.5:1 for text, 3:1 for non-text and UI components.

---

## The enumeration: 324 contexts

A "context" is one fully-resolved combination a component can find itself in:

```
18 themes  ×  9 surface scopes  ×  2 modes  =  324
```

- **Themes (18)** — Default, Primary, Primary-Light, Secondary, Secondary-Light,
  Tertiary, Tertiary-Light, White, Light-Gray, Black, Info, Info-Light, Success,
  Success-Light, Warning, Warning-Light, Error, Error-Light
- **Surface scopes (9)** — Surface, Surface-Dim, Surface-Dimmest, Surface-Bright,
  plus the five container levels: Container-Lowest, Container-Low, Container,
  Container-High, Container-Highest
- **Modes (2)** — Light, Dark

Every check below runs in *all* 324. Nothing is sampled.

> Read that claim carefully: it is complete over themes and surface scopes, but
> each theme's surface tone comes from the user's extracted colour, so a single
> brand exercises only a few of the twelve tones. See
> [The tone blind spot](#the-tone-blind-spot-closed-2026-08-19) for what that
> hid and how the in-app report now covers all twelve.

---

## The ten categories

**28,294 checks total.** Each row states what is compared against what — the pairing
matters more than the count, because a check against the wrong reference proves
nothing.

| Category | Compared against | Threshold | Checks | Worst measured |
| --- | --- | --- | ---: | ---: |
| **Text** | the context's `--Background` | 4.5:1 | 3,888 | 5.04:1 |
| **Header** | the context's `--Background` | 3:1 | 2,916 | 4.12:1 |
| **Border** | the context's `--Background` | 3:1 | 324 | 3.26:1 |
| **Focus** | the context's `--Background` | 3:1 | 324 | 3.23:1 |
| **Icon** | the context's `--Background` | 3:1 | 2,916 | 3.09:1 |
| **On** | its own `--Icons-<pal>` | 4.5:1 | 2,778 | 5.98:1 |
| **Hover** | the hover fill being moved onto | 4.5:1 | 3,240 | 6.60:1 |
| **Pressed** | the pressed fill being moved onto | 4.5:1 | 3,240 | 5.35:1 |
| **Button** | surface (fill *or* border), and label on fill | 3:1 / 4.5:1 | 5,832 | 3.09:1 |
| **Tag** | the tag's own fill | 4.5:1 | 2,836 | 6.90:1 |

### Roles covered per category

**Text** (4.5:1 vs background) — `--Text`, `--Quiet`, `--Text-<palette>` for all
eight palettes, `--Hotlink`, `--Hotlink-Visited`. Low-emphasis text is held to the
same 4.5 as body text; "quiet" is not a licence to drop below threshold.

**Header** (3:1 vs background) — `--Header`, `--Header-<palette>`. Large-text
allowance applies.

**Border** (3:1 vs background) — `--Border`.

**Focus** (3:1 vs background) — `--Focus-Visible`, per WCAG 2.4.11 / 1.4.11.

**Icon** (3:1 vs background) — `--Icons-<palette>` for all nine.

**On** (4.5:1 vs the icon colour) — `--Icons-On-<palette>`. The foreground for
content sitting *on* an icon colour. Checked against the icon, never the
background: those are different references and only one of them is meaningful.

**Hover / Pressed** (4.5:1) — two distinct pairings each:
- `--Text` against the surface's own `--Hover` / `--Pressed` scrim
- `--Buttons-<pal>-Text` against that button's own hover / pressed fill

State changes move the fill *away* from the text's luminance, so contrast holds or
improves; a state can never fail if the resting pair passes.

**Button** — two pairings:
- Fill **or** border against the surface at 3:1 (whichever is stronger — a button
  delineated by its fill needs no border, and vice versa)
- Label against the fill at 4.5:1

**Tag** (4.5:1) — `--Tag-<pal>-Text` against `--Tag-<pal>-BG`.

---

## Deliberate exclusions

Not every token carries a contrast burden. These are excluded by design, not
oversight:

- **`--Border-Variant`** — decorative hairline at 20% alpha. It composites to
  within 3:1 of its background in every context by construction, which is correct
  for decoration and is why it must never be the token that delineates a control.
- **`--Icons-*-Variant`** — decorative alternates carrying no information.
- **Tag fill vs surface** — a tag is not a control and its boundary carries no
  meaning; only its label must be legible on it.

---

## Beyond colour

The accessibility report also validates:

- **24×24px minimum target area** on every interactive component
- **Alt text** presence on images
- Both checked in light and dark mode

---

## Why the pairing matters more than the count

A high number of passing checks means nothing if a check compares the wrong two
colours. Two examples from real regressions:

- Measuring `--Icons-On-<pal>` against the *background* instead of its icon
  compared two near-identical light values and reported 1.02:1 — a meaningless
  failure. Against the correct reference, all 2,778 pass.
- Scoring a button as `max(fill, border)` is correct for identifying a control,
  but it means a strong fill can mask a border that has drifted. Button borders
  are therefore also measured in isolation when that property matters — e.g. a
  slider handle, where the fill is the only thing identifying the control.

The same applies to Figma↔CSS parity: a "100%" run proves nothing about roles the
comparison does not include.

---

## The tone blind spot (closed 2026-08-19)

Counting contexts hid a second, sharper version of the same problem: the
enumeration was complete in *themes* and *surface scopes*, and incomplete in
**tones**.

A theme's surface is painted at the tone the user's colour extracted to. So for
any one brand, only a handful of the twelve tones are ever exercised — a Primary
theme on a `#7b3f9d` brand sits at tone 5, and nothing in the run ever placed a
surface at tone 7 or 8. The in-app report had the same shape from the other
direction: its four background choices (White, Black, Primary Light, Primary
Vibrant) reach tones 1, 11, 12 and Vibrant, and the derived Dim/Bright/Container
levels land near them. **Tones 5–9 were never checked by either.**

What that hid: `Border.Surfaces.<palette>.Color-7` and `.Color-8` both pointed at
`Color-5`, which measures **2.18:1** against a saturated blue surface and 2.91:1
on the deep purple the suite actually used — against a 3:1 requirement. It
shipped in the CSS bundle and the Figma payload while every run reported 100%.

**The close:** `buildAccessibilityReport` now adds a themed-surface pass —
Primary, Secondary and Tertiary at all twelve tones, in both modes. Each of those
surfaces still sweeps all eight palettes' borders and text, so the full
(palette × tone) matrix is covered. Per brand: 64 → **136 sections**, 6,336 →
**13,464 checks**.

Verified by putting the broken mapping back: the report flags it at 2.91:1.
A coverage fix that cannot fail on the bug it was written for is not a fix.

---

## The role blind spot (closed 2026-08-19)

The same question — *what does the count vary over?* — has a third answer:
**palettes**, and it was wrong for four roles.

`Text` and `Header` swept all eight palettes. `Quiet`, `Eyebrow` and `Border`
each read exactly **one** entry — the one matching the surface's own palette —
even though all three ship a full eight-palette table. A themed zone can put any
palette's Quiet, Eyebrow or Border on any surface, so seven of eight were never
measured. `Hotlink-Visited` was not checked **at all**.

What changed:

| Role | Before | Now |
| --- | --- | --- |
| Quiet | 1 palette | all 8, × resting/hover/pressed |
| Eyebrow | 1 palette, filed under Text | all 8, own **Eyebrow** category |
| Border | 1 palette, filed under Input as "Input Border" | all 8, own **Border** category, × resting/hover/pressed |
| Hotlink | Info palette (correct token — `--Hotlink` resolves to `{Text.Surfaces.Info.Color-N}`) | unchanged |
| Hotlink-Visited | **not checked** | `{Text.Surfaces.Hotlink-Visited.Color-N}`, 4.5:1, × all states |

Border is now measured against the hover and pressed surface scrims as well as
the resting background: a bordered input on a hovered row sits on the scrim, not
on the resting colour. `Border-Variant` is still deliberately absent — it is
decorative and carries no contrast requirement.

Eyebrow is read from the `Eyebrows` table rather than assumed to match Text,
because the table encodes a rotation (Primary → Secondary, Secondary → Tertiary,
Tertiary/Neutral → Primary, state palettes → BW). Verified that
`Eyebrows.Surfaces.Primary.Color-N` and `Themes.Primary.Surfaces.Eyebrow` resolve
to the same token.

---

## Current measured coverage

Six brands, **141,984 checks, zero failures**. Per brand: **136 sections,
23,664 checks**.

| Category | Checks | Worst measured | Threshold |
| --- | ---: | ---: | ---: |
| Text (incl. Quiet, Hotlink, Visited) | 48,960 | 4.64:1 | 4.5:1 |
| Button (incl. borders) | 29,376 | 4.01:1 | 3:1 / 4.5:1 |
| Eyebrow | 22,032 | 5.50:1 | 4.5:1 |
| Border | 19,584 | 4.01:1 | 3:1 |
| Header | 19,584 | 3.95:1 | 3:1 |
| Input | 1,632 | 3.04:1 | 3:1 |
| Focus | 816 | 3.04:1 | 3:1 |

`Focus-Visible.Surfaces.Background-7` at **3.04:1** is the thinnest margin in the
system. It passes, and a narrow pass is a pass — the threshold is the
requirement, not a floor to clear by some margin. Do not "improve" a compliant
value: the focus tables are hand-tuned per Background-N, and padding one to buy
headroom moves a colour the design intends.

### The general rule

Ask what a count *varies over*, not how large it is. Three axes, three holes:
themes and surface scopes were enumerated, but **tones** were inherited from one
brand's extracted colour, **palettes** were pinned to the surface's own for four
roles, and one role (`Hotlink-Visited`) was absent entirely. Each looked like
coverage because it was multiplied by the axes that *were* complete.

The check that matters: for every role the system ships, name the axis it varies
over and confirm the report varies over it too.
