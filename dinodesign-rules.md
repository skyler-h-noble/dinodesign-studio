# DinoDesign — Correct-Usage Rules (Type B)

Audience-agnostic rules for producing **correct DinoDesign code**, regardless of
where the UI came from — a prompt (#1), a Figma design (#2), a template, or the
deterministic converter. These are the rules the workbench keeps teaching us;
extracted here, separated from the Figma-reading machinery.

**Two consumers:**
- **The #1 skill / lean context** — what an LLM loads to build DinoDesign UI from a prompt (replaces shipping the 870-line Figma converter prompt). For this use, §2a (prop signatures), §2b (known-broken), and §A (authoring decisions) are essential — the original mapping rules say how to *map* an existing design, but authoring from a prompt requires *choosing*.
- **The deterministic fixer spec** — what `@dynodesign/fix` enforces on generated code.

**Tags:**
- **[FIX]** — deterministic; a codemod/linter can detect and auto-correct (no model needed).
- **[GUIDE]** — judgment; the LLM/skill must decide. A linter can at most *flag* it.

> NOT in this file: Figma-interpretation rules (read `_aaid`, `node.visible`,
> `absoluteBoundingBox`, slot names, per-row subtree algorithm, fill→theme
> heuristics). Those are **Type A** and stay in the converter (`figmaToCode.ts`)
> because they only matter when the input is a Figma tree.

---

## 1. Use lib components — never raw HTML  **[FIX]**

Every UI element comes from `@dynodesign/components`. No `<button>`, `<input>`,
`<select>`, `<h1>`–`<h6>`, `<p>`, `<a href>`; no `@mui/material` imports; no
`<div>` styled to imitate a Card / Modal / Divider / Alert / Chip.

Allowed bare `<div>`: layout only (`display:flex` / `grid`) — and prefer
`VStack` / `HStack` / `Box` / `Grid` even then.

*Fixer:* map each raw tag → lib component (`<button>`→`Button`, `<h2>`→`H2`,
`<p>`→`Body`, `<a href>`→`Link`, …); rewrite `@mui/material` imports to the lib.

---

## 2. Component catalog (the registry)

```
LAYOUT     VStack, HStack, Box (surface, elevation 0–5; NO radius/padding by default),
           Grid, Container, Stack, Spacing, Divider
SURFACES   Card (padding small|medium|large), Section (theme, surface — paints a region),
           SelectableCard, Paper, Surfaced, ThemedZone
TYPOGRAPHY DisplayLarge, DisplaySmall, H1–H6, Body, BodyLarge, BodySmall,
           Subtitle, SubtitleLarge, Label, Overline, OverlineSmall, Caption
           (all take an optional color prop: quiet|primary|secondary|…)
CONTROLS   Button (variant primary|secondary|…|-outline|-light|ghost|text),
           ButtonGroup, Fab, Checkbox, Radio, RadioGroup, SwitchInput, Slider,
           Rating, TextField, TextInput, EmailTextField, PasswordTextField,
           NumberField, SearchField, TextArea, Autocomplete, Select
NAV/DISC   Tabs, Tab, TabList, TabPanel, Breadcrumbs, Pagination, Stepper,
           BottomNavigation, AppBar, Sidebar, Accordion, Drawer, Modal, Dialog,
           Tooltip, Popover
FEEDBACK   Alert, Snackbar, CircularProgress, LinearProgress, Badge
DATA       Chip, Avatar, AvatarGroup, Table, List, ListItem, Skeleton,
           Ratio (ratio, fit width|height, placeholder), Link
```

---

## 2a. Prop signatures — the components you compose most  **[GUIDE]**

Names alone aren't enough to author; these are the real APIs (verified against
the lib source). Prefer these over guessing a prop.

**Layout**
- `<VStack gap={token|number} alignItems="..." justifyContent="...">` — column
  flex. Pass alignment as **props**, not inline style. `<HStack>` is the row
  variant and defaults `alignItems="center"`. **Equal cross-axis size =
  `alignItems="stretch"`** → in an `HStack` all children become the same HEIGHT
  (tallest); in a `VStack` the same WIDTH. HStack defaults to center, so set
  `alignItems="stretch"` explicitly for equal-height rows.
- `<Box surface="Container" elevation={0–5} style={{ /* layout only */ }}>` — no
  radius/padding of its own.
- `<Grid>` is MUI-v1 style: `<Grid container spacing={2}>` wrapping
  `<Grid item xs={12} md={4}>` children (3-across = `md={4}`; same `Grid`
  component, `container`/`item` boolean props). **There is NO `columns` prop.**
  NOTE: helper exports (`ThirdWidthGrid`, `GridItem`, `ColumnGrid`, …) exist in
  the lib SOURCE but are **NOT exported** from the published `@dynodesign/components`
  — only `Grid` ships. Import `Grid` only. (Rule: author against the *published*
  package, not the source — verify the export exists.)
- `<Container>` centers + max-widths a page region.

**Surfaces**
- `<Section theme="..." surface="Surface" padding="80px 24px">` — `theme` optional
  (omit → inherit/Default); `surface` defaults `"Surface"`; paints
  `--Background`/`--Text` itself.
- `<Card padding="small|medium|large" elevated clickable surface="...">` — owns
  its own radius/surface/shadow; never restyle it inline.

**Controls**
- `<Button variant="…" size="small|medium|large" elevated iconOnly letterNumber avatar disabled fullWidth startDecorator endDecorator startIcon endIcon>`:
  - **`variant` = color + fill, combined** (there is NO separate `color` prop):
    `default`, `primary`…`error`; `-outline` / `-light` suffixes; `ghost` / `text`
    are **color-agnostic** (no `primary-ghost`). Default is `variant="default"` —
    never `primary` unless explicitly marked.
  - **content type:** `iconOnly` / `letterNumber` / `avatar` (plain text = none).
  - **slots:** `startDecorator` / `endDecorator` (icons: `startIcon` / `endIcon`).
    An `<Avatar>` decorator is **auto-sized** to the button (small→16, medium→24,
    large→40) **with 2px side padding** — pass just the content variant (photo =
    bare, `defaultPhoto={false}` = icon, `initials="JD"`); never set its size/padding.
  - **state:** only `disabled` is a prop — hover / active / focus-visible are CSS
    states the component handles itself, never set in code.
  - **size + elevation:** `size` + `elevated`. **Height comes from the brand's
    per-size token (small floored at 24×24)** — never set an inline height on a Button.
  - **width:** `fullWidth` to stretch; otherwise it hugs (use `alignSelf` for placement).
- `<ButtonGroup value={v} onChange={setV} color="default" size="small" fit="hug|fill|equal">` —
  **controlled**: `value`+`onChange` on the group, `value="…"` on each child
  `<Button>`. (See §2b.) **`fit` is the width variant:** `hug` (default, each
  button hugs its text), `fill` (group fills container, equal share), `equal`
  (group HUGS but every button matches the WIDEST — equal-width without
  full-width or fixed px; also **equal-height**, so a button whose label wraps
  makes all segments match the tallest).
- `<Checkbox variant="default" size="medium" checked />`, `<Radio>`, `<SwitchInput>`.
- `<TextField label fullWidth required error helperText />` (`fullWidth` defaults
  true). Typed variants: `EmailTextField`, `PasswordTextField`, `SearchField`,
  `NumberField`, `TextArea`.

**Data / feedback**
- `<Divider color="default|border|primary|…" orientation indicatorText="OR" />`
  — default color is `--Border-Variant`; can carry a label via `children` /
  `indicatorText`.
- `<Avatar size="x-small|small|medium|large" />` (bare = photo), `initials="JD"`,
  `defaultPhoto={false}` (icon).
- `<Icon size="small" color="primary"><MuiIcon/></Icon>` — wrap MUI icons for brand color.
- `<List>` + `<ListItem overline secondary startDecorator endDecorator size variant>title</ListItem>`.
- `<Tabs value={v} onChange={setV}>` (controlled) **or** `<Tabs defaultValue={0}>`
  (uncontrolled) + `<TabList>` + `<Tab value={0}>` + `<TabPanel value={0}>` — Tab
  and TabPanel pair by matching `value`. `<Modal closeOnBackdrop showCloseButton>`; `<Alert>`.
- Settings/toggle row = `<ListItem secondary="…" endDecorator={<SwitchInput …/>}>Title</ListItem>`
  (no startDecorator needed). For row separators use `<List dividers>` **OR**
  per-item `bottomBorder` — never both (double hairline).
- Prefer the **typed field variants** (`EmailTextField`, `PasswordTextField`,
  `SearchField`, `NumberField`) over `<TextField type="…">`.
- **Config-driven (NOT composed) components** — pass data as props, don't build children:
  - `<AppBar companyName="Acme" navLinks={['Home','Pricing','About']} barColor="default" />`
    (`barColor` sets the bar's theme; `rightButtons`, `loginType`, `user` also props). Keep it OUTSIDE a Section's surface — it paints its own theme.
  - `<Table columns={['Name','Status']} rows={[['Acme', <Chip variant="success-light">Active</Chip>]]} stripe="odd" />`
    — `columns`: strings OR `{label, field, width, align}`; `rows`: arrays of cells OR objects keyed by `field`; a cell may be JSX.
  - `<Chip variant="success-light">Active</Chip>` — variant = `{color}` / `{color}-outline` / `{color}-light`.
  - `<Alert color="info" variant="light|solid" startDecorator={…}>…</Alert>`.

**onChange has TWO conventions — do not mix them up:**
- **Selection components pass the VALUE:** `<Tabs onChange={(value) => …}>`,
  `<ButtonGroup onChange={(value) => …}>` (so `onChange={setValue}` works directly).
- **Input components forward a DOM EVENT (MUI-style):** `<SwitchInput onChange={(e) => e.target.checked}>`,
  `<Checkbox onChange={(e) => e.target.checked}>`, `<Radio>`, `<TextField onChange={(e) => e.target.value}>`.

---

## 2b. Known-broken components & required usage  **[GUIDE]**

Sanctioned workarounds — do NOT use the naive form:

- **`Menu` / `MenuItem`** — render `null` without a `<Dropdown>` ancestor.
  **Pretend they don't exist.** For a button-anchored dropdown, use a
  portal-based popover and tag it `MISSING-LIB-COMPONENT: Popover`.
- **`ButtonGroup`** — must be **controlled** (`value`+`onChange` on the group,
  `value=` on each child). Do NOT set `variant="default"`/`"outline"` on children
  manually — that re-introduces a double-border.
- **`Select`** — use the lib's default-export wrapper (fixes an invalid trigger
  border + the color swatch). Import from `@dynodesign/components` as normal.

---

## A. AUTHORING DECISIONS (#1 — choosing, not mapping)  **[GUIDE]**

The other rules say how to *map* an existing design. Authoring from a **prompt**
has no design to read, so the generator must **decide**. Defaults:

- **Theme:** default to **no `data-theme`** (the Default theme) unless the prompt
  names a brand mood ("premium / calm / bold"); only then pick a palette theme
  (`Primary`, `Primary-Light`, `Tertiary`, …). Never invent a hex — the theme
  resolves against the user's design system.
- **Surface:** a page/section is `surface="Surface"`; a card-shaped inset is
  `surface="Container"`. Use `<Section>` for any region that paints a background.
- **Button palette:** default is `variant="default"`. Use `variant="primary"` for
  **at most one** primary call-to-action per view, and only when the prompt marks
  a main action ("make X the primary action / make it stand out"). Otherwise
  `default`. *(The one [GUIDE] call the fixer can only flag, never auto-fix.)*
- **Spacing:** prefer Sizing tokens (`--Sizing-1`=8, `--Sizing-2`=16,
  `--Sizing-4`=32); section padding ≈ `"80px 24px"`. Don't scatter arbitrary px.
- **Layout:** stack with `VStack`/`HStack` using `alignItems`/`justifyContent`
  **props**; N-up card rows use a Grid **helper** (`ThirdWidthGrid` …), not a
  guessed `columns` prop.
- **Typography:** page title `DisplaySmall`/`H1`; section title `H2`/`H3`;
  supporting copy `Body color="quiet"`. Headers take **no** color prop.

---

## 3. Tokens, never hex  **[FIX]**

Never write a hex color or a hard-coded radius. Never invent a token name.

- Spacing: `--Sizing-Quarter`(2) `--Sizing-Half`(4) `--Sizing-1`(8)
  `--Sizing-1-and-Half`(12) `--Sizing-2`(16) `--Sizing-2-and-Half`(20)
  `--Sizing-3`…`--Sizing-16`(24…128) `--Sizing-20`(160) `--Sizing-30`(240);
  negatives `--Sizing-Negative-*`.
- Use the token only on an EXACT px match; otherwise emit the literal px. Never
  snap to the "nearest" token.
- Hallucinated names are the bug: `--color-surface-container`, `--color-text`,
  `--surface-tint` are WRONG. Real: `--Container`, `--Text`, `--Surface`,
  `--Border`, `--Border-Variant`, `--Sizing-2`, `--Style-Border-Radius`.

*Fixer:* flag any hex / unknown `--token`; auto-map the known wrong-name aliases.

---

## 4. Backgrounds via `data-theme` + `data-surface` — never inline color  **[FIX]+[GUIDE]**

To paint any region (page, section, hero, footer, card-shaped box), set
`data-theme` + `data-surface` (or use `<Section theme surface>`), and let the
cascade resolve `--Background`, `--Text`, `--Header`, `--Border`, etc.

- **[FIX]** Never write `background: var(--Surface)`, `background: var(--Container)`,
  or any hex/inline background. A backgrounded element must be a *painting*
  component — `VStack` / `HStack` / `Box` / `Section` / `Card` — **never a bare `<div>`**.
- **[GUIDE]** A tonally-tinted region inside an already-themed ancestor sets
  **only** `data-surface` (omit `data-theme`).
- `data-theme` values: `Default` (omit it — inherit), `Primary`, `Primary-Light`,
  `Tertiary`, `Secondary-Light`, palette-by-name, `Brand`/`Brand-App-Bar`/`Brand-Nav-Bar`.
- `data-surface` values: `Surface`, `Surface-Dim`, `Surface-Bright`, `Container`,
  `Container-High|Low|Highest|Lowest`.

---

## 5. Never add appearance to lib components  **[FIX]**

The ONLY inline style allowed on a lib component is **layout/sizing**: `width`,
`height`, `flex`, `margin`, `gap`, `padding`, `alignSelf`. NEVER inline
`background`, `color`, `borderColor`, `border`, `borderRadius`, or `boxShadow`.

Change appearance through props, not style:
- background → `surface` / `data-surface`
- radius → a component concern (`Box` has none; `Card` owns its own)
- shadow → `elevation` prop
- text color → the typography `color` prop
- button look → `variant` / `color`

If no prop covers the need → it's a lib gap; leave a `MISSING-LIB-COMPONENT`
comment (rule 16), don't hack it inline.

*Fixer:* strip/flag any appearance property in a lib component's `style=`.

---

## 6. Typography color  **[GUIDE]**

- **Headers (H1–H6) and Display → NEVER pass a `color` prop.** They default to
  `var(--Header)`, which is correct. Adding any color (even "primary"/"header")
  overrides it and is wrong.
- Standard body/titles → omit `color` (defaults to `--Text`).
- Muted/supporting → `color="quiet"` (or use `<Caption>`). Don't hand-recolor `<Body>`.
- Semantic → `color="error|success|warning"`.
- A brand color (`color="primary"`/`"secondary"`) only when the design's text
  truly uses that palette — rare.
- Hyperlinks → `<Link>`, not a recolored text node.

---

## 7. Buttons  **[GUIDE]** (palette) **/ [FIX]** (fill-style suffix)

- **`variant="default"` is the default — NEVER emit `"primary"` unless the design
  explicitly marks the button primary.** `default` and `primary` are different
  palettes; the brand CSS already paints `default` correctly. Don't hue-match a
  rendered color to a palette. When in doubt → `default`.
- Fill style (combine with palette): solid → `variant="<palette>"`; outlined →
  `"<palette>-outline"`; tonal → `"<palette>-light"`; no fill & no border →
  `"text"` / `"ghost"`.
- `variant="text"` renders as a **hotlink**, not a button — never use it for a
  button with a visible fill or border.

*Fixer:* flag `variant="primary"` for human confirmation (can't auto-decide intent).

---

## 8. Selection controls — Checkbox / Radio / Switch  **[GUIDE]**

- Emit `variant="default"`. The lib **defaults to `primary`**, which is almost
  never wanted — so `default` must be explicit. Other palette only when the
  design names one.
- Default size is **medium → omit `size`.** Only emit `size="small"`/`"large"`
  when the design says so. (`size="large"` by default is a common over-sizing bug.)
- Never pass `checked`/`selected` unless the instance actually is.

---

## 9. Divider  **[GUIDE]**

`<Divider>` default color is `--Border-Variant` (the lighter hairline).
- Border-Variant / unspecified → `<Divider>`
- `--Border` → `<Divider color="border">`
- palette → `<Divider color="primary|success|…">`

---

## 10. Avatar  **[GUIDE]**

Three content variants; default is the built-in photo:
- Photo → `<Avatar size="…" />` (bare — no `src` needed)
- Initials → `<Avatar size="…" initials="JD" />`
- Icon → `<Avatar size="…" defaultPhoto={false} />` (turns the photo off → built-in person icon)

Never pass a Figma `imageRef` hash as `src` (broken image). Only a real URL goes in `src`.

---

## 11. Box — no chrome of its own  **[GUIDE]**

A plain `<Box>` has **no radius and no background** by default. Apply ONLY what's
specified: `surface` (drives `--Header`/`--Text` tone — `Surface` ≠ `Container`),
`elevation`, padding, gap (set `display:flex` + direction + gap when it
auto-layouts), `borderRadius` (token or literal px — square stays square),
`border` (`var(--Border)` / `var(--Border-Variant)` / named brand token).
Never inline a background — the surface paints `--Background`.

---

## 12. Card vs Box  **[GUIDE]**

Use `<Card>` ONLY when the element is genuinely a Card. Do **not** infer Card from
rounded-corners + shadow — `<Card>` injects its own padding, radius, Container
surface, and Level-2 shadow, overriding the real spec. Every other container
frame → `<Box>` reflecting its actual props (rule 11).

---

## 13. Elevation / shadow  **[FIX]**

Use the `elevation` prop (`0`–`5`), never inline `boxShadow`. No shadow →
`elevation={0}` or omit. The Box's outer wrapper carries the layered shadow and
adopts the parent surface's dropshadow color automatically. Never put the shadow
on the same element that sets the surface.

*Fixer:* convert inline `boxShadow` → nearest `elevation` level; flag if ambiguous.

---

## 14. List rows  **[GUIDE]**

Use `<List>` + `<ListItem>` — never hand-roll a row with `<HStack>` + nested
`<VStack>` of typography. The three text layers are **props**, not children:
`overline` (top kicker), `children` (the title), `secondary` (the description).
ListItem owns each layer's typography token, alignment, slot sizing, and a11y.
Decorators: `startDecorator` / `endDecorator`.

---

## 15. Ratio for media  **[GUIDE]**

Any fixed-ratio media slot (image, thumb, hero, square tile) → `<Ratio ratio="…">`,
never a `<Box>` with hard-coded width/height. No real image URL → `<Ratio placeholder />`
(renders the built-in image-holder). A real URL goes in an `<img>`/`<Avatar>` child.

---

## 16. Output discipline  **[FIX]**

- **Import every component referenced.** Scan the output; every lib name used
  must appear in the `@dynodesign/components` import. Missing imports are a hard
  fail in a real project.
- For anything with no lib equivalent, emit the `MISSING-LIB-COMPONENT` comment
  block and inline a minimal lib-only placeholder — never reference the missing
  name in JSX.

*Fixer:* auto-generate/repair the import statement from the JSX; detect undefined
component references.

---

## Enforceable vs guidance — the fixer/skill split

| Deterministic — `@dynodesign/fix` handles **[FIX]** | Judgment — stays in the **[GUIDE]** skill/LLM |
|---|---|
| raw HTML / MUI → lib component (1) | header semantics & color intent (6) |
| hex / bad token names → real tokens (3) | primary-vs-default button intent (7) |
| inline background → `data-surface` + painting wrapper (4) | Card-vs-Box judgment (12) |
| strip inline appearance on lib components (5) | which Avatar/Divider variant the design wants (8–10) |
| inline `boxShadow` → `elevation` (13) | List/Ratio structural choices (14–15) |
| repair imports / flag undefined refs (16) | |

**Takeaway:** the **[FIX]** column is what removes tokens from #1 — Claude can be
*roughly* right and the codemod makes it *exactly* compliant, killing the
correction loops. The **[GUIDE]** column is the irreducible judgment that stays in
a (now much smaller) skill prompt.
