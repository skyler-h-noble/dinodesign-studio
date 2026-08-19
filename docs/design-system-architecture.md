# Design System Architecture

How a brand becomes tokens, and the rules that must hold across CSS, Figma and
the studio preview. Read this before changing anything in `src/utils/cssgen/`,
`src/utils/generateFigmaJSON.ts`, or the Figma plugin.

For component usage rules see [CLAUDE.md](../CLAUDE.md). For the consumer-facing
token list see `node_modules/@dynodesign/components/docs/token-system.md`.

---

## The pipeline

```
user choices ─→ exportColorSystemToJSON()      the single source of truth
                        │
                        ├─→ generateCSSFiles()      base.css, Light-Mode.css, Dark-Mode.css
                        ├─→ generateFigmaJSON()     the Figma variable payload
                        └─→ buildPreviewCSS()       the studio's live preview
```

`buildPreviewCSS` is a **separate implementation**, not a consumer of the export.
That is the single largest source of bugs in this codebase: the two can diverge
silently because CSS fails invisibly — an unresolved `var()` paints nothing and
reports nothing. Every divergence found this year was preview-vs-export.

**Rule:** any change to button, surface or text colour must be made in both, and
covered by `src/__tests__/tokenParity.test.ts`.

---

## Output shapes

The same values take a different shape in each output. This is not accidental
and should not be "unified".

| | CSS | Figma |
|---|---|---|
| Indirection | preserved — `var(--X)` chains resolve at runtime | flattened to hex at export |
| Intermediates | real and load-bearing (e.g. `Color-Vibrant`, 990 refs) | absent — resolved away |
| Role selection | composed at runtime: `` var(`--Buttons-${C}-Button`) `` | a bound variable, so the role must be a mode or a variant |

That last row explains the Figma variant explosion. CSS can build a token name
from a prop; Figma cannot. So in Figma the role lives in a **mode**, and only
treatment and geometry stay component variants.

---

## Buttons

### Token shape

```
--Buttons-<Role>-Button      the fill
--Buttons-<Role>-Text        the label, computed against the fill
--Buttons-<Role>-Border      the fill (a solid button's edge is its own colour)
--Buttons-<Role>-Hover
--Buttons-<Role>-Pressed
--Buttons-<Role>-Highlight   bevel, RGB triplet — the lib wraps it in rgb()
--Buttons-<Role>-Lowlight    bevel, RGB triplet
```

Roles: `Default, Primary, Secondary, Tertiary, Neutral, Info, Success, Warning,
Error, BlackWhite`.

Highlight and Lowlight are **triplets, not hex**, because the lib composes
`rgb(var(--Buttons-<X>-Highlight))`. Emitting hex there silently kills the bevel.

### Tones

| | Light mode | Dark mode |
|---|---|---|
| Primary | the extracted tone (PC) | Light-Mode Color-8 |
| Secondary / Tertiary | SC / TC exactly | Light-Mode Color-8 |
| Neutral | Color-8 | Light-Mode Color-8 |
| States (Info/Success/Warning/Error) | **Color-5, fixed** | Light-Mode Color-8 |

Dark-mode buttons reach across the mode boundary and take **Light-Mode Color-8**
— the same value as `Color-Vibrant`. Measured: every palette lands 9.5–10.4:1
against its dark label.

**State buttons are pinned to Color-5 and must stay pinned.** The tone decides
the *label*, because the contrast logic follows the fill:

```
Color-5   white 7.2:1 ✓   black 2.8:1 ✗
Color-6   white 3.4:1 ✗   black 6.0:1 ✓
```

This was previously `PC >= 9 ? 6 : 5`, so an unrelated brand choice silently
flipped every error button between white-on-red and black-on-salmon.

### Button modes (the user's selection)

| Mode | Behaviour |
|---|---|
| `primary` / `secondary` | one palette on every surface |
| `tonal` | **surface-scoped** — the surface's own palette at its own tone |
| `laddered` | **surface-scoped** — one step round the rotation |
| `black-white` | black or white by surface tone |

Surface-scoped modes must produce a *different* fill per themed surface. A
single global palette constant cannot express this; it collapsed tonal onto
Primary everywhere while the preview varied correctly. Guarded by the per-theme
tests in `tokenParity.test.ts`.

### BlackWhite

A resolved table keyed by the **background's** tone:

```
Buttons/BlackWhite/<Color-1…12>/{Button,Text,Border,Hover,Pressed,Highlight,Lowlight}
```

White face on tones 1–5, black from 6 up. Keyed by tone alone — measured, all
nine palettes agree on the face at every tone in both modes, because the 12-tone
scale is fixed lightness values.

`Color-Vibrant` is deliberately absent: this table is indexed by a *background*
tone, and Vibrant is never a background — it is a button fill.

In CSS this is `<Button color="black-white">`, available on any theme and any
surface. Solid and outline only: `-light` reads `--<C>-Color-11`, and BlackWhite
is a resolved pair, not a palette.

---

## Tags

```
Tag.Light.<Palette>   Color-9   the PALE chip, used on DARK surfaces
Tag.Medium.<Palette>  Color-6   the darker chip, used on LIGHT surfaces
```

**The names are inverted from intuition** and the theme layer picks between them
per surface. Medium is fixed at Color-6 — it was brand-coupled, and at Color-5 a
Primary tag rendered the exact colour of the Primary button, so a label carried
the same weight as an action.

---

## Eyebrows

A brand-coloured label above a heading. Each background borrows the *next*
colour round the rotation so it does not vanish into its surface:

```
Neutral / Black / White  → Text-Primary
Primary                  → Text-Secondary
Secondary                → Text-Tertiary
Tertiary                 → Text-Primary
States                   → Text-BW  (black or white, whichever clears 4.5)
```

Emitted as `Modes/Eyebrows/{Surfaces,Containers}/<Background>/<Color-N>` and as
`--Eyebrow` in every theme block. Values are **references into `Text`**, never
copied hexes, so an eyebrow is the same colour as its text role by construction.

---

## Surfaces

`Surfaces-Dimmest` sits **two tones below the surface, clamped at Color-1**
(so tones 1–3 all land on 1). It must stay unrouted from `Default-Background`:
routing it moved the background to the Default surface's tone while buttons kept
their own borders, leaving a 1.47:1 border on a light surface.

---

## Figma collections

| Collection | Modes | Contents |
|---|---|---|
| `Modes` | Light-Mode, Dark-Mode | every raw token |
| `Theme` | Default, Primary, …, White, Light-Gray, Black | `<SurfaceGroup>/<role>/<slot>` |
| `State` | Info, Success, Warning, Error (+ -Light) | same, semantic backgrounds |
| `Surface` | Surface, Surface-Dim, …, Container-Highest | aliases into `Theme` |
| `State-Surface` | same | aliases into `State` |
| `Buttons-ThemeBackgrounds` | the 10 roles | 7 slots, aliases into `Surface` |
| `Buttons-StateBackgrounds` | the 10 roles | 7 slots, aliases into `State-Surface` |

**mode = colour, variant = treatment and geometry.** A button binds the seven
slots once; colour comes from the mode, while size, elevation and outline/ghost
stay component variants. This is what removes the colour axis from variant
counts.

Two button collections rather than one because a button on an Info background
must take its values from the State side, and a single collection cannot alias
both without the caller also getting the State mode right.

Every mode collection must be listed in the plugin's `AAID_MODE_COLLECTIONS`,
or the converter cannot tell which mode an instance is in — and a missing mode
reads as inherited, so it fails silently.

Mode counts are plan-limited (Professional is 4 per collection; Enterprise far
higher). `addMode` failures are logged rather than swallowed.

---

## Invariants

Each of these cost real damage. Do not relax one without re-running its check.

### Never flatten or prune the `Modes` collection without rewriting references

The Theme, State and Surface collections **alias into** `Modes` by name.
Flattening `Buttons/<Role>/<Shade>/<Slot>` to `Buttons/<Role>/<Slot>` broke
**6,084 of 13,701 references** — 44% — because the targets were renamed and
nothing repointed at them.

It is doable, but the rename and the reference rewrite must happen in the same
pass, and the unresolved-reference count must be counted before and after.
`generateFigmaJSON` does this and warns if the two diverge.

### A duplicated value is not necessarily redundant

The test is not "do the copies match" but **"does anything select between
them"**.

- `Buttons/<Role>/{Light,Medium}` held identical values — but the Theme layer
  *picked between them* per surface. Collapsing it destroyed a choice.
- `BlackWhite`'s palette and scope levels also held identical values, and
  **nothing** selected between them. Collapsing those was safe, and saved 2,400
  variables.

Same appearance, opposite answers.

### Tone changes are label changes

The contrast logic derives the label from the fill, so moving a fill one tone
can flip its text from white to near-black. Any tone change must be checked
against both.

### Hover/Pressed direction is decided by the LABEL, not the tone index

The state must move *away* from the text on it. Keying on the tone index is a
proxy that assumes every palette's text table flips at tone 6 — 23 of 24
palette/mode combinations do, and the exception took a 4.54:1 button to 2.17:1.
Keying on the fill's own luminance is worse again: a saturated mid-tone measures
"light" while carrying light text.

Both ends of the ramp invert (no headroom below black or above white), and
tone 1 moves only a HALF step because Color-1 → Color-2 is a tenfold luminance
change. Four implementations must agree: `staticTokenStructures` + the export
pass, `exportToCSS`, `buildPreviewCSS`, `generateFigmaJSON`.

### A locked colour is inserted verbatim — and must still pass

`generateScaledTones` writes the user's exact hex into the tone nearest its
lightness. The generated ramp never lands in the structural dead zone; this
override can, at the one tone the user controls.

The guard tests whether the colour can carry text from its **own ramp**, not
whether it falls in the dead-zone band. The band is the worst case at maximum
chroma: measured across 413 picks spanning 360 hues, 229 landed inside it and
**none of them failed**. Snapping on the band alone moves colours that work,
which breaks a more important promise — the user's colour is theirs.

When a colour genuinely cannot carry text, its lightness moves to the nearest
value that can, hue and chroma preserved, and the change is recorded on the
tone as `adjusted: { from, to, reason }` so the UI can tell the user. **No
failing contrast ships, and no silent alteration either.**

### Preview and export are separate implementations

Assert per-theme, not only at Brand scope. Tonal and primary produce the *same*
button at Brand scope and different ones everywhere else, which is exactly how
a real divergence survived a passing parity suite.

Parity alone is not enough: assert the intended *shape* independently, or both
sides can be wrong together and still agree.
