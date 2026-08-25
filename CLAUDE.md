# CLAUDE.md — DinoDesign Studio

Guidance for AI coding tools (Claude Code, Cursor, Copilot) working in this repo.

This file is the studio app's contract. The component library it consumes
(`@dynodesign/components`) has its own CLAUDE.md inside `node_modules/...` —
read that for token names and theme rules. This file is about how the **studio**
uses the lib.

---

## The one rule

**Every UI element in this app must come from `@dynodesign/components`.**

If you can render it with a lib component, do. No raw `<button>`, `<input>`,
`<select>`, `<h1>`–`<h6>`, `<p>`, or `<a href>`; no `@mui/material` imports;
no `<div>` styled to imitate a Card / Modal / Divider / Alert / Chip.

There are exactly two reasons you may bypass this rule, both narrow:

1. **Layout primitives** — a plain `<div>` whose only job is `display: flex` /
   `display: grid` is fine. (Prefer `VStack`, `HStack`, `Box`, `Grid` when they
   fit.)
2. **Shell-only chrome** — the print-targeted `AccessibilityReport`, the
   `PhonePreview` iPhone mockup, and intentional raw `<button>` for a portal
   trigger when the lib equivalent is broken (see [Known-broken components](#known-broken-components)).

Anything else is drift, and the audit script will catch it.

---

## When a needed component doesn't exist in the lib

The lib has gaps. Don't invent the missing piece inline — surface it so it can
be added to the lib for everyone. Use this exact format so a grep finds it
later:

```tsx
// MISSING-LIB-COMPONENT: <ComponentName>
// Needed for: <one line on the use case in this file>
// Proposed API: <props sketch>
// Lib-track: add to @dynodesign/components/src/components/<ComponentName>/
```

Then either:

- **If the missing piece is trivial and one-off** (e.g., a labelled separator
  in a single screen): inline it with the `MISSING-LIB-COMPONENT` tag above
  the JSX so it's obvious it should migrate later.
- **If the missing piece is reusable** (any of: it's used in more than one
  file, it has its own state, it portals, or it needs keyboard a11y): **stop
  and tell the user** before writing it inline. Confirm whether to (a) add
  it to the lib first, or (b) inline it with the tag and a follow-up issue.

When tagging a missing component, also write a comment in the file's header
listing all `MISSING-LIB-COMPONENT` tags it contains, so reviews catch them.

To find existing tags across the repo:

```bash
grep -rn "MISSING-LIB-COMPONENT" src/
```

---

## Available lib components

Imported from `@dynodesign/components`. (See `node_modules/@dynodesign/components/CLAUDE.md`
for token/theme details.)

| Need | Use |
| --- | --- |
| Headings | `H1`, `H2`, `H3`, `H4`, `H5`, `H6`, `DisplayLarge`, `DisplaySmall` |
| Body text | `Body`, `BodyLarge`, `BodySmall`, `Subtitle`, `SubtitleLarge` — Body has no bold; see [Body weights](#body-weights) |
| Labels | `Label`, `Overline`, `Caption` |
| Buttons | `Button` (variants: primary/secondary/tertiary/neutral/info/success/warning/error/default + `-outline`/`-light`/`ghost`/`text`), `ButtonGroup`, `Fab` |
| Inputs | `TextField`, `TextInput`, `EmailTextField`, `PasswordTextField`, `NumberField`, `SearchField`, `TextArea`, `Autocomplete`, `Select` |
| Selection | `Checkbox`, `Radio`, `RadioGroup`, `SwitchInput`, `Slider`/`SliderInput`, `RangeSlider`, `Rating` |
| Layout | `VStack`, `HStack`, `Stack`, `Box`, `Grid`, `Container`, `Divider`, `Spacing` |
| Surfaces | `Card`, `SelectableCard`, `Paper`, `Surfaced`, `ThemedZone` |
| Navigation | `Tabs`/`Tab`/`TabList`/`TabPanel`, `Breadcrumbs`, `Pagination`, `Stepper`, `BottomNavigation`, `AppBar`, `Sidebar` |
| Disclosure | `Accordion`, `Drawer`, `Modal`, `Dialog`, `Tooltip`, `Popover` (via `Dropdown` — see below) |
| Feedback | `Alert`, `Snackbar`, `CircularProgress`, `LinearProgress`, `Badge` |
| Data | `Chip`, `Avatar`, `AvatarGroup`, `Table`, `List`, `Skeleton` |
| Links | `Link` |

**Do not** import any of these from `@mui/material`. The lib re-exports the
ones it supports with DynoDesign theming wired in. Material icons
(`@mui/icons-material`) are fine — the lib doesn't ship icons.

---

## Components with a documented gotcha

A few lib components need more than their obvious usage — a required parent, a
wrapper, or a workaround kept in this repo. Treat these as the only sanctioned
"don't use the lib as-is" exceptions.

Not all of them are broken. `Menu` works and was mislabelled here for months;
check what an entry actually says before routing around a component.

### `Menu` / `MenuItem` — works, but only as a compound component

**This entry previously said "pretend it doesn't exist." That was wrong**, and
being wrong in a file every AI tool reads made it self-perpetuating — the lib
had a working menu that nobody used for months.

`Menu` is one part of a compound component. It needs its `<Dropdown>` root,
which supplies the open state through context. Used as designed it works:
opening, closing, keyboard navigation, Escape, item activation and the menu /
menuitem roles are all covered by passing tests.

```tsx
<Dropdown>
  <MenuButton>Actions</MenuButton>
  <Menu>
    <MenuItem onClick={…}>Profile</MenuItem>
    <MenuDivider />
    <MenuItem disabled>Settings</MenuItem>
  </Menu>
</Dropdown>
```

Always pass `<Dropdown>` as the root. `Menu` on its own reads the default
context, whose `open` is `false`, so it returns `null` and renders nothing with
no warning — which is exactly how the "it's broken" conclusion happened.

**The one real limitation: it does not portal.** The panel is
`position: absolute` inside the Dropdown wrapper. `z-index` does not let a
positioned element escape an `overflow: hidden` or transformed ancestor, so
inside a scrolling container or a clipped card the menu is cut off.

So the choice is by situation, not by "the component is broken":

| Anchoring a menu… | Use |
| --- | --- |
| in normal flow, nothing clipping it | `Dropdown` + `MenuButton` + `Menu` |
| inside a scroll area, card, or clipped container | the portal pattern below |
| to an arbitrary element you do not control | the portal pattern below |

The portal pattern is in `MyDesignsPage.tsx` (ellipsis menu) and
`node_modules/@dynodesign/components/src/components/AvatarMenu/AvatarMenu.js`
(account dropdown). Both anchor a panel via `getBoundingClientRect`, render
through `createPortal(document.body)`, and close on outside-click + Escape.

If you need that in a new file, tag it `MISSING-LIB-COMPONENT: Popover` — the
lib still has no portal-based popover, and that gap is real even though `Menu`
is not broken.

Its 18 failing ARIA tests are **test** bugs, not component bugs: they assert on
`getByText('Actions')`, which returns the inner Typography `<p>`, while
`aria-haspopup` / `aria-expanded` / `aria-controls` are correctly set on the
ancestor `<button>`. Do not "fix" the component to satisfy them.

### `AvatarMenu` — fixed in lib

If `@dynodesign/components`'s `AvatarMenu` ever silent-fails again, the cause is
a `Menu` rendered without its `<Dropdown>` root: the default context has
`open: false`, so it returns `null` silently. That is a usage error rather than
a component bug — see the `Menu` entry above. The fix is the inline-portal
pattern; the rewrite lives at
`/Users/lisenoble/Documents/dinodesign/src/components/AvatarMenu/AvatarMenu.js`.

### `ButtonGroup` — fixed via wrapper

The legacy `ButtonGroup` paints an outer border on its `Box` and clones each
child with `*-outline` variant — producing a double-pill outline. The wrapper
at `/Users/lisenoble/Documents/dinodesign/src/components/ButtonGroup/ButtonGroup.js`
strips the outer border via `sx`. Use as normal:

```tsx
<ButtonGroup value={selected} onChange={setSelected} size="small">
  <Button value="a" size="small">A</Button>
  <Button value="b" size="small">B</Button>
</ButtonGroup>
```

Always pass `value` + `onChange` to the group and `value=` on each child
(controlled mode). Setting `variant="default"` / `variant="outline"` on
children manually is wrong — that's what re-introduces the double-border.

### `Select`

Used through a small wrapper that fixes (a) the trigger's invalid `border: 1px
solid inherit` and (b) the color-mode swatch reading `value` instead of
`color`. Import from `@dynodesign/components` like any other lib component;
the wrapper is the default export.

---

## Right vs. wrong

```tsx
// ✅ Right
import { Button, H2, Body, Card, VStack, Divider, Link } from '@dynodesign/components';

<Card padding="medium">
  <VStack spacing={2}>
    <H2>Title</H2>
    <Body>Description.</Body>
    <Divider />
    <Link onClick={handleSignUp}>Sign up</Link>
    <Button variant="primary" onClick={handleSave}>Save</Button>
  </VStack>
</Card>
```

```tsx
// ❌ Wrong — raw HTML for things the lib covers
<div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
  <h2>Title</h2>
  <p>Description.</p>
  <div style={{ borderTop: '1px solid var(--Border)' }} />
  <span style={{ color: 'var(--Hotlink)', cursor: 'pointer' }} onClick={handleSignUp}>
    Sign up
  </span>
  <button onClick={handleSave}>Save</button>
</div>

// ❌ Wrong — direct MUI import
import Button from '@mui/material/Button';

// ❌ Wrong — building a Popover from scratch without tagging it as missing
function CustomPopover({ children }) {
  return <div style={{ position: 'absolute', ... }}>{children}</div>;
}
```

---

## Token facts that are easy to get wrong

Four contracts established by debugging, each of which failed silently before it
was pinned down. A wrong value here renders as a plausible design, not an error.

**`--Button-Border-Width` is `1px`.** Emitted by the CSS export, the preview and
the Figma payload, all from one constant. It is also load-bearing: Figma's
`Button-Height`, `Sm/Lg-Button-Height` and the three `Button-Swatch` tokens are
computed as `outer - (border x 2)`, so changing the width moves seven tokens,
not one. Do not delete the variable to "simplify" it — it already ships to
Figma, and a deleted Figma variable cannot be recovered by re-importing
(invariant 8).

**`--Dropdown-Frame-Radius` = `min(Input-Radius, Card-Radius, 16px)`.** The
floating frame of a dropdown or menu panel. It follows the input it opens from,
is never rounder than the cards it floats above, and caps at 16px because the
panel scrolls with full-bleed rows — a larger corner clips the first and last
item's hover highlight. Pixels, not a percent: a dropdown's height is
content-driven, so a percent would make a long menu absurdly round.

**Links do not change colour on hover.** The design system emits no hover tone
for links; the underline thickens instead. Do not add one — any value would be
invented rather than derived, on text carrying a 4.5:1 requirement. The lib's
`Link` reads `--Link` / `--Link-Visited`, which nothing defines; it falls back
to `--Hotlink` / `--Hotlink-Visited`, which is what the generator actually
emits.

**`foundations.css` no longer exists — the file is `foundation.css`.** The two
disagreed on six values (`--Button-Radius` 4px vs 34px, and the whole bevel
system), and the plural was missing `--Input-Radius`, which the
`Dropdown-Frame-Radius` chain depends on.

### A var() fallback only fires when the variable is UNDEFINED

This caused three separate bugs in one session, so it is worth stating plainly.

`var(--Font-Family-Display, var(--Set-Font-Family-Decorative, sans-serif))` does
NOT mean "use Display, or fall back to Decorative". The lib defines
`--Font-Family-Display` — to the HEADER family on Desktop — so the fallbacks are
never reached, and the display font never appeared. The same shape hid the
eyebrow rendering in the decorative face.

So: **put the brand-owned token first**, and have the preview EMIT the token
rather than hoping to fall through to it. If a value must be right, state it;
do not arrange for it to be inherited.

## Tokens, never hex

Read `node_modules/@dynodesign/components/CLAUDE.md` for the full token list.
The rule that matters here: never write a hex color or hard-coded radius. Use
`var(--Text)`, `var(--Border)`, `var(--Style-Border-Radius)`, etc. Brand CSS
in `src/utils/buildPreviewCSS.ts` defines the user-specific values; component
code just references the tokens.

The one acceptable exception is the broken-lib workaround panels (portal
dropdowns), which still use tokens for `background`, `color`, and `border`
but may inline a `box-shadow` fallback when the lib doesn't expose one.

---

## Changing a background — the only correct way

To paint a page, section, or div, **set `data-theme` + `data-surface` on the
element**. Do not write `background: var(--Surface)` or
`background: var(--Container)` anywhere. Those vars exist in the cascade so
the design system can compute them — components consume them through
`var(--Background)`, which is what `data-surface` resolves to.

```tsx
// ✅ Right — declare the theme + surface, let the cascade do the work
<section data-theme="Primary-Light" data-surface="Surface">
  <H2>Title</H2>
  <Body>This text, the border below, the buttons inside — all wired up.</Body>
</section>

<div data-surface="Container">
  {/* Card-shaped background without writing a color at all */}
</div>
```

```tsx
// ❌ Wrong — bypasses the cascade, locks the surface to one specific token
<section style={{ background: 'var(--Surface)' }}>...</section>
<section style={{ background: 'var(--Container)' }}>...</section>
<section style={{ background: 'var(--Primary-Color-11)' }}>...</section>
<section style={{ background: '#f0ebe0' }}>...</section>
```

Why this matters: setting `data-theme` + `data-surface` exposes the full set
of paired tokens — `--Background`, `--Text`, `--Quiet`, `--Header`,
`--Border`, `--Border-Variant`, `--Hover`, `--Active`, `--Hotlink`, the per-
palette `--Buttons-*-Border/Highlight/Lowlight` overrides — all tuned for
that surface's tone. Writing `background: var(--Surface)` paints the box but
leaves text/quiet/border on the parent's tone, so contrast breaks the moment
the surface flips dark or moves to a different Color-N.

When a component (e.g., Button, Tag, Icon) needs a specific brand token, use
the named one — `var(--Buttons-Primary-Button)`, `var(--Text-Primary)`,
`var(--Icons-Secondary)`. Those are also surface-aware (they resolve
differently inside Surface vs. Container vs. Surface-Dim).

This is the same contract we ship in the lib's CLAUDE.md to end users'
agentic AI tools. Be exact about it — drift here teaches the wrong pattern.

---

## Icon buttons: the button is named, the icon is not

An icon-only `Button` needs an accessible name, and the icon inside it must not
carry one. Give both and a screen reader announces the control twice — "Delete,
Delete button". Give neither and it is announced as "button", which says
nothing.

```tsx
// Right — the button owns the name, the icon is decoration
<Button iconOnly aria-label="Delete item"><DeleteIcon /></Button>

// Wrong — announced twice
<Button iconOnly aria-label="Delete item">
  <DeleteIcon titleAccess="Delete" />
</Button>

// Wrong — announced as just "button"
<Button iconOnly><DeleteIcon /></Button>
```

Name the ACTION, not the glyph: `aria-label="Delete item"`, not
`aria-label="trash"`.

The lib's `<Icon>` is already `aria-hidden` unless you pass it an `aria-label`,
so the ordinary case is correct by default. `Button` now dev-warns on both
failure modes — they are invisible without a screen reader, which is how they
survive.

## Don't override component colors

Lib components apply their own colors from the design system. **Never pass
`style={{ color, background, borderColor }}` to a lib component.** To change
appearance, change the component's `variant` (or `color`) prop. If the prop
options don't cover what you need, that's a lib gap — flag it as a
`MISSING-LIB-COMPONENT` follow-up instead of overriding inline.

```tsx
// ✅ Right — variant/color drive appearance
<Button variant="primary-outline" color="default">Cancel</Button>
<Button variant="success" size="small">Approve</Button>
<H2>Title</H2>             {/* uses --Header automatically */}
<Body>Body copy</Body>     {/* uses --Text automatically */}
<Link>Sign up</Link>       {/* uses --Link automatically */}
```

```tsx
// ❌ Wrong — bypasses the component's variant system
<Button style={{ background: 'var(--Buttons-Primary-Button)', color: '#fff' }}>
  Cancel
</Button>
<H2 style={{ color: 'var(--Primary-Color-3)' }}>Title</H2>
<Body style={{ color: 'var(--Quiet)' }}>Muted text</Body>
<Card style={{ background: 'var(--Container-High)' }}>...</Card>
```

For muted body copy, use the lib's quiet variant (or `<Caption>`) — don't
recolor `<Body>` by hand. If you find yourself reaching for `style={color}`
on a typography or button component, the fix is one of: (a) wrong component
for the job, (b) wrong variant, (c) lib gap — tag it and move on.

### Body weights

Body ships **standard and semibold only**. There is no bold Body style — for
bold at body sizes use `Subtitle-Small`, `Subtitle-Medium` (the plain
`<Subtitle>`), or `Subtitle-Large`. Subtitle *is* Body at 700: same face, same
sizes, same leading.

```tsx
<Body>Normal body copy.</Body>
<Typography variant="body-semibold">Semibold body copy.</Typography>
<Subtitle color="standard">Bold body copy.</Subtitle>
```

Two traps: `variant="body-bold"` silently resolves to the *semibold* style (it
is a back-compat alias, not a 700), and Subtitle defaults to `color="header"`
while Body defaults to `color="standard"` — so pass `color="standard"` when you
are using Subtitle purely to get weight, or the text changes colour too.

Full rationale and the `--Body-Bold-Font-Weight` caveat: the lib's CLAUDE.md,
*Body has two weights — Subtitle is the bold one*.

### Typography color prop reference

`Body`, `BodySmall`, `BodyLarge`, `H1`–`H6`, `Caption`, `Overline`, `Label`,
`Subtitle` all accept a `color` prop. Use it instead of `style={{ color }}`:

```tsx
<Body color="quiet">…</Body>        // var(--Text-Quiet)
<Body color="primary">…</Body>      // var(--Text-Primary)
<Body color="secondary">…</Body>    // var(--Text-Secondary)
<Body color="success">…</Body>      // semantic tokens
<Body>…</Body>                       // defaults to standard / --Text
```

For brand-colored icons, wrap MUI icons in the lib's `<Icon>`:

```tsx
<Icon size="small" color="primary"><CheckCircleIcon /></Icon>
<Icon size="medium" color="neutral"><FormatQuoteIcon /></Icon>
```

### Backgrounds — use `<Section>` for any region

For any region that paints a background (page sections, hero, footer, sticky
nav wrappers, etc.), use `<Section>` from the lib. It sets `data-theme` +
`data-surface` AND paints `--Background` / `--Text` in one shot:

```tsx
<Section theme="Primary" surface="Surface" padding="80px 24px">
  …
</Section>
```

For a section that just inherits its parent's surface, omit `theme` (and
optionally `surface`):

```tsx
<Section padding="80px 24px">…</Section>
```

Reserve `<ThemedZone>` for the case where you need the attributes but NOT
the background paint (e.g., wrapping an `AppBar` whose own root paints
itself).

---

## Design system invariants

These are about **generating** tokens (`src/utils/cssgen/`,
`generateFigmaJSON.ts`, `buildPreviewCSS.ts`), not about using components.
Full reasoning and measurements: [docs/design-system-architecture.md](docs/design-system-architecture.md).
Container colours have their own write-up — the five levels, the opacity
ladders, and the traps: [docs/container-logic.md](docs/container-logic.md).
The page background is a theme + surface level, not a string:
[docs/background-selection.md](docs/background-selection.md).

Each rule below has already been broken once. The consequence is stated so it
can't be reasoned away.

1. **Never flatten or prune the Figma `Modes` collection without rewriting the
   references in the same pass.** Theme, State and Surface alias into it by
   name. One flatten orphaned **6,084 of 13,701 references**. If you do it,
   count unresolved references before and after — `generateFigmaJSON` already
   warns when they diverge.

2. **A duplicated value is not automatically redundant.** The test is not "do
   the copies match" but *"does anything select between them"*. The
   `Light`/`Medium` button shades held identical values and the Theme layer
   picked between them per surface — collapsing them destroyed a choice.
   `BlackWhite`'s palette level also held identical values and nothing selected
   between them — collapsing that was correct.

3. **Changing a tone changes the label.** Text is derived from the fill, so a
   one-tone move can flip white text to near-black. Check both.

   Related: hover/pressed direction is decided by the **label**, not the tone
   index — the state must move away from the text on it. The index is a proxy
   that assumes every palette's text table flips at tone 6; the one palette
   where it doesn't took a 4.54:1 button to 2.17:1.

4. **A locked colour must still pass, and the user must be told if it moved.**
   The user's hex is written verbatim into the nearest tone, which can put an
   inaccessible colour where the generated ramp never would. Adjust only when
   the colour genuinely cannot carry text from its own ramp — the dead-zone
   band alone is the worst case at maximum chroma, and 229 of 229 sampled
   in-band picks passed. Record the change so the UI can surface it.

5. **The preview is a separate implementation from the export.** They diverge
   silently — an unresolved `var()` paints nothing and reports nothing. Change
   both, and cover it in `src/__tests__/tokenParity.test.ts` (or a focused
   sibling such as `containerTone.test.ts`).

   Divergence does not require a broken value on either side. The tonal
   container was keyed on light/dark MODE in the preview and on the
   background's LIGHTNESS in the export; both were self-consistent, so a black
   background in light mode drew a near-white card in the preview and a
   near-black one in the published CSS, and every test passed. Assert the token
   a surface actually resolves to, not just that both sides emit something.

6. **Assert per-theme, not only at Brand scope.** Tonal and primary produce the
   same button at Brand scope and different ones on every themed surface. That
   gap hid a real divergence through a passing parity suite.

7. **Parity is not correctness.** Both sides can be wrong and still agree.
   Assert the intended shape independently — e.g. a surface-scoped button mode
   *must* differ across surfaces; a fixed one *must not*.

8. **Verify before deleting anything that ships to Figma.** Deleted variables
   cannot be recovered by re-importing: a recreated variable gets a new id, so
   every layer bound to the old one stays unbound. Recovery is Figma's undo or
   version history.

## What the generated CSS deliberately does NOT do

Two contracts that are invisible in the code and have each cost a debugging
session. They belong with the invariants above because breaking them is easy
and the failure is silent.

**The output gives bare elements no appearance.** No `body`, `html`, `p`, `h1`
or `*` rule sets colour, background, or typography in any of the six files —
only custom properties and opt-in `.typography-*` classes. A consumer who loads
the CSS and expects text to look right gets nothing, and that is correct: a
design system that restyled `body` on import would change pages nobody asked it
to change. Do not "fix" this by adding an appearance rule to the generator. The
consumer-side setup is documented in the lib's CLAUDE.md under *Page setup*.

The one bare-element rule that IS emitted is `body { margin: 0 }`, in both mode
sheets (`exportToCSS.ts:3334`). It is a reset, not appearance, and it is the
whole of the exception.

This rule previously read "no bare element rule is emitted", which was already
false when written — the `margin: 0` had been shipping in every export. An
absolute claim that the code contradicts is worse than no claim: it gets
believed, and then the first counter-example is used to argue the rule never
held. The line that matters is APPEARANCE, so that is where the line is drawn.

**Eyebrow and Overline are one concept under two names, and Eyebrow is the
name.** The type style publishes `--Eyebrow-{Small,Medium,Large}-Font-Size`,
`-Letter-Spacing`, `-Text-Transform`, alongside the face and colour role
(`--Eyebrow`, `--Font-Family-Eyebrow`, `--Font-Weight-Eyebrow`).

`--Overline-*` is still emitted, and must stay emitted: a design system's CSS is
frozen per system in Storage and cannot be regenerated, so an old system loaded
against new consumer code has to keep resolving. It is an ALIAS, not a rename.

**The alias reads Overline → Eyebrow, and the direction is load-bearing.** The
canonical name holds the literal and the back-compat name reads it:

```css
--Eyebrow-Medium-Font-Size: 13px;
--Overline-Medium-Font-Size: var(--Eyebrow-Medium-Font-Size);
```

Pointing it the other way also "cannot drift", so both directions look correct
in a diff — but it makes Overline canonical again and quietly undoes the rename.
`src/__tests__/eyebrowAlias.test.ts` asserts the direction in both directions
(contains one, not the other) for exactly that reason.

Note there is no step-less `--Eyebrow-Font-Size` — the sizes are always
`-Small` / `-Medium` / `-Large`, and reaching for the bare name gets a silent
fallback.

`--Eyebrow` is a ROTATION off the surface's palette (Primary→Secondary,
Secondary→Tertiary, Tertiary/Neutral→Primary, states→BW), encoded in the
`Eyebrows` table. It is not a muted `--Text`, and anything that substitutes
`--Quiet` for it discards the rotation.

## `tsc -p .` typechecks NOTHING here

The root `tsconfig.json` is `"files": []` with only project references, so:

```
npx tsc --noEmit -p .   ->  0 errors     (checks no files at all)
npx tsc -b              ->  0 errors     (the real number, verified 2026-08-25)
```

Both read `0` today, and they mean opposite things: `-b` compiled every file and
found nothing; `-p .` never opened one. Do not take the matching numbers as
proof the flags are interchangeable — `--listFiles` on `-p .` still returns no
project file at all.

Use `npm run typecheck` (`tsc -b`). Never `-p .` — it reports a clean pass on a
codebase that does not compile, which is worse than no check, because the clean
output is taken as evidence.

This is not hypothetical: `<Select>` and `<Label>` were added to
`TypographyTestPage.tsx` with no import and shipped as "typecheck clean". The
error was `TS2304: Cannot find name 'Select'` — a first-line failure that `-p .`
never looked for.

The baseline used to be 366 pre-existing errors (mostly `TS6133` unused locals
and missing lib type exports) with the instruction to gate on *no worse than
baseline*. Those have since been cleared: `npx tsc -b --force` is clean, so the
gate is now simply **zero**. If you see a non-zero count, it is yours.

Re-measure with `--force` before trusting a `0`. `tsc -b` is incremental and
will happily report a clean pass from a stale build cache on a tree that does
not compile — the same failure mode as `-p .`, one layer down.

## Audit

Before committing UI work, run a quick mental pass:

1. `grep -rn "from '@mui/material'" src/` — should be empty (only `@mui/icons-material`).
2. `grep -rn "<button\|<input\|<select" src/` — every hit should be in a
   shell file or have a clear comment explaining why.
3. `grep -rn "MISSING-LIB-COMPONENT" src/` — see what's outstanding and whether
   any of it should be lifted into the lib.
