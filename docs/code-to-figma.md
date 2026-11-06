# Code → Figma: the deterministic compiler

The studio already turns a Figma frame into code without a model (`src/utils/aaid/`,
"Figma → code"). This is the other direction: take a page of an app built with
`@omni-design/components`, and describe it as Figma nodes built from the user's
own copy of the Omni Figma template — the same components, variant values,
variable modes and Sizing tokens the code used.

Status, 2026-11-06: phases 0–2 are built. Phase 3 (the plugin command that builds
the frames) is not; this document is written so it can be built from it.

```
app code ──(1) runner──▶ recorded tree ──(2) mapper──▶ IR (JSON) ──(3) plugin──▶ Figma frames
                         <state>.recorded.json        <state>.ir.json              stamped with _aaid
                                                                                    │
                          Figma → code compiler ◀──────────────────────────────────┘
                          (the round-trip test runs this loop with no Figma)
```

| Piece | File |
| --- | --- |
| Runner (Node only, not in the browser bundle) | `scripts/code2figma/snapshot.mjs` |
| Snapshot specs for the benchmark store | `scripts/code2figma/specs/omni-r5.omni-snapshots.json` (whole app), `omni-r5.pages.omni-snapshots.json` (page only) |
| Recording stand-ins | `src/utils/code2figma/record.ts` |
| Mapper (recorded tree → IR) | `src/utils/code2figma/mapper.ts` |
| IR types — the source of truth for this doc | `src/utils/code2figma/schema.ts` |
| Live Figma vocabulary (captured 2026-11-06) | `src/utils/code2figma/figmaLibrary.live.json`, read through `library.ts` |
| Round trip (IR → plugin node JSON, signatures) | `src/utils/code2figma/roundTrip.ts` |
| Tests | `src/__tests__/code2figma.test.ts` |

The prop tables are not forked: the mapper reads `src/utils/aaid/propTables.ts`
backwards. See [The tables run both ways](#the-tables-run-both-ways).

---

## Running it

```bash
node scripts/code2figma/snapshot.mjs scripts/code2figma/specs/omni-r5.omni-snapshots.json
#   --out <dir>     default: code2figma-out/<app>/ (git-ignored)
#   --app <dir>     override the spec's app path
#   --state <name>  one state only
```

Needs Node 23.5 or later (`module.registerHooks`). No new dependency: JSX is
transpiled with the studio's TypeScript, and React, `react-dom/server` and
`react-router-dom` are loaded from the **app's** `node_modules`, so the React
version that ships is the one that renders.

Per state it writes `<state>.recorded.json`, `<state>.ir.json` and `<state>.log`
(React's warnings from the render), plus `coverage.json` for the run, and prints
a coverage table.

---

## Phase 1 — render and record

The app's own, unmodified code runs, with real React, real context and real
state. Every export of `@omni-design/components` it imports is swapped for a
**stand-in** that renders a marker carrying its export name; its props go into a
side table keyed by a render id. The server markup is then parsed back for
structure only, so props never pass through a string (numbers stay numbers).

**Why server rendering (`react-dom/server`) and not a DOM or a test renderer:**
it needs no new dependency, it is deterministic (effects do not run, nothing
fetches, no timer fires), and `renderToPipeableStream` + `onAllReady` waits for
`lazy()` pages and Suspense. The cost: an app that loads its data in `useEffect`
draws its loading state. The bench apps load data synchronously; an app that
does not needs its data seeded, or the browser path planned for phase 5.

**Matching exports by identity.** The published lib is minified (`Button.name`
is undefined, `VStack.name` is `"u"`), so nothing reads a function name. The
stand-in module is generated from the real module's export table: each export
KEY names its stand-in. Two keys that hold the same value (`Body1` and `Body`)
are recorded as aliases. Constants and helpers pass through as the real values.
`useOmniDesign` and `useHeadingLevel` are answered by the recorder, because the
real ones read the real provider's context.

**Lib behaviors the stand-ins copy** (each one tested — a stand-in draws
nothing, so anything the real component decides about its children has to be
copied, or the snapshot shows the wrong thing):

- a closed overlay renders nothing: Modal, Dialog, AlertDialog, FormDialog,
  Drawer, Popover, Snackbar, Sheet, Menu, SpeedDial (`open !== true`);
- Tabs show only the active TabPanel, and each Tab records `$selected`;
- Section and HeadingLevel raise the heading level; AutoHeading records
  `$level`, which is what it draws when it has no `size`;
- Tooltip renders its trigger only.

**The environment.** Each state gets a small `window`: `matchMedia` answered at
the state's viewport (`min-width`, `max-width`, orientation, color scheme),
`localStorage` / `sessionStorage` seeded from the spec, and `location` from the
route. There is no `document`, so code that needs a real DOM fails loudly
rather than drawing something wrong. Each state imports the app under its own
`?c2f=<n>` query, so module-level state cannot leak between states.

### The snapshot spec

One JSON file per app. Claude or the user writes it; each state is one frame.

```jsonc
{
  "app": "~/omni-bench/omni-r5",                 // relative to the spec file, or ~/
  "entry": { "module": "src/App.jsx", "export": "default" },
  "router": "memory",                            // wrap in react-router-dom's MemoryRouter
  "routePattern": "/p/:slug",                    // optional: render entry inside <Routes><Route path=…>
  "wrap": [                                      // optional providers, outermost first
    { "module": "src/context/CartContext.jsx", "export": "CartProvider", "props": {} }
  ],
  "viewport": { "name": "Desktop", "width": 1280, "height": 800 },
  "mode": "light",                               // what useOmniDesign().isDark reports
  "localStorage": {},                            // seed for every state; values that are not strings are JSON-encoded
  "sessionStorage": {},
  "states": [
    {
      "name": "cart-filled",                     // file name and frame name
      "route": "/cart",
      "description": "Cart with 3 lines",
      "localStorage": { "goods-co-cart": [ … ] } // merged over the top-level seed
      // any top-level key (entry, wrap, routePattern, router, viewport, mode) can be overridden per state
    }
  ]
}
```

---

## Phase 2 — the mapper and the IR

`mapRecorded(recorded, { app, state })` returns a `C2FDocument` (schema.ts). It
is pure and deterministic: the same recording gives the same bytes (tested).

### Document

| Field | Meaning |
| --- | --- |
| `schema` | `"omni-code2figma-ir/1"` |
| `app`, `state` | Where it came from: state name, route, description, viewport `{name, width, height}`, `mode` |
| `library` | `{ fileKey, capturedAt }` of the live capture the variant names were checked against |
| `root` | The frame for this state: VERTICAL, FIXED width = viewport width, modes `.Modes` = `Light-Mode` / `Dark-Mode` and `Devices-Type` = `Desktop`, fill bound to `Background` |
| `coverage` | See [Coverage](#coverage) |
| `normalizations` | Every off-system style drawn as its system equivalent: `{ id, source, message }` |
| `placeholders` | Every node drawn as a placeholder, with the reason |

### Node fields common to every kind

| Field | Meaning |
| --- | --- |
| `id` | Child-index path, stable within one IR (`"0.3.1"`, slot children `"0.3.slot.0"`) |
| `name` | The layer name to give the node. For an icon-only Button it is the `aria-label` — the Figma → code side reads a meaningful layer name as the accessible name |
| `status` | `clean` · `lossy` · `needsTable` · `unmapped` |
| `source` | The lib export, `icon:<Name>`, or `<tag>` it came from |
| `sizing` | `h` / `v`: `FILL` · `FIXED` · `HUG` (absent = HUG or the component's own); `width` / `height` px for FIXED; `minWidth` / `maxWidth` |
| `modes` | Explicit variable modes **on this node**, keyed by the exact collection name in the template, value = exact mode name |
| `absolute` | `{x, y}`: `layoutPositioning = 'ABSOLUTE'` at that offset |
| `notes` | Why it is lossy / a placeholder, and what was normalized |

Collection names as the template has them (from the capture): `.Theme`,
`Surface`, `Buttons`, `Component-Size`, `.Elevation`, `Icons & Avatars`,
`Icons`, `.Modes`, `Devices-Type`. Theme modes are `Default`, `Primary` …
`Error` (the lib's `App-Bar`, `Nav-Bar` and `Status` themes have **no** mode in
the template; the mapper reports them). Buttons modes are lower case
(`default`, `primary` … `black-white`), the same strings as the lib's colors.

### `frame`

| Field | Meaning |
| --- | --- |
| `layout.mode` | `VERTICAL` · `HORIZONTAL` · `GRID` |
| `layout.itemSpacing` | `{ px, variable? }` — bind `itemSpacing` to the FLOAT variable `variable` (`Sizing-2`) when present, else set the px |
| `layout.rowSpacing` | GRID only: the row gap |
| `layout.padding` | `{ top, right, bottom, left }`, each `{ px, variable? }` |
| `layout.primary` / `counter` | `primaryAxisAlignItems` / `counterAxisAlignItems`: `MIN` (absent) · `CENTER` · `MAX` · `SPACE_BETWEEN` · `BASELINE` |
| `layout.wrap` | `layoutWrap = 'WRAP'` |
| `layout.columns`, `gridFallback` | GRID: 12 columns. Where Figma's grid auto-layout is not available, draw `gridFallback` (HORIZONTAL + wrap) with each child FIXED at `span / 12` of the content width minus gaps |
| `gridColumnSpan` | On a child of a GRID frame: columns it spans at this viewport |
| `fill` | `{ variable: "Background" }`: bind the frame's fill. Absent = no fill |
| `children` | Child nodes, in order |

How code becomes frames:

| Code | Frame |
| --- | --- |
| `VStack` / `HStack` / `Stack` / `WrapStack` … | VERTICAL / HORIZONTAL; `spacing` or `gap` × 8 → itemSpacing; `alignItems`, `justifyContent`, `flexWrap`; responsive values read at the viewport width (MUI breakpoints) |
| CSS `align-items: stretch` (VStack's default) | children `FILL` on the cross axis |
| `Section` | VERTICAL, counter CENTER, modes `.Theme` + `Surface` (default `Surface`), fill `Background`, padding by name at Desktop (none 0 · small 40 · medium 64 · large 96 = Sizing-5/8/12, sides 24 = Sizing-3), FILL width |
| `Container` | VERTICAL, side padding 24, FILL, `maxWidth` lg 1200 · md 900 · sm 600 · xs 444 · xl 1536 |
| `Grid container` / `Grid size={{…}}` | GRID, 12 columns, spacing × 8; items carry `gridColumnSpan` read at the viewport |
| `Box` / `Paper` / `ThemedZone` | VERTICAL (block flow) or the flex layout in its style; theme/surface modes; fill when it paints (`ThemedZone` never does); `elevation` → `.Elevation` = `Level-N` |
| `<div>`, `<main>`, `<form>` … | VERTICAL (block) or its `display: flex` layout; `<li>` with one child is skipped |
| `flex: 1 …`, `flexGrow` | FILL on the parent's main axis; a `flex-basis` px becomes `minWidth` |
| `width: 96` / `width: '100%'` | FIXED 96 / FILL |
| `marginTop` / `marginBottom` (in a column), `marginLeft` / `Right` (in a row) | **normalized**: a spacer frame of that size (`name: "Spacer"`, FIXED on the main axis, FILL across) before / after the node |

### `instance`

| Field | Meaning |
| --- | --- |
| `component` | `{ set, key? }` — the set (or lone component) by its template name; `key` is the published library key, for the fallback import only |
| `variant` | Every variant axis → exact value, spelled as the live set spells it (`Non-clickable`, `iconOnly`, `Focus-Visible`) |
| `properties` | BOOLEAN and TEXT component properties by **bare** name (`"start-icon": false`, `"Icon name": "delete"`, `"Selected": true`). Every boolean that matters is written, including `false`, because several default to `true` in the template (Button `start-avatar`, `end-icon`; Chip `Start-Avatar`, `End-Icon`) |
| `text` | Text layers that have no TEXT property, by role — see the role table |
| `nested` | `[{ role, node }]`: instances inside this one that need their own variant / properties (`start`, `end`, `icon` — the icon in a Button or Chip) |
| `slots` | `{ slotName: Node[] }`: children to append into a SLOT of the instance |
| `image` | `{ src, alt?, scaleMode }`: image fill for an Avatar photo or a Ratio |
| `pluginData` | What the code said that has no Figma home (`ariaLabel`, `href`) |
| `code` | Signature of the code it came from (`{c, p, t}`): informational, used by the round-trip test |

What each mapped component draws (the Figma → code tables, inverted):

| Code | Set | Variant / properties / modes |
| --- | --- | --- |
| `Button` | `Button` | `variant` → `Style` (solid / outline / ghost) + mode `Buttons`; `iconOnly` / `letterNumber` / `avatar` → `Type`; `disabled` → `State=Disabled`; `selected` → `Status`; `badge` → `Badge`; decorators → `start-icon` / `start-avatar` / `end-icon` / `end-avatar` + `nested`; `size` → mode `Component-Size`; `fullWidth` → FILL |
| `Checkbox` | `Checkbox` | `checked` / `defaultChecked` / `indeterminate` → `Checked`; `disabled` → `State`; `error` → `Validation`; color → `Buttons`; size → `Component-Size` |
| `Divider` | `Divider` | `orientation`, `colored` → `Color=Colored`; mode `Component-Size` always written (the lib default is small, the collection's is medium) |
| `Avatar` | `Avatar` | `Style` Initials / Photo / Default; `Container=Circle`; size → `Icons & Avatars`; color → `Buttons` |
| `Chip` | `Chip` | `selected`, `disabled`; palette → `Buttons`; decorators → `Start-Icon` … `End-Avatar`; `onDelete` → `Deletable` |
| `Tag` | `Tag` | `color` → `Theme` (capitalized); `width="fill"` → `Fit=Fill` |
| `Card` | `Card` | `orientation`; `clickable` / `onClick` / `href` → `State=Default`, `disabled`, `draggable` → `State=Drag`; `elevated` → `Elevated`; `selected` → `Selected`; `data-theme` / `surface` → `.Theme` / `Surface`; children → slot `Padded Card Content` |
| `Ratio` | `Ratio - Fill Horizontal` (or `- Fill Vertical` for `fit="height"`) | `Ratio`; an `<img>` child → `image`; other children → slot `Ratio Slot` |
| `List` | `List` | `clickable` → `Type`; `orientation`; rows → slot `List Slot` |
| `ListItem` | `List Item` | `clickable` / `onClick` → `State=Default` (else `Non-clickable`), `disabled`, `selected`, `bottomBorder` / `rightBorder`; decorators → slots `Start Decorator` / `End Decorator`; `image` → `Image` |
| an icon (`@omni-design/icons/<Name>`) | `Icon` | `Style`: Default / Round (`…Rounded`) / Sharp (`…Sharp`); property `Icon name` = the ligature (`ChevronRightRounded` → `chevron_right`); inside `<Icon color size>`: modes `Icons` and `Icons & Avatars` |

### `text`

| Field | Meaning |
| --- | --- |
| `characters` | The text |
| `textStyle` | Exact local text style name: `Display-Large`, `H2`, `Subtitle-Medium`, `Body-Medium`, `Body-Small`, `Caption-Medium`, `Eyebrow-Medium`, `Number-Medium`, `Number Small` … (table: `EXPORT_TO_TEXT_STYLE`) |
| `fill` | `{ variable }` to bind the text fill: `Quiet`, `Text-Primary` … `Text-Error` (from the `color` prop) |
| `align` | `CENTER` / `RIGHT` from `textAlign` |
| `decoration` | `STRIKETHROUGH` / `UNDERLINE` — an inline style kept literally (lossy) |

`AutoHeading` draws its `size`, else `h<level>` from the Sections around it.
`fontWeight: 700` on `Body` / `BodySmall` / `BodyLarge` is **normalized** to
`Subtitle-Medium` / `-Small` / `-Large` (Body has no bold; Subtitle is Body at
700); `600` to the `-Semibold` style. Inline links or bold runs inside a text
are flattened into one layer (lossy).

### `image`

`{ image: { src, alt?, scaleMode } }` — a raw `<img>` outside a Ratio. Draw a
rectangle with an image fill.

### `placeholder`

A labeled frame for what nothing in the template draws yet:
`{ component, figmaSet?, reason, layout, children }`. `needsTable` placeholders
name the template set that exists (`figmaSet`: `Input Field`, `Rating`, `Link` …)
but has no prop table yet; `unmapped` ones have no Figma counterpart
(`StateMessage`, `SearchField`, a raw `<button>`). Their children are mapped
normally and drawn inside, so content is not lost.

### Example

The remove button in a cart row:

```json
{
 "id": "0.0.1.0.0.0.0.2.1", "name": "Remove Linen Throw from cart", "kind": "instance", "status": "clean", "source": "Button",
 "component": { "set": "Button", "key": "bd328086c5e56443043e1ba28011c4c61bfc019a" },
 "variant": { "State": "Default", "Status": "unselected", "Style": "ghost", "Type": "iconOnly" },
 "properties": { "start-icon": false, "start-avatar": false, "end-icon": false, "end-avatar": false, "Badge": false },
 "nested": [{ "role": "icon", "node": { "kind": "instance", "component": { "set": "Icon", "key": "831be5e2…" }, "variant": { "Style": "Default" }, "properties": { "Icon name": "delete" }, "…": "…" } }],
 "pluginData": { "ariaLabel": "Remove Linen Throw from cart" }
}
```

### The tables run both ways

Nothing here is a second copy of the Figma → code rules:

| Direction-neutral table (propTables.ts) | Figma → code reads | Code → Figma reads |
| --- | --- | --- |
| `VARIANT_TABLES` — value keys spelled exactly as the live set; `draw` = the value drawn when the code sets none of the row's props; rows without `draw` are older files' axes, read only | `applyVariantTable` | `invertVariantTable` |
| `TEXT_STYLE_TO_EXPORT` / `EXPORT_TO_TEXT_STYLE` (tested to agree) | style → export | export → style |
| `buttonVariant` / `splitButtonVariant` (figmaModeMapping.ts) | Style + mode → variant | variant → Style + mode |
| `iconComponentName` / `iconGlyphFromComponent` | glyph → component | component → glyph |
| `SIZING_TOKENS`, `THEMES`, `SURFACES` | px → token | px → token |

Every inverse is tested to give its input back, and every drawn value is tested
to exist in the live capture.

### Coverage

Each drawn node gets one status; providers and other pass-through components
(`OmniDesignProvider`, `HeadingLevel`, `TabList`, `TabPanel`) are not counted.

| Status | Meaning |
| --- | --- |
| `clean` | Drawn with the system's own component, style and tokens. Includes **normalized** nodes (a spacer for a margin, Subtitle for bold Body), which are listed in `normalizations` |
| `lossy` | Drawn, but something the code said is not in Figma — each one has a note |
| `needsTable` | The template has a set; there is no prop table yet. Placeholder naming the set |
| `unmapped` | Nothing in the template draws it. Placeholder |

`coverage.cleanRatio` = clean / counted. `cleanRatioStrict` counts normalized
nodes as lossy, which is how the 2026-11-06 prototype counted margins and bold
Body, so the two numbers compare.

---

## Results on omni-r5 (2026-11-06)

**Page only** (`omni-r5.pages.omni-snapshots.json` — the prototype's scope):

| State | Drawn | Clean | Lossy | Needs table | Unmapped | Clean | Strict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 186 | 167 | 2 | 17 | 0 | 90% | 89% |
| Product | 120 | 87 | 8 | 21 | 4 | 73% | 72% |
| Cart, 3 lines | 66 | 62 | 0 | 4 | 0 | 94% | 86% |
| Cart, empty | 5 | 4 | 0 | 0 | 1 | 80% | 80% |
| Checkout | 40 | 31 | 0 | 9 | 0 | 78% | 73% |
| **All five** | **417** | **351** | **10** | **51** | **5** | **84%** | **82%** |

The prototype measured **76%** clean on the same states. The gain is List /
ListItem / Avatar wired in, parts passed through (TabList, TabPanel,
HeadingLevel), and Tag drawn from its live set.

**Whole app** (`omni-r5.omni-snapshots.json` — header and footer included):
457 drawn, 376 clean (**82%**, strict 80%), 10 lossy, 61 need a table, 10 unmapped.

What is left, all five states of the whole app: Rating 13, Link 12, TextInput 6,
AppBar 5, Footer 5, NumberField 4, Breadcrumbs + BreadcrumbItem 4, Tab / Tabs 4,
Step / Stepper 4, Swatch 3, Select 1 (need a table); SearchField 5, raw
`<button>` 4, StateMessage 1 (unmapped); bare text inside placeholders 6 and
`line-through` prices 4 (lossy). With tables for the needs-table sets, about 96%
of these pages would be clean.

---

## Phase 0 — the live capture and what drifted

`figmaLibrary.live.json` was read from the library file
(`Qv2dqF7mYoAGY77EkdrwTv`) through the Plugin API, read-only: 103 component sets
with their variant axes and component properties (with `#id` suffixes), 24 lone
components, 59 text styles, 23 variable collections with their modes, and the
Sizing variables. Add-on pages, scratch pages and the Status Bar device-chrome
sub-sets were skipped.

To refresh it, run this read-only script with the Figma MCP `use_figma` tool on
the library file, then rebuild the JSON (keep the `_comment` and `capturedAt`):

```js
const sets = []; const lone = [];
const props = (o) => { const a = {}, p = {}; for (const [k, d] of Object.entries(o.componentPropertyDefinitions || {})) {
  if (d.type === 'VARIANT') a[k] = { values: d.variantOptions, default: d.defaultValue }; else p[k] = { type: d.type, default: d.defaultValue }; } return { axes: a, properties: p }; };
for (const page of figma.root.children) {
  await page.loadAsync();
  for (const s of page.findAllWithCriteria({ types: ['COMPONENT_SET'] }))
    sets.push({ page: page.name, name: s.name, id: s.id, key: s.key, variants: s.children.length, defaultVariant: s.defaultVariant?.name ?? null, ...props(s) });
  for (const c of page.findAllWithCriteria({ types: ['COMPONENT'] }).filter((c) => c.parent?.type !== 'COMPONENT_SET'))
    lone.push({ page: page.name, name: c.name, id: c.id, key: c.key, properties: props(c).properties });
}
return { sets, lone };
// text styles: (await figma.getLocalTextStylesAsync()).map((s) => s.name)
// collections: (await figma.variables.getLocalVariableCollectionsAsync()).map((c) => ({ name: c.name, modes: c.modes.map((m) => m.name) }))
```

**Drifts fixed in the Figma → code tables** (all with tests; the existing
golden snapshots are byte-identical):

| Set | Was | Live | Fix |
| --- | --- | --- | --- |
| Card | `Elevation=elevated` | `Elevated=true\|false`, `State=Drag`, `Selected` boolean | `Elevated` → `elevated`; `Drag` → `draggable` (not clickable); `Selected` → `selected`. Old axes still read |
| Card | content slot as a direct child | `Card Container > Card Content > Padded Card Content` | the slots' children are the card's |
| List Item | `Beginning Slot` / `Text` / `End Slot` as children; `Type` axis | under a `Content` frame: `Start Decorator` / `Text` / `End Decorator`; clickable is `State` (Non-clickable vs the rest); `Selected`, `Image` booleans; border `Divider` layers | all read; `State=Non-clickable` was reported as unmapped before |
| List | rows as children | rows in `List Slot` | read |
| Ratio | `Content Slot` | `Ratio Slot` | read |
| Tag | `Color` axis | `Theme` axis (Default … Neutral), `Fit` Hug / Fill | `Theme` → `color`, `Fit=Fill` → `width="fill"` |
| Button | — | `Badge` boolean | → `badge` |
| Checkbox | `State=error` | `Validation` boolean | → `error` |
| Divider | — | `Pill` boolean | `false` read; `true` reported (pill text not mapped) |
| Avatar | — | `Container` Circle / Shape | `Circle` read; `Shape` reported |
| Icon | — | `Icon name` TEXT property | read (consumed) |
| Text styles | `caption` | `Caption-Medium` (+ Small / Large, -Bold) | `Caption-Medium` → Caption, `Caption-Medium-Bold` → CaptionBold |

**Drifts listed, not fixed:**

- **Box**: the live set's axis is `Fit` (Ratio / No Ratio) with a Content Slot;
  the table reads an older `Radius` axis. `Fit` is reported as unmapped on every
  Box instance. What `Fit` should mean in code needs an owner decision.
- **Caption-Small / Caption-Large / -Bold**, `Label-*-All-Caps`, `Dynamic-*`,
  `Badge`, `Button-Numbers`, `Avatar-Initials`, `Mobile Nav Label*`: live text
  styles with no lib export. They still compile as a FALLBACK.
- **Input** split into `Input Field`, `Input`, `InputContent`, `Input Decorator`
  and `Validation Frame`; `Checkbox Field`, `SelectField`, `RatingField` …: no
  Figma → code table reads the Field sets yet.
- **Theme collection** has no `App-Bar`, `Nav-Bar` or `Status` modes, though the
  lib has those themes.
- **Button** has no `Size` or `Elevation` axis any more (size is the
  Component-Size mode; elevation has no Figma home). The old rows stay, read-only.
- The old fixture `src/__tests__/__fixtures__/figmaComponentSets.json`
  (2026-09-30) is left as it is: `figmaComponentMap` tests key on it. The live
  capture is a separate file.

---

## Phase 3 — what the plugin needs to do

A new plugin command, "Build from code", takes one `<state>.ir.json` and builds
its `root` frame on the current page. Everything below is decided by the IR;
the plugin makes no design choices.

### 1. Find the components in the user's copy of the template

Build into the user's copy (owner decision 1): its components are LOCAL, and
the user's brand lives in its local variables. Do not import from the published
library — library instances would bind to the library's variables.

1. Index the file once: `findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })`
   on every page (load each page with `page.loadAsync()`), keyed by
   `name.trim()`. Keep lone COMPONENTs only when their parent is not a set.
2. Look up `component.set` by name. Where a name occurs more than once (`Icon`
   is on the Icon page and the IconBadge page; `Column` is on Table twice),
   prefer the set whose variant axes include every axis the IR's `variant`
   names, then the one on the page the capture lists for it.
3. **Verify, don't trust the name**: every `variant` axis must be in the set's
   `componentPropertyDefinitions` with that exact value. If not, the copy has
   drifted from the capture — draw a placeholder and report it; never pick a
   nearby value.
4. Only when the file has no set of that name, fall back to
   `importComponentSetByKeyAsync(component.key)` (needs the library enabled and
   published after the change) and say so in the report.
5. After the first build, the plugin's own stamp is the fastest path: nodes it
   created carry `sharedPluginData('dino', 'aaid')` with `component`, so a
   rebuild can match by that before matching by name.

### 2. Instances

1. Pick the variant: the child COMPONENT whose `variantProperties` equal
   `variant` exactly; `createInstance()` on it. (Or the default variant, then
   `setProperties(variant)`.)
2. `properties`: map each bare name to the full key with its `#id` from the
   set's `componentPropertyDefinitions` (owner-narrowed: read them on the SET,
   never on a variant), then one `setProperties` call.
3. `nested`: the role says which inner instance — `start` is the first Icon (or
   Avatar) instance inside, `end` the last, `icon` the only one. Set its variant
   and properties (`Icon name`) on that inner instance.
4. `text` roles (layers without a TEXT property; load the layer's own fonts
   with `getStyledTextSegments(['fontName'])` before setting `characters`):

   | Set | Role | Layer |
   | --- | --- | --- |
   | Button, Chip | `label` | the first TEXT that is not inside an Icon instance |
   | Tag | `label` | the TEXT child (`Component Name`) |
   | Avatar | `initials` | the TEXT inside |
   | List Item | `eyebrow`, `title`, `secondary` | the three TEXT layers of `Content > Text`, in that order; hide the ones the IR does not give |
   | Checkbox | `label` | not in the set: draw a `Checkbox Field` (`Label=label-right`) holding the Checkbox, and put the label there |

5. `slots`: find the SLOT node by name inside the instance (`Padded Card
   Content`, `List Slot`, `Ratio Slot`, `Start Decorator` …) and append the
   built children into it. An instance with no slot of that name cannot take
   children: draw a placeholder and report it.
6. `image`: fetch `src` and fill the instance (Avatar) or its slot (Ratio). The
   manifest's `networkAccess.allowedDomains` must list the image hosts
   (`picsum.photos` for the bench), or the studio fetches the bytes and passes
   them in for `figma.createImage`.
7. `name` → the layer name. `pluginData` → `setSharedPluginData('dino', …)`.

### 3. Frames, placeholders, text, images

- Frames: `figma.createAutoLayout(direction)`. `itemSpacing` / padding: set the
  px, then `setBoundVariable(field, variable)` with the local FLOAT variable
  named `Sizing-N` when `variable` is present. `primary` / `counter` → the two
  align properties; `wrap` → `layoutWrap = 'WRAP'`.
- GRID: `layoutMode = 'GRID'` with 12 columns and the two gaps where the
  running Figma has grid auto-layout; else `gridFallback`, each child FIXED at
  `span / 12` of the inner width minus the gaps.
- `fill.variable` → a solid paint bound with `setBoundVariableForPaint` to the
  local COLOR variable of that exact name (`Background`, `Quiet`, `Text-Primary`).
- Sizing: append the node to its parent FIRST, then set
  `layoutSizingHorizontal` / `Vertical`; `resize()` before setting FILL / HUG;
  `minWidth` / `maxWidth` directly. `absolute` → `layoutPositioning = 'ABSOLUTE'`, then `x` / `y`.
- Modes: `setExplicitVariableModeForCollection(collection, modeId)` with the
  local collection of that exact name and its mode of that exact name. A
  collection or mode the file lacks is reported, not failed. Mind the 10-mode
  cap — the IR never needs a new mode.
- Text: `createText()`, `setTextStyleIdAsync` with the local text style of that
  exact name (load its font first), `characters`, `textAlignHorizontal`,
  `textDecoration`; FILL width when `sizing.h` says so, with
  `textAutoResize = 'HEIGHT'`.
- Images: a rectangle with an image fill, `scaleMode` as given.
- Placeholders: a frame named for `component`, with a dashed border and a small
  label "`component` — `reason`", then its children.

### 4. Stamp every node

`setSharedPluginData('dino', 'aaid', JSON.stringify(note))` on every node the
plugin creates, where `note` is exactly the inline keys
`irToFigmaNode()` (roundTrip.ts) puts on that node: `component`, `variant`
(variant values plus boolean properties as `"true"` / `"false"`), `modes`,
`layout` (`mode`, `gap`, `padTop` … `padLeft`, `primaryAxis`, `counterAxis`,
`wrap`), `sizingH`, `sizingV`, `boundVars`. That is the same note the
Figma → code compiler reads (`readNote` in `src/utils/aaid/ir.ts`), so a frame
built from code compiles straight back. The round-trip test already runs that
loop with the plugin simulated by `irToFigmaNode`.

### 5. Report back

Show the IR's `coverage`, every `normalization` and every placeholder, plus
anything the build itself could not do (a missing set, a drifted variant, a
missing slot, a mode the file lacks, an image that did not load).

---

## Limits

- Effects do not run (server rendering). Data loaded in `useEffect` shows as its
  loading state until it is seeded or the browser path exists (phase 5).
- One frame per state per viewport. Desktop (1280) only so far; Tablet and
  Mobile are a second run with another `viewport` (and `Devices-Type` mode).
- `className` and arbitrary CSS are not read (no browser). Three uses in the
  bench apps.
- Repeated rows (`.map`) are drawn as independent instances, not as a local
  component.
- The stand-ins copy four lib behaviors. A lib component that decides about its
  children in another way needs adding to `record.ts`, with a test.
