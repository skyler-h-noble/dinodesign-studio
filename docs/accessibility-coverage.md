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
