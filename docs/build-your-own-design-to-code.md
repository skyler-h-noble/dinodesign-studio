# Build your own design-to-code tool

How to point an AI agent at a Figma frame and get back code that uses **your**
component library — not generic HTML, not Material, not a guess.

This is a writeup of a working tool, generalised. The version I built targets my
own design system; this describes how to build the same thing for any library.
The running example is the **VS Code / Visual Studio Code Design Toolkit**,
because it is public, has a real Figma library, and has a matching code library
([`@vscode/webview-ui-toolkit`](https://github.com/microsoft/vscode-webview-ui-toolkit)).
Substitute your own throughout.

---

## The thing that actually matters

Almost every "Figma to code" tool produces a `<div>` soup that *looks* right and
uses none of your components. That is not a model quality problem. It is a
context problem: the model was given a picture and no vocabulary.

The fix is unglamorous:

> **Give the model your component list, your token names, and your rules — and
> give it the frame as structured JSON rather than as an image.**

Everything below is in service of those two things. If you only take one idea,
take this one: **a screenshot is the worst possible input.** The Figma REST API
will hand you the actual node tree — names, auto-layout, spacing, fills bound to
variables, component instances with their variant properties. That is a spec.
A PNG is a rumour.

---

## Architecture

Four pieces, none of them large.

```
Figma frame URL
      │
      ▼
1. Fetch      GET /v1/files/:key/nodes?ids=…      → node tree JSON
      │       GET /v1/images/:key?ids=…           → PNG (reference only)
      ▼
2. Prune      drop invisible nodes, flatten noise, keep variant props
      │
      ▼
3. Prompt     node JSON + YOUR component catalogue + YOUR rules
      │       → LLM
      ▼
4. Render     compile the returned JSX in-browser and show it beside the frame
```

Steps 1 and 4 are plumbing. **Steps 2 and 3 are the product.**

---

## 1. Fetch the frame

A Figma URL looks like:

```
https://www.figma.com/design/<fileKey>/<name>?node-id=123-456
```

Parse out `fileKey` and `node-id`, and note that the URL uses `123-456` while
the API wants `123:456`. Then:

```ts
const res = await fetch(
  `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`,
  { headers: { 'X-Figma-Token': personalAccessToken } },
);
```

A personal access token with `file_read` is enough. Users generate their own at
**figma.com/developers/api#access-tokens**.

Two things to get right early:

- **Cache aggressively.** PATs are rate limited (roughly 30 requests/minute).
  Cache the fetched node tree in `localStorage` keyed by `fileKey:nodeId` with a
  ~1 hour TTL. While you are tuning prompts you will convert the same frame
  fifty times, and none of those need a network call.
- **Fetch the image too, but only as a reference pane.** It is for the human
  comparing output side by side. Do not send it to the model as the primary
  input.

Also fetch **variables** (`/v1/files/:key/variables/local`) if your Figma library
binds fills and spacing to variables. That mapping — variable name → your CSS
custom property — is the single highest-value piece of context you can supply.

---

## 2. Prune the node tree

Raw Figma JSON for one screen can be hundreds of KB. Most of it is noise, and
noise is not neutral — it costs tokens and it actively misleads.

What to drop:

- **Invisible nodes.** `visible === false` means the designer turned it off. It
  must not appear in the output. This one caused a real bug for me: a list
  component had three rows with two hidden, and the generated code rendered all
  three. Prune recursively, and never prune the root.
- Vector geometry, `absoluteRenderBounds`, `effects` you do not support,
  `constraints`, empty groups.

What to **keep**, because it is load-bearing:

- `name` — designers name layers meaningfully, and names often map directly to
  component names.
- `layoutMode`, `itemSpacing`, `padding*`, `primaryAxisAlignItems` — this is the
  flex/stack structure. It is the difference between a real layout and absolute
  positioning.
- `componentProperties` on instances — **the variant values**. If a button
  instance says `Size=Small, Appearance=Secondary`, the generated code must say
  `size="small" appearance="secondary"`. Read *every* variant of *every*
  instance and map each one.
- `boundVariables` — the token bindings. Gold.
- Bounding boxes **where sizing is fixed**. If a node is FIXED rather than
  Hug/Fill, the exact px matters; hugging is a layout rule, not a number.

---

## 3. The prompt — this is the whole ballgame

Structure it in four parts.

### a. The component catalogue

An explicit list of what exists, with props. Not "use the VS Code toolkit" — the
model will hallucinate a plausible API. Give it the real one:

```
Available components (import from '@vscode/webview-ui-toolkit/react'):

VSCodeButton      appearance: primary | secondary | icon
VSCodeTextField   placeholder, value, disabled, readonly
VSCodeDropdown    + VSCodeOption children
VSCodeCheckbox    checked, disabled
VSCodeDataGrid    + VSCodeDataGridRow, VSCodeDataGridCell
VSCodePanels      + VSCodePanelTab, VSCodePanelView
VSCodeProgressRing
VSCodeDivider
VSCodeTag
VSCodeLink
```

**Generate this list from the package, not by hand.** A hand-maintained
catalogue drifts, and the failure is silent: the model emits a component that
does not exist and you find out at runtime. I shipped a prompt listing a
component the package had stopped exporting; nothing caught it.

### b. The token vocabulary

Same principle for colour and spacing. For VS Code, that is the theme variables:

```
Never write a hex value. Use VS Code theme variables:
  var(--vscode-button-background)
  var(--vscode-button-foreground)
  var(--vscode-editor-background)
  var(--vscode-foreground)
  var(--vscode-panel-border)
  var(--vscode-focusBorder)
```

If your Figma variables are named to match, say so explicitly — "a fill bound to
`button/background` becomes `var(--vscode-button-background)`". That single
mapping sentence removes most colour errors.

### c. The rules

Short, imperative, and each one earned. Mine, generalised:

```
1. Every element that a library component covers MUST use that component.
   No raw <button>, <input>, <select>.
2. Layout-only <div> with display:flex is fine. Nothing else.
3. Never write a hex colour or a hard-coded radius. Use the variables above.
4. Read EVERY variant of every instance and map it to props.
5. A node with visible:false is NOT rendered.
6. FIXED sizing → set the exact px. Hug/Fill → let layout do it.
7. If a component does not exist for something, emit a plain element and add
   // MISSING-COMPONENT: <name> above it. Do not invent an import.
```

Rule 7 matters more than it looks. Without an escape hatch the model invents
components. With one, gaps become a grep-able list — and that list is your
library's roadmap.

### d. The frame

The pruned JSON. Last, after the rules, so the instructions are not buried.

---

## 4. Render it back

Compile the returned JSX in the browser and show it next to the Figma image.
`react-live`, or `new Function` over a Babel-transformed string with your
components in scope.

This is not a nicety. **Side-by-side is what makes the loop converge.** Reading
generated code tells you it looks reasonable. Seeing it 8px off, or in the wrong
grey, tells you which rule to add. Almost every rule in my list came from
looking at a rendered diff, not from reading code.

---

## 5. Close the loop

Add two buttons — 👍 / 👎 — and a free-text box: *"what was wrong, or what would
you have written instead?"* Log the frame URL, the prompt version, the output
and the correction.

Then read them in batches and turn recurring corrections into rules. The
catalogue and the rules are the product; conversions are how you discover them.

---

## What this costs

Smaller than it sounds:

| Piece | Rough size |
| --- | --- |
| Figma URL parsing + fetch + cache | ~120 lines |
| Pruning | ~80 lines |
| Prompt assembly | ~200 lines, mostly the catalogue |
| Live preview | ~100 lines |
| Feedback logging | ~60 lines |

The prompt is the part you will iterate on for weeks. Everything else you write
once.

---

## Traps

**A screenshot is not input.** Covered above, and it is the mistake most tools
make.

**Hand-maintained catalogues drift.** Generate from the package's exports.

**Invisible nodes render.** Check `visible === false` and prune recursively.

**Variants get flattened.** If you only read the instance name and not
`componentProperties`, every button comes out as the default variant and the
output looks *nearly* right — which is worse than obviously wrong.

**Rate limits arrive faster than you expect.** Cache from day one.

**"Looks right" is not right.** A generated card with hardcoded `#3794ff`
renders identically to one using `var(--vscode-focusBorder)` — until the user
switches to a light theme. Grep the output for `#` and fail loudly.

---

## The direction that does not work

Code → Figma is **not** symmetric, and it is worth knowing before you promise it.

Figma's REST API is **read-only for document content**. There is no endpoint
that creates a frame. Writing to a file is only possible from inside a Figma
**plugin**, via the Plugin API (`figma.createFrame()`, `figma.createComponent()`,
and instancing from a team library).

So a browser tool can parse code, resolve which components it uses, and emit a
build payload — but the frame has to be constructed by a plugin you also ship,
which receives that payload. Plan for two artifacts, not one.

---

## Why this generalises

Nothing above depends on my design system. It needs:

1. A component library with a **finite, enumerable** set of components.
2. A **token vocabulary** — CSS variables, theme keys, anything named.
3. A Figma library whose components **correspond** to the code ones.

The VS Code toolkit has all three, which is why it makes a good example. So does
Fluent, Carbon, Spectrum, Material, or an internal library nobody outside your
company has heard of. The tool is the same; only the catalogue and the rules
change.

The closer the Figma library and the code library correspond, the better this
works — and if they correspond *exactly*, you can stop asking a model to guess
and compile the mapping deterministically instead. That is the end state. An LLM
is how you get there while the correspondence is still loose.
