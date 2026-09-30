# Figma ↔ code parity

**The file.** The component library this document compares against is
`Qv2dqF7mYoAGY77EkdrwTv` — *Omni-Designs-Aug12*.

Stated because there is a second, older file, `ycUFfME6PNi0TFoQJYwl4l`
(*Omni-Designs*), which `src/utils/figmaFixtures.ts` legitimately points at for
a workbench fixture. For a while that was the only Figma URL anywhere in the
repo, so anything looking for "the file key" found the wrong one. The two are
easy to confuse — both have a Fab page and their node ids share a numbering
space — so a query against the older file returns plausible answers instead of
an error. It has no `Menu-Levels`, `Buttons` or `Icons & Avatars` collection at
all, which is the quickest way to tell them apart.

Started 2026-09-28, once the dead-binding campaign closed and the existence
gaps were down to two empty pages.

Parity is four different comparisons, and only the first is a list of names:

| Layer | Question |
| --- | --- |
| **Existence** | does every lib component have a Figma component, and vice versa |
| **Mechanism** | do the two express the same axis the same WAY |
| **Surface** | do the axes carry the same options |
| **Values** | do those options resolve to the same numbers |

Most of the work so far has been at layer 1. This document is mostly about
layer 2, because that is where the real answer lives and it is not what anyone
expects going in.

---

## The headline: size and colour are MODES in Figma and PROPS in the lib

The lib documents `SIZES: small | medium | large` on nearly every component —
Alert, Autocomplete, Breadcrumbs, Card, Checkbox, Chip, Dialog, Drawer, Fab,
Modal, NumberField, Pagination, Select, Slider, Snackbar, Stepper, Switch,
Table, Tabs, Tooltip, ToggleButtonGroup, and more. It documents
`COLORS: default | primary | … | error` on nearly every one too.

Figma expresses **neither as a variant axis**.

Sampled across the file, the components carrying a `Size` variant are:

```
Divider        Size: [small]        one option
Progress Bar   Size: [Large]        one option
Progress Dial  Size: [Large]        one option
```

All three are single-option axes — section 8 of the component audit lists them
as dead weight. So **no Figma component has a working Size axis.** Size is
carried entirely by the `Component-Size` collection: 3 modes, 133 variables,
selected by pinning a mode rather than by choosing a variant.

Colour is the same shape. Only three components carry a palette axis at all —
`Snackbar` (9), `Tag` (8), `Alert` (4) — and everything else inherits through
`data-theme`, which is exactly what CLAUDE.md prescribes.

**This is not a defect.** It is the right design on both sides:

- A mode is the correct Figma mechanism, because a card and every control
  inside it must resize together. A per-instance Size prop on each nested
  component would let them disagree.
- A prop is the correct React mechanism, because a page can hold a small button
  beside a large one and React has no ambient mode to read.

But it means **parity can never be a name-for-name match**, and any check that
compares axis lists will report ~40 false gaps on the first run.

### What it means for the converter

When the converter reads a Figma component it CANNOT learn the size from the
instance's variant selection, because there is no size variant. It has to read
`explicitVariableModes` for the `Component-Size` collection — on the instance,
or on the nearest ancestor that pins one, or fall back to the collection
default.

Same for colour: read `data-theme` from the nearest ancestor that sets it.

A converter that only reads variant properties will emit every component at the
default size, in the default palette, and be silently wrong on every screen
that pinned a mode.

---

## Where the two genuinely agree

The components whose axes match well are the ones where STATE is the point,
because states are variants on both sides:

```
Checkbox   Figma State ×5 + Checked ×3      lib STATES checked|unchecked|indeterminate|disabled
Switch     Figma State ×5 + Status ×2       lib STATES checked|unchecked|disabled|hover|active|focus
Link       Figma State ×5                   lib STATES hover|visited
Steps      Figma Orientation + Status + State   lib ORIENTATION + COLORS + SIZES
Divider    Figma Orientation                lib ORIENTATION horizontal|vertical
```

Orientation is a real variant on both sides in every case, which is the useful
counter-example: an axis that is a variant in Figma AND a prop in the lib works
without translation.

---

## Real gaps, after discounting size and colour

- [ ] **`Snackbar` — `variant: solid | light`.** The lib has two surfaces
      (`Surface` vs `Surface-Brightest`); Figma has one. Decided 2026-09-28 to
      drop `solid` from the lib rather than add it to Figma: the colour lives
      in the border and icon while the text sits on a reliable background, so
      there are 9 combinations to trust instead of 18 to verify.
- [x] **`Snackbar` — `anchor: top | bottom`.** Now expressed as the separate
      `Snackbar` placement shell with `Alignment: [Top, Bottom]`, wrapping the
      `Snack` chip. That is the right split — position is a property of the
      screen, not of the chip. The `Alignement` misspelling was fixed
      2026-09-28.

      **What the fix leaves behind is a name, not a typo.** Figma calls the
      property `Alignment`; the lib's prop is `anchor`. A Figma property and a
      React prop are allowed to differ — `Component-Size` already maps to
      `size` — but this particular difference buys nothing, and every unmapped
      pair is one more thing a deterministic converter has to be told rather
      than derive.

      Worth one more rename, and the direction is Figma's, for two reasons.
      `anchor` ships publicly from the lib, so renaming that side breaks
      consumers while renaming a Figma property breaks nothing. And `anchor`
      is the more accurate word: alignment is where something sits within its
      container's cross axis, whereas a snackbar pinned to the top or bottom
      of the viewport is anchored to an edge — which is also why MUI calls its
      equivalent `anchorOrigin`. Renaming the Figma property to `Anchor`
      leaves one name for one concept and no mapping entry to maintain.

      If it stays `Alignment`, the mapping needs a home: `figmaModeMapping.ts`
      covers MODE collections only, and a variant property is a different
      axis, so this would be the first entry in a component-property table
      rather than an addition to an existing one.
- [ ] **`Fab`** — Figma has `State` only. The lib documents COLORS and SIZES;
      colours inherit, sizes are the mode, so this may be complete already.
      Worth confirming rather than assuming.
- [ ] **`Avatar`** — Figma `Style: [Initials, Default, Photo]` is a CONTENT
      axis; the lib's is size and colour. Neither side has the other's, and
      the lib has no content axis at all.
- [ ] **`Tag`** — 8 themes where `Snackbar` has 9. Missing `Neutral`.

## Per-component table

Assembled from sweeps across 2026-09-26 to 09-28. **Freshness warning:** the
existence list in `figma-component-audit.md` section 10 had four components
marked missing that had already been built, so treat any row here as a claim to
re-read rather than a fact. Size and colour are omitted throughout — they are
modes in Figma and props in the lib, per the section above, and listing them
would show ~40 false gaps.

### Aligned — the axes that exist on both sides agree

| Component | Figma | Lib |
| --- | --- | --- |
| `Checkbox` | State ×5 · Checked ×3 | STATES checked/unchecked/indeterminate/disabled |
| `Switch` | State ×5 · Status ×2 · Icon | STATES checked/unchecked/disabled/hover/active/focus |
| `Link` | State ×5 | STATES hover/visited |
| `Divider` | Orientation ×2 | ORIENTATION horizontal/vertical |
| `Stepper` / `Steps` | Orientation · Style · Status · State | ORIENTATION horizontal/vertical |
| `Tabs` | Orientation ×3 · Tab: State ×5 · Selected | ORIENTATION horizontal/vertical |
| `Card` | Orientation ×2 · State ×6 · Selected | ORIENTATION vertical/horizontal · ELEVATION |
| `Buttons` | Type ×4 · Style ×3 · State ×5 · 4 decorators | VARIANTS · 4 decorator slots |
| `Alert` | Theme ×4 · Close · Body · Slot | COLORS (4 semantic used) |
| `Snackbar` | Theme ×9 + placement shell | COLORS ×9 · ANCHOR top/bottom |
| `Tag` | Theme ×9 | COLORS |
| `Tooltip` | Location ×4 | — |
| `Rating` / `Star` | State ×5 · Status ×3 | COLORS |
| `Radio` | State ×5 · Status ×2 | COLORS |
| `Fab` | State ×5 | COLORS |
| `Pagination` | State ×6 | COLORS |
| `Ratio` | Ratio ×21 · Image Placeholder | VARIANTS default/solid/light/dark |

### Figma has it, the lib does not

| Figma | Note |
| --- | --- |
| `Carousel Dot` | no lib Carousel at all |
| `Day Cell` (Date Picker) | no lib DatePicker |
| `Form Elements`, `Form-Label`, `Form-Helper`, `Message Icons` | lib has `StateMessage` only |
| `Status Bar` (10 sets) | device chrome — correct to have no lib component |
| `Image Placeholder`, `Brand` | board furniture, arguably correct |
| `Box` `Type: [default, border-radius]` | lib `Box` has no such prop |

### The lib has it, Figma does not

| Lib | Note |
| --- | --- |
| `Alert` `size` | modes cover it |
| `Autocomplete` | Dropdown's `type: searchable` is adjacent, not equal |
| `Chip` | Figma has `Tag` only — TWO lib components, ONE Figma component |
| `ToggleButtonGroup` | same: lib has it AND `ButtonGroup`, Figma has one Button Group |
| `CodeBlock`, `DropZone`, `Paper` | unverified |
| `Popover` | exists in the lib and portals, but is NOT exported from `src/index.js` |
| `Footer`, `Copyright`, `Sidebar`, `Toolbar`, `MainLayout`, `Showcase` | unverified |
| `BevelText`, `CurvedText`, `Gradient`, `Charts` | Data Visualization has one set (`Bar-Basic`) |

### Named differently — needs a converter mapping entry, or a rename

| Lib | Figma |
| --- | --- |
| `Stepper` | `Steps` |
| `Select` | `Dropdown` |
| `BottomNavigation` | `Nav-Bar` / `Nav Item` |
| `CircularProgress` | `Progress Dial` |
| `LinearProgress` | `Progress Bar` |
| `Snackbar` | `Snackbar` (set) wrapping `Snack` (chip) |
| `TextField` / `SearchField` / `NumberField` | one `Input` set + `Input Text Style` |
| `Menu` | `Drop Down Menu` + `Menu Item` — on two different pages |
| `Table` | `Table Header Row` + `Table Body Row` + `Data Table` |
| `SelectableCard` | `Card` with `State=Default` — NOT a separate component |

### Open surface gaps

- [ ] **`Avatar`** — Figma `Style: [Initials, Default, Photo]` vs the lib's four
      content states (photo / initials / custom icon / brand glyph). `Default`
      and `Photo` are ambiguous against each other, and a custom `icon` has no
      Figma option.
- [ ] **`Chip` vs `Tag`, `ButtonGroup` vs `ToggleButtonGroup`** — two lib
      components mapping to one Figma component each. A single Figma set cannot
      tell the converter which of two lib components to emit, so these are the
      two rows that block a deterministic mapping.
- [ ] **`Box`** — Figma carries a `Type` the lib has no prop for.

## Still to check

The sample above covers roughly a third of the file. The remaining pages need
the same read before this document can claim to be complete, and the existence
list in `figma-component-audit.md` section 10 has already proved that a stale
row is worse than a missing one.

- [ ] Finish the per-component surface comparison
- [ ] `Hero` and `Player` — pages exist, empty, no lib component either.
      Planned or delete?
- [ ] `Popover` — exists in the lib and portals correctly, but is not exported
      from `src/index.js`, so the import fails. A lib gap, not a Figma one.

## Closed: device chrome now reaches every export surface

`deviceChrome.ts` computed `SnackBar-Top` / `SnackBar-Bottom` /
`Overlay-Clearance` per device, had its own passing test suite, and emitted to
the Figma payload and to **nothing else**. Neither the generated CSS nor the
design-token JSON carried them, so the value existed in three places that
mattered and shipped to one.

This is invariant 5 in the form it usually takes. The invariant is written
about two sides *diverging*, and the more common failure is one side being
absent: a custom property that was never declared resolves to nothing, paints
nothing and reports nothing, exactly like an unresolved `var()`. Every test
passed, because every test asked the payload.

What changed:

| Surface | Before | Now |
| --- | --- | --- |
| Figma payload (7 device modes) | ✅ | ✅ unchanged |
| `foundation.css` (4 platform blocks) | ✗ absent | ✅ `overlayOffsetCSS()` |
| `designSystemJSON.Platform` (4 platforms) | ✗ absent | ✅ `overlayOffsetTokens()` |
| lib `Snackbar` | `top: 16px` hardcoded | reads `var(--SnackBar-Top, 24px)` |

Three things are worth keeping in mind about the shape of the fix:

**The seven device modes collapse to four platform blocks, and the collapse is
checked rather than assumed.** It is lossless today — both iPad orientations
reserve the same chrome, and Android's phone and tablet both sit at 88/24 — but
that is a fact about the current numbers, not a guarantee. If Android tablets
ever take a different gesture bar from Android phones, one
`[data-platform="Android"]` block can no longer say what both devices need.
`platformOverlayOffsets()` throws in that case, naming both devices and the
value they differ on, because the fix is a real decision (split the block, or
accept the coarser value) and not something a generator should make quietly.

**The lib's fallback is the Desktop value, not a smaller "safe" one.** Nothing
in the library defines these variables, so `var(--SnackBar-Top, 24px)` falls
through for any consumer without a generated `foundation.css` — which makes the
fallback the library's real default. A library default that contradicts its own
design system's answer for a chrome-less device is a second source of truth
wearing a fallback's clothes.

**The `16px` was invisible in the only place anyone looked.** A snackbar
16px from the top of a desktop browser looks right. It is wrong on every touch
platform — 98px of iPhone status bar and app bar sit under it — and the
component was reviewed on a desktop. Worth remembering when the Adaptive-
Navigation templates land: a fixed offset against a screen edge is a device
question, and a desktop browser cannot answer it.

Guarded by `src/__tests__/deviceChrome.test.ts` (12 tests, one of which walks
every device to the platform block it actually lands in — a per-platform
comparison would never notice a device mapped to the wrong block) and by the
`edge offset` suite in the lib's `Snackbar.test.js`, which reads the emotion
rule rather than `getComputedStyle`: jsdom drops any declaration containing
`var()`, so a computed-style assertion passes just as happily on a snackbar
with no offset at all.

Still open on Snackbar itself, from the component sweep: the `size` axis (the
lib's 13/14/16 tracks nothing in Figma), the shadow on `FAB/Hover`, and
`clipsContent: true` on both shells. The `Alignement` typo was fixed
2026-09-28; what it leaves is a naming question, recorded above.

## The thing worth automating

An existence-and-surface diff is about twenty lines against the Figma payload
and the lib's exports, and it would never go stale. Every finding in this
document was true on the day it was written and several were wrong a week
later — the section 10 existence list had four components marked missing that
had already been built.

Same conclusion the dead-binding campaign reached: the durable artefact is the
check, not the report.
