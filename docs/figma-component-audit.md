# Figma ↔ lib component audit

Swept 2026-09-26: all 54 pages of the DinoDesign library file
(`Qv2dqF7mYoAGY77EkdrwTv`), every `COMPONENT_SET`, plus the lib's own
`src/components/` listing. 71 sets found.

This is a checklist, not a report — tick items off in place.

`loadAllPagesAsync` is not available in this plugin environment, and one
`use_figma` call may switch pages only once, so the sweep was run as parallel
per-page calls. Re-running it means fanning out again, not looping.

**The canonical state vocabulary** — set by `Buttons` and `Switch`, which are
both now correct:

```
Default · Hover · Pressed · Focus-Visible · Disabled
```

Five values, that spelling, that capitalisation. Everything below is measured
against it. Selection is a SEPARATE axis, never a sixth state.

---

## 0. Dead token bindings — CLOSED 2026-09-28

A defect class none of the sections below could see, found by accident while
checking something else, and cleared across the file.

### What a dead binding is

A binding whose variable still RESOLVES but whose **collection no longer
exists**. Figma shows the layer as correctly bound, the swatch reads right in
the panel, and the value never tracks the brand again. It is invariant 1 seen
from the component side rather than the payload side: a collection was
restructured and the references into it were not rewritten in the same pass, so
every one survived as a ghost.

The test is not "does the variable resolve" — it does. The test is whether its
collection is still one of the file's local collections.

### Scale

`Buttons` alone carried ~190 with no visual symptom whatsoever. About 3,400
bindings were repointed in total. Concentrations were wildly uneven because
they multiply by variant count and by style reuse — one broken text style on 36
letterNumber segments reads as 144 findings, not 1.

```
Data Tables  1451 -> 0     Button Group 393 -> 0     Slider  365 -> 0
Carousel      204 -> 0     Rail         183 -> 0     Nav-Bar 179 -> 0
Dropdown      160 -> 0     Card         107 -> 0     Breadcrumbs 89 -> 0
Tabs           73 -> 0     Input         43 -> 0     Forms    34 -> 0
Buttons      ~190 -> 0     plus Accordian, Box, Checkbox, Radio, Rating,
                           List, Modal, Number Field
```

### The generations found

The dead names are archaeology — each is a superseded architecture:

```
Button-Height (bare)              pre-Component-Size
Typography/Labels/Extra-Small/*   the old typography tree
Typography/Body/Small/*           same
Font-Families/*                   before families moved into their groups
Spacing/Spacing-N                 three spacing generations living at once,
core-spacing/spacing-N              with core- and system- prefixed siblings
system/spacing-N
Drop-Shadows/* Inner-Shadows/*    the old elevation set (~900 in Data Tables)
Minimum Target, Focus-Border      one-offs with no live successor at all
```

Most map 1:1 onto a live name once the pattern is visible —
`Spacing/Spacing-2` to `Sizing::Sizing-2`,
`Typography/Labels/Extra-Small/Character-Spacing` to
`Labels/Label-Small-Letter-Spacing`.

### Rules that came out of it

**Rebind, never clear.** Clearing a dead binding leaves a hardcoded literal,
which is the same failure wearing different clothes — the value stops tracking
the brand either way.

**Split "ships" from "board furniture" before reading any count.** Loose frames,
`✏️` annotations and the COMPONENT_SET container itself never reach an
instance; a set's own padding only spaces the variants inside the purple box.
Button Group looked like 393 and was 372 real plus 21 furniture.

**Orphaned text STYLES are a separate category, and a variable scan cannot see
them.** A style whose id is not among the local styles carries its own dead
bindings into every node using it. Only `Data Tables` had them — 76 nodes
across 6 styles, worth ~456 of its 1,451, fixed by reassigning nodes rather
than rebinding variables. The tell is in the id: a local style's ends at the
comma (`S:f96f34e1…,`), an orphaned one carries a node id after it
(`S:7db60897…,3193:2281`).

**Some dead variables have no successor.** `Focus-Border` was a stroke WIDTH,
and the file has focus *radii* for every component and no focus width at all —
so the ring thickness is a hand-typed literal on `Carousel` (2), `Field Button`
(3) and `Card` (3). Generating a `Focus-Border-Width` would close all three.
Recorded here because "rebind it" was not available and the gap is real.

### The plugin

`figma-plugin/dead-token-audit/` — scans page, file or selection, reports the
three kinds, splits ships from furniture, click-to-select, copy-report.

Built because this is not a one-off: every dead binding in this file was once
correct, so it will happen again the next time a collection is restructured.
Two bugs found while writing it are worth remembering, because both understate
the problem rather than overstate it:

- `page.findAll()` already includes the page's children, so
  `findAll().concat(page.children)` double-counts everything at page level.
  Radio reported 4 when it had 1.
- Instance sublayers (ids shaped `I<inst>;<comp>;<node>`) are materialised on
  demand and can be collected mid-scan; reading any property then throws. The
  plugin skips and COUNTS them — a silent skip lowers the total, which is wrong
  in the reassuring direction, the same shape as the bug it exists to find.

## 1. Duplicate variant combinations — CLOSED 2026-09-27

All four sets that were throwing on `componentPropertyDefinitions` now read
cleanly AND are complete. Kept for the failure mode, which is worth
recognising next time: in every one of the four, a variant meant to be one
state had been left on `Default`. That duplicates one value and deletes another
in a single move, and deduping recovers the schema without refilling the hole —
so a set can stop erroring while still being short.

- [x] **`Input`** — 15/15 (3 Types x 5 States). Gained an `Input Buttons`
      BOOLEAN and an `Input Button Slot` SLOT.
- [x] **`Field Button`** — 10/10. Fixed 2026-09-27 by renaming the four variants
      stranded on `Increment3/4/5` to `Up`.
- [x] **`Slider-thumb Vertical`** — 10/10, and the states have since been
      capitalised. One character left: `Focus-visible`, see section 4.
- [x] **`Button-Group-Segments`** — **108/108**, no missing combinations.
      3 Positions x 2 Styles x 3 Types x 6 States, all present.

## 1b. `Field Button` — CLOSED 2026-09-27

The up/down stepper inside a Number Field's right edge. `Increments` is a
VERTICAL frame holding `Field Button` / `Divider` / `Field Button`.

Geometry matches the lib and should be left alone: Figma 32x24 with
`Icon/Medium/Filled`, lib `width: var(--Sizing-4, 32px)`,
`height: var(--Sizing-3, 24px)`, `<Icon size="medium">`
(`~/DinoDesign/src/components/NumberField/NumberField.js:432,440`).

- [x] **Focus rings on, and identical across both variants.** Each is a child of
      `Button-Container` at index 0, `ABSOLUTE`, rotation 0, 30x22, stroke 3
      bound to `Focus-Visible`, radius 0, inset 1,1. Rings exist only on the two
      Focus-Visible variants.
- [x] **Radius is 0 by decision, and unbound.** The stepper does NOT use
      `Button-Icon-Radius` or `Button-Icon-Focus-Radius`; all radii in the set
      are literal 0. Same reasoning as `Menu-Item-Radius`: the button sits flush
      inside the field's border, so a radius there draws a curve inside the
      field's own curve.

      **Consequence for the generator:** `Input-Button-Radius-{S,M,L}` and
      `Input-Button-Focus-Radius-{S,M,L}` (`src/utils/inputMetrics.ts`) serve
      `Input Buttons` — the ghost text/iconOnly pair, a pill at 22 on Desktop —
      and NOT the stepper. Nothing in `Field Button` reads them. Worth a comment
      in that file saying which component each variable is for, because the
      names do not distinguish them.
- [x] Figma and the lib AGREE on focus geometry — both inset. `NumberField.js:250`
      ("FOCUS is an INSET border, not an offset outline") is the same decision.
      An earlier draft of this document claimed a three-way conflict; there was
      none.

### Three inspection gotchas, recorded so they do not cost time twice

Each of these produced a confident wrong reading during this pass.

1. **`boundVariables.strokes` is an ARRAY of aliases, not a single alias.** A
   helper that does `b.id` returns null for a binding that is present, which
   reads as "the binding was lost". Always `Array.isArray(b) ? b : [b]`.
   Radius corners ARE single aliases, so the same helper is right for those —
   which is what made the bug look like a real finding.

2. **`absoluteBoundingBox` is stale straight after a mutation in the same
   call.** Verify geometry in a SEPARATE, read-only `use_figma` call, or the
   number reported is the one from before the edit.

3. **`x` / `y` on a ROTATED node is the translation of the rotated origin, not
   the visual top-left.** The Down ring was rotated 180 degrees (the button is
   the Up one flipped), so its `x,y` read `31,23` while it rendered correctly at
   `1,1` — `1+30` and `1+22`. Setting `x`/`y` then appears to do nothing.
   Check `rotation` or `relativeTransform` before trusting `x`/`y`, and prefer
   `absoluteBoundingBox` deltas for "where is this actually".

   For a symmetric rectangle with radius 0 and a uniform stroke, 180 degrees is
   a visual no-op, which is why it survived — it would have surfaced the moment
   the ring got a non-uniform radius or stroke.

### Still open

- [ ] **`NumberField` itself is not a component.** The page has one component
      set (`Field Button`) and one top-level `Divider` frame, so there is
      nowhere to put `Variant: [outlined, spinner]`.
- [ ] **The `spinner` variant has no Figma component.** The lib defines two
      (`NumberField.js:20-21`): `outlined` (up/down chevrons inside the right
      edge) and `spinner` (standalone minus/plus flanking a centred number).
      Only `outlined` exists in Figma. The spinner's buttons are square at
      `btnSize` 28/36/44 with `<Icon size="small">` and `Remove`/`Add` icons —
      a different ladder from the button heights (32/44/56), so they are not
      icon-only `Button` instances and need their own component with a `Size`
      axis.

      Model these as TWO button components rather than four values on one
      `Increment` axis. Up/Down are fixed at 32x24; Plus/Minus are square and
      scale, so one axis would need a `Size` dimension meaningless for Up and
      Down — a matrix with holes. This refines the rule in section 5b: mutual
      exclusivity belongs in one axis WHEN THE VALUES SHARE A STRUCTURE.
      Otherwise the exclusivity lives one level up, in the parent's variant.
- [ ] **Count the in-field buttons before adding a third.** `Input Buttons`
      (ghost text/iconOnly), `Field Button` (chevrons) and a spinner button
      would be three. Defensible if each maps to a distinct lib layout — but
      write down which is which.
- [ ] `Increments` is `primaryAxisSizingMode: FIXED` at 53 with zero padding and
      children summing to 48. The lib's floor is
      `calc(var(--Sizing-3) * 2 + 1px)` = 49.

## 1c. Number Field — resolved 2026-09-27

`Number Field` is now a standalone COMPONENT (`8140:7120`) wired to
Component-Size: `Input/Input-Radius`, `Input/Input-Padding`,
`Dynamic-Typography/Dynamic-Body-*` and the stepper instances all resolve
through the Component-Size -> Devices-Type chain. The Dynamic-Body twins are
doing exactly the job they were added for.

### The model: square steppers at Button-Height

**Figma is the source of truth here. Decided 2026-09-27.**

The stepper is SQUARE at the brand's button height — `width`, `height` and
`minWidth` all bound to `Component-Size::Button/Button-Height`, which resolves
24 / 32 / 56 on Desktop for this brand. Two stacked, plus a 1px divider and 1px
padding each side, so:

```
Number Field height = 2 x Button-Height + 3
Increments width    = Button-Height + 2
```

| mode | stepper | Increments | Number frame | field |
| --- | --- | --- | --- | --- |
| small | 24x24 | 26 x 51 | 37 | **51** |
| medium | 32x32 | 34 x 67 | 48 | **67** |
| large | 56x56 | 58 x 115 | 59 | **115** |

A Number Field is therefore about double a plain input at every size, which is
a consistent rule across brands rather than a per-brand surprise.

`Frame 1` is HORIZONTAL with `counterAxisSizingMode: AUTO`, so its height is
`max(Number, Increments)` — the same thing the lib spells as
`minHeight: max(sc.height, ...)` (`NumberField.js:336`), expressed as layout
rather than a variable. `Increments` hugs its content.

**Worth knowing when Figma "cannot do arithmetic": check whether auto-layout
already does it.** Two candidates in this component would otherwise have needed
21 generated values each, across seven devices and three sizes.

#### The one guard this model needs

Targets pass WCAG 2.5.8 at all three sizes — but small lands on **exactly 24**,
the floor itself, with no margin. Any brand that picks a small button height
below 24 puts the stepper under the minimum, and nothing reports it.

- [ ] Consider an explicit `minHeight`/`minWidth` of 24 on the stepper instances
      so a short brand height cannot breach the floor. This does not change any
      value above — at 24/32/56 the guard never fires.
- [ ] **The two stepper instances currently differ**: one has no min constraints,
      the other has `minWidth: 32`. Same component, same stack — even them up.

### ACCEPTED DIVERGENCE: the lib holds the stepper at a constant 24

Decided 2026-09-27: the two sides may disagree here.

- Figma: stepper square at Button-Height -> field **51 / 67 / 115**
- Lib: stepper constant `var(--Sizing-3, 24px)` (`NumberField.js:432`),
  stack 49 -> field **49 / 49 / 56**

The lib's value is constant because 24 is the WCAG floor; Figma's scales with
the brand and clears the floor by construction. Both are defensible, they simply
differ, and Figma is what this project follows.

Recorded because an undocumented divergence is indistinguishable from a defect
to whoever reads it next, including the converter — which will emit a stepper
that does not match the design unless told otherwise. Note this runs against the
usual rule that lib values get fixed to match the design; an exception, not the
new default.

### Input-Padding: one variable doing two jobs

`Input/Input-Padding` (8 / 12 / 16) is bound to all FOUR sides. The lib keeps
them separate — `'4px 8px'`, `'6px 12px'`, `'8px 16px'` — so 8/12/16 is the
HORIZONTAL value and applying it vertically is what inflates the Number frame
to 37/48/59 instead of the button heights 24/32/56.

Deriving the vertical value does not work either. `(Button-Height - body
leading) / 2` gives **1.5 / 4 / 14.5** on Desktop, because the brand's height
ladder steps 24->32->56 while the type ramp steps 21->24->27. Any brand whose
heights are unrelated to the type ramp gets the same swing. `Input-Padding` is
also a plain number per size while `Button-Height` aliases into Devices-Type,
so deriving one from the other would force 21 new device-aware values.

- [ ] **Centre the text in a fixed-height field instead.** Bind the field height
      to `Button-Height`, vertical padding 0, text centred — layout distributes
      the remainder at any height, on any device, for any brand. This is already
      how the lib behaves: with an explicit `height` set, its vertical padding
      does not affect layout, so its 4/6/8 are effectively decorative.
- [ ] **Check the plain `Input` for the same problem.** It almost certainly binds
      `Input-Padding` to all four sides too, and unlike NumberField it has no
      stepper stack to hide the inflation — so a plain input may simply be
      taller than a button at every size.
- [ ] An earlier note here claimed the generator's `Input-Padding: 4` was wrong
      and Figma's 12 was right, then the reverse. Neither is settled until the
      above is: 4 is right as a derived VERTICAL value, 8/12/16 is right as the
      HORIZONTAL one, and the generator emits a single number for both.

### Still open

- [ ] **The `spinner` variant has no Figma component,** and `Number Field` has no
      `Variant: [outlined, spinner]` axis. The spinner's buttons are square at
      `btnSize` 28/36/44 with `<Icon size="small">` and `Remove`/`Add` — a
      different ladder from the button heights, so they are not icon-only
      `Button` instances and need their own component.

      Model as TWO button components, not four values on one `Increment` axis:
      Up/Down are fixed, Plus/Minus scale, so one axis would need a `Size`
      dimension meaningless for half its values. This refines section 5b —
      mutual exclusivity belongs in one axis WHEN THE VALUES SHARE A STRUCTURE.
- [ ] Count the in-field buttons before adding a third: `Input Buttons`,
      `Field Button`, spinner. Defensible if each maps to a distinct lib layout;
      write down which is which.

## 2. Placeholder variant VALUES — CLOSED 2026-09-27

Figma names an unnamed variant after its property plus an index, and four of
those auto-names had reached the converter as literal strings. All named now:

- [x] `Card Content / Ecommerce` — `Type6` → `persona card - floating avatar`
- [x] `Message Icons` (Forms) — `Notification5/6` → `success` / `warning`
- [x] `Link` — `State5` → `Focus-Visible`, so Link has all five states
- [x] `Pagination Number` — `Variant7` → `Focus-Visible` (the PROPERTY is still
      `Property 1`; that is section 3)

`Input Message` was lowercased to `[error, success, warning, info]` in the same
pass, which makes it agree with `Message Icons` — the two halves of the same
concept now share one vocabulary.

## 3. `Property 1` — the placeholder property NAME

Twelve sets still carry Figma's default property name. Nine of them have a
single option, `[Default]`, which means they are not variant sets at all — a
one-variant set with no axis should be a plain component.

Single option, should be a plain `COMPONENT`:

- [ ] `Checkbox Group` (Checkbox)
- [ ] `Table Header Row` (Data Tables)
- [ ] `Drop Down Menu` (Dropdown)
- [ ] `Form-Label` (Forms)
- [ ] `Form-Helper` (Forms)
- [ ] `Sheet` (Sheet)
- [ ] `Tree View` (Tree View)
- [ ] `Brand` (Brand)
- [ ] `Image Placeholder` (Image Place Holder)

Real axis, just unnamed — rename the property:

- [ ] `App-Bar` → `[Left brand, Center Brand, Title App Bar]`. Name it `Style`
      or `Type`, and fix the casing: `Left brand` vs `Center Brand`.
- [ ] `Loader` → `[1, 2, 3, 4]`. Numbers are not names.
- [ ] `Status-Bar-Lower` → `[Small, Large]`. This is `Size`.
- [ ] `Pagination Number` → `[Default, Hover, Pressed, Selected, Disabled,
      Variant7]`. This is `State` (plus a selection axis, see item 6).

## 4. Typos

Each of these is a string the converter matches on, so a typo is a silent miss,
not an error.

**Fixed 2026-09-27:** `Requied` → `Required` (`Form-Label`) · `Succes` →
`success` (`Input Message`) · `Focus-Visiible` and `Disable`
(`Slider-thumb Horizontal`) · `Focus-visible` → `Focus-Visible` on all three of
`Slider-thumb Vertical`, `Accordion Segment` and `Day Cell` · `Direction: own`
→ `down` (`Speed Dial`).

Still open. Note the shape of the remaining four: each is a word that was
RETYPED and came out wrong a second time, which is why they survived a pass that
fixed everything around them. A rename is worth reading back character by
character, or scripting.

- [ ] **`Breadcrumbs-separator` → `elipsis` is now `ellipse`, which is a
      different word.** An ellipsis (`…`) is the three-dot truncation mark; an
      ellipse is an oval. The intended value is **`ellipsis`**.
- [ ] **`Menu Item` (Tree View) → `Focus-Visble`** — the states were correctly
      capitalised in this pass, but this one is still missing its `i`.
      Should be **`Focus-Visible`**.
- [ ] **`Tab` (Tabs) → `Disabeld`** — untouched across three passes now. This is
      the last remaining misspelling in the canonical five-state vocabulary.
- [ ] `Ratio - Fill Vertical` → `Golden Vertical` (space) where its sibling
      `Ratio - Fill Horizontal` has `Golden-Vertical` (hyphen). Untouched.
- [ ] Page name **`Accordian`** → `Accordion`. The components inside are spelled
      correctly; only the page is wrong.

## 5. State vocabulary

Canonical, set by `Buttons` and `Switch`:
`Default` · `Hover` · `Pressed` · `Focus-Visible` · `Disabled`

Conforming: `Buttons` `Switch` `Radio` `Checkbox` `Input` `Input Buttons`
`Field Button` `Star` `Count Step` `Link` `Slider-thumb Horizontal`
`Slider-thumb Vertical` `Accordion Segment` `Day Cell`
`Button-Group-Segments` `Seperated Button Segments`

**Fixed 2026-09-27:** `Slider-thumb Vertical` (was all lowercase),
`Accordion Segment`, `Day Cell`, `Link`.

Partly fixed — each is now one value short of conforming:

- [ ] **`Card`** — `[Non-Clickable, Hover, default, Pressed, Focus-Visible,
      Disabled]`. Five of six capitalised; **`default` is still lowercase**.
      (`Non-Clickable` belonging in `State` at all is section 6, not a typo.)
- [ ] **`Speed Dial`** — `Direction` is fixed, the State axis is not. It still
      carries ten values for five concepts, and the variant list shows why: the
      `down` direction was rebuilt with the capitalised vocabulary while `up`,
      `left` and `right` were left on the lowercase one.

      ```
      Direction=down            → Default, Hover, Active, Focus-Visible, Disabled
      Direction=up|left|right   → default, hover, pressed, focus-visible, disabled
      ```

      20 variants = 4 x 5, so nothing is missing — the axis is just split across
      two spellings. Fixing it is renaming the 15 lowercase variants, after which
      the five duplicate options collapse on their own. Also `down` uses
      **`Active`** where the vocabulary says `Pressed`, so that one needs the
      rename too.

- [ ] **`Menu Item`** (Tree View) — capitalised in this pass, but
      `Focus-Visble` is still misspelled; see section 4.

Still using `Active` where the vocabulary says `Pressed`:

- [ ] `Carousel Dot`
- [ ] `List Item`
- [ ] `Speed Dial` (the `down` direction only)

Missing states entirely:

- [ ] `Nav Item` (Nav-Bar) — `State: [Default, Selected]`. No hover, pressed,
      focus or disabled on a component whose whole job is to be clicked, which
      breaks the all-states-on-clickables rule.

## 5b. Card: one component, not two — decided 2026-09-27

Asked whether `Card` should split into clickable and non-clickable components.
It should not, and the reasoning generalises.

**Figma cannot hide an invalid combination.** Give `clickable` its own axis — a
BOOLEAN, or a second component — and `Clickable=false, State=Hover` becomes
expressible and meaningless, with nothing to stop anyone picking it. Folded into
one axis, the nonsense is inexpressible: a card is either interactive with five
states or it is not, with one resting state, and those are mutually exclusive.

The rule, which cuts both ways:

| Relationship | Modelling |
| --- | --- |
| values can CO-OCCUR | SEPARATE axes |
| values are MUTUALLY EXCLUSIVE | SAME axis |

`Selected` + `Hover` co-occur, which is why cramming `Selected` into `State` on
`Button-Group-Segments` cost four variants — the author ran out of room in one
axis (section 1). `Non-Clickable` + `Hover` cannot co-occur. So `Card` was right
and the Button Group was the error.

The code agrees: one `Card` with `clickable = false`, and `SelectableCard` is a
wrapper (`~/DinoDesign/src/components/Card/Card.js:71,113,376`). Two Figma
components would both map to one lib component, so the converter would have to
collapse them — against the deterministic 1:1 goal.

It holds visually too; the two resting states differ only by a border token
(`Card.js:23-25`):

```
not clickable          -> 1px solid var(--Border-Variant)
clickable              -> 1px solid var(--Buttons-Default-Border)
clickable + selected   -> 2px solid var(--Buttons-Default-Border)
```

- [x] `default` → `Default`, axis kept as `State`. Done 2026-09-27.
- [x] **`Selected` BOOLEAN added** and correctly wired: 10 of 12 variants carry a
      `Selected` layer at `strokeWeight: 2`, matching `Card.js:25`. The two
      `Non-Clickable` variants have no `Selected` layer, which is the
      co-occurrence rule holding — a non-clickable card cannot be selected.
      Original note:** `selected` is a separate prop in
      code and `SelectableCard` is an exported lib component, but Figma's `Card`
      has no selected at all. `selected` co-occurs with hover, so by the rule
      above it needs its own axis — the same shape `Tab` already has. This is the
      addition; the split is not.
- [x] **Focus ring was bound to the `Selected` boolean — fixed 2026-09-27.** On
      both `Focus-Visible` variants the ring layer referenced `Selected`, so the
      ring only drew when `Selected=true`. Now `visible: true, bound: false` on
      both, present only on the Focus-Visible variants, and the set's only
      remaining `visible` bindings are the two intended ones
      (`No Bleed Card Content` on all 12, `Selected` on the 10 clickable).

      **Keep the mechanism in mind — it will recur: duplicating a layer copies
      its component-property binding.** The ring was almost certainly duplicated
      from the `Selected` layer (both 2px borders) and the reference came with
      it. Nothing warns you, and it is invisible in the property schema — the
      sweep in this document could not have found it.

- [ ] Check which border `State=Disabled` draws. `isClickable` is false when
      disabled (`Card.js:113`), so a disabled card may be painting the
      non-clickable `--Border-Variant` rather than the clickable one.

## 6. Selection is modelled five different ways

Same concept — "is this thing on / chosen / current" — five mechanisms:

| Mechanism | Components |
| --- | --- |
| `Status` axis | `Switch` `[Off, On]`, `Radio` `[unselected, selected]`, `Star` `[unselected, selected, isHalfFilled]`, `Count Step` / `No-Count Step` `[complete, incomplete, current]` |
| `Checked` axis | `Checkbox` `[unchecked, indeterminate, checked]` |
| `Selection` axis | `Day Cell` |
| `Selected` BOOLEAN | `Tab`, `Menu Item` (Tree View) |
| folded into `State` | `Button-Group-Segments`, `Seperated Button Segments`, `Nav Rail Item`, `Expandable Nav Rail Item`, `Nav Item`, `Pagination Number` |

- [ ] **Decide one and apply it.** The last row is the one that has to change
      regardless of which is chosen: `Selected` inside `State` means a selected
      button cannot also be hovered, which is why `Button-Group-Segments` is
      missing four of them — the author ran out of room in a single axis.
- [ ] `Radio` and `Switch` both use `Status` but disagree on the values
      (`unselected/selected` vs `Off/On`).

Same problem, smaller, for non-clickability:

- [ ] `List Item` and `Card` fold `Non-Clickable` / `non-clickable` into
      `State`, while `List` — the immediate parent of `List Item` — has it as a
      separate `Type: [non-clickable, clickable]` axis.

## 7. Property-name casing

Lowercase property names where every sibling component capitalises:

- [ ] `Radio Group` → `orientation` (cf. `Orientation` on `Divider`, `List`,
      `Steps`, `Nav-Bar`, `Sliders`, `Tabs`)
- [ ] `Bar-Basic` (Data Visualization) → `orientation`
- [ ] `Dropdown` → `type` (cf. `Type` on nine other sets)
- [ ] `Input Buttons` → `start-icon`, `end-icon` (cf. `Start Icon` / `End Icon`
      on `Tab`)

## 8. Single-option variant axes

An axis with one value is dead weight in the picker and tells the converter
nothing. Either add the other values or drop the axis.

- [ ] `Divider` → `Size: [small]`
- [ ] `Progress Bar` → `Type: [Progress]`, `Size: [Large]`
- [ ] `Progress Dial` → `Size: [Large]`, `Color: [Default]`
- [ ] `Rating` → `Size: [Small]`
- [ ] `Loader` → `Size: [Large]`
- [ ] `Input Buttons` → `Style: [ghost]`
- [ ] `Expandable Nav Rail Item` → `Style: [Label Contained]` — its sibling
      `Nav Rail Item` has `[Label Contained, Label Outside]`
- [ ] `Android/Time`, `Android/Bluetooth` → `Theme: [Dark]` — every other
      Status Bar set has `[Dark, Light]`
- [ ] **`Table Body Row` → `Color: [Surface]`** — this one is not just dead, it
      is the wrong mechanism. A surface is `data-theme` + `data-surface`, not a
      variant; see CLAUDE.md, *Changing a background*. A `Color` variant on a
      row will not expose the paired token set, so its text and borders stay on
      the parent's tone.

## 9. Naming conventions across sets

No action required for the converter, but it is the reason a name-matched rule
needs a lookup table today:

- hyphenated: `App-Bar` `Nav-Bar` `Form-Label` `Form-Helper`
  `Breadcrumb-Segments` `Breadcrumbs-separator` `Button-Group-Segments`
  `Bar-Basic` `No-Count Step` `Status-Bar-Lower` `Slider-thumb Vertical`
- spaced: `Drop Down Menu` `Group Buttons` `List Item` `Nav Item` `Nav Rail`
  `Day Cell` `Input Message` `Table Body Row`
- spaced hyphen: `Step - Line` `Ratio - Fill Horizontal`
- [ ] `Breadcrumb-Segments` (singular, capital S) vs `Breadcrumbs-separator`
      (plural, lowercase s) — two halves of one component, disagreeing twice
- [ ] `Card Content / Ecommerce` — ` / ` reads as a folder path in parts of
      Figma's UI

Misfiled:

- [ ] **`Drawer Title` is on the Rail page**, while the Drawer page has no
      component sets at all.
- [ ] **There are two `Menu Item`s** — one on Tree View (with nine `Menu Slot`
      properties), one on the Dropdown/menu boards. Same name, different
      components; `getNodeById` disambiguates them but a name match does not.

---

## 10. Parity: lib exports vs Figma components

The part that matters for the converter. Lib side is `~/DinoDesign/src/components/`.

### In the lib, NOTHING in Figma

**Re-verified 2026-09-28, and most of the original list was stale.** The first
sweep recorded these from pages that were empty at the time; several have been
built since. Recorded as a lesson: an existence list goes out of date faster
than anything else in this document, so re-read the file rather than trusting
the row.

Now built, all as standalone COMPONENTs:

- [x] `Modal` — plus a separate `Modal with overlay`
- [x] `Dialog`
- [x] `Drawer`
- [x] `TransferList` — `Transfer List`, wired to Component-Size (125 bindings)
- [x] `Text Editor`

**`SelectableCard` is not missing — it is `Card`.** Clarified 2026-09-28:

```
lib <Card>                   = Figma Card, State=Non-Clickable
lib <Card clickable>         = Figma Card, State=Default (+ Hover/Pressed/...)
lib <SelectableCard>         = the same, with Selected=true
```

`SelectableCard` is a three-line wrapper (`Card.js:376`), so it was never going
to have its own Figma component. This is the strongest confirmation of the
section 5b decision: one Card carrying `Non-Clickable` as a State value and
`Selected` as a BOOLEAN expresses the entire lib surface, and splitting it
would have produced two Figma components mapping to one lib component.

Still genuinely absent, re-verified:

- [ ] `Hero` — page exists, empty. A composition board, so possibly correct.
- [ ] `Player` — page exists, empty, and no lib component either.

Not yet re-verified — the original sweep's rows, which the above shows cannot
be trusted without re-reading:

- [ ] `Alert` · `Snackbar` · `Tooltip` · `CodeBlock` · `DropZone` ·
      `Autocomplete` · `Paper`
- [ ] `Popover` — a lib gap rather than a Figma one, and CLAUDE.md is wrong
      about it: `src/components/Popover/Popover.js` exists and genuinely
      portals (`getBoundingClientRect:44`, `ReactDOM.createPortal:74`) but is
      **not exported from `src/index.js`**, so the import fails. Verified
      2026-09-26.
- [ ] `Footer` · `Copyright` · `Sidebar` · `Toolbar` · `MainLayout` · `Showcase`
- [ ] `BevelText` · `CurvedText` · `Gradient` · `Charts`

Layout-only, probably correct to have no Figma component — confirm once and
stop listing them: `Container` `Grid` `Stack` `Spacing` `Section`.

### Named differently on each side

Each of these needs a mapping entry, or one side renamed:

| Lib | Figma |
| --- | --- |
| `Stepper` | `Steps` |
| `Select` | `Dropdown` |
| `BottomNavigation` | `Nav-Bar` / `Nav Item` |
| `CircularProgress` | `Progress Dial` |
| `LinearProgress` | `Progress Bar` |
| `Chip` **and** `Tag` | `Tag` only |
| `ButtonGroup` **and** `ToggleButtonGroup` | `Button Group` only |
| `TextField` / `SearchField` / `NumberField` | one `Input` set + `Input Text Style` |
| `Menu` | `Drop Down Menu` + `Menu Item` (two pages) |
| `Table` | `Table Header Row` + `Table Body Row` |
| `StateMessage` | `Input Message`? — confirm |

- [ ] The two rows where the lib has TWO components and Figma has ONE
      (`Chip`/`Tag`, `ButtonGroup`/`ToggleButtonGroup`) are the ones to settle
      first — a single Figma set cannot tell the converter which of two lib
      components to emit.

### In Figma, NOTHING in the lib

- [ ] `Carousel` (`Carousel Dot`)
- [ ] `Date Picker` (`Day Cell`) — in progress
- [ ] `Form Elements`, `Form-Label`, `Form-Helper`, `Message Icons` (Forms)
- [ ] `Image Placeholder`
- [ ] `Brand`
- [ ] `Box` → `Type: [default, border-radius]`, a variant the lib's `Box` has no
      prop for
- [ ] `Status Bar` — 10 sets. Device chrome, so probably correct to have no lib
      component; record the decision so it stops reading as a gap.

### Empty Figma pages

`Dialog` `Drawer` `Hero` `Modal` `Player` `Text Editor` `Transfer List`
`Typography`

- [ ] `Hero` and `Typography` are composition boards — fine.
- [ ] `Player`, `Text Editor` — no lib component either, so neither side has
      them. Decide whether they are planned or should go.
- [ ] `Transfer List` — **the lib has `TransferList`**, so this is the same gap
      as Modal/Dialog/Drawer.
