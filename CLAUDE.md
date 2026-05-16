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
| Body text | `Body`, `BodyLarge`, `BodySmall`, `Subtitle`, `SubtitleLarge` |
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

## Known-broken components

A few lib components don't work standalone and have a documented workaround
inside this repo. Treat these as the only sanctioned "don't use the lib"
exceptions.

### `Menu` / `MenuItem`

The lib's `Menu` is implemented against a private `Dropdown` React context.
With no `<Dropdown>` ancestor (the common case for a dropdown anchored to an
arbitrary button), `Menu` returns `null` and the dropdown silently doesn't
render. **Pretend it doesn't exist.**

Instead, use the portal-based pattern from `MyDesignsPage.tsx` (ellipsis menu)
or `node_modules/@dynodesign/components/src/components/AvatarMenu/AvatarMenu.js`
(account dropdown). Both anchor a panel to a real DOM element via
`getBoundingClientRect`, render via `createPortal(document.body)`, and close
on outside-click + Escape.

If you need this in a new file, tag it as
`MISSING-LIB-COMPONENT: Popover` (the lib genuinely doesn't have a working
portal-based popover yet).

### `AvatarMenu` — fixed in lib

If `@dynodesign/components`'s `AvatarMenu` ever silent-fails again, it's the
same `Menu` bug. The fix is the inline-portal pattern; the rewrite lives at
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

## Tokens, never hex

Read `node_modules/@dynodesign/components/CLAUDE.md` for the full token list.
The rule that matters here: never write a hex color or hard-coded radius. Use
`var(--Text)`, `var(--Container)`, `var(--Border)`, `var(--Style-Border-Radius)`,
etc. Brand CSS in `src/utils/buildPreviewCSS.ts` defines the user-specific
values; component code just references the tokens.

The one acceptable exception is the broken-lib workaround panels (portal
dropdowns), which still use tokens for `background`, `color`, and `border`
but may inline a `box-shadow` fallback when the lib doesn't expose one.

---

## Audit

Before committing UI work, run a quick mental pass:

1. `grep -rn "from '@mui/material'" src/` — should be empty (only `@mui/icons-material`).
2. `grep -rn "<button\|<input\|<select" src/` — every hit should be in a
   shell file or have a clear comment explaining why.
3. `grep -rn "MISSING-LIB-COMPONENT" src/` — see what's outstanding and whether
   any of it should be lifted into the lib.
