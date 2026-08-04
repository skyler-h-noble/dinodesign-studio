# Plugin Mode-Resolution → AAID — Architecture & Patent Additions

> How non-Enterprise users get accurate, low-code design→code without Dev Mode,
> Code Connect, or the Enterprise Variables API. Architecture logic + new claims
> to add to `Draft Spec(151962011.1).docx`, extending the AAID block (62–72),
> the conversion block (95–100), and the code-reduction additions (142–149).
> **Not legal advice — for patent counsel review.**

---

## Part 1 — The logic (architecture)

### 1.1 The problem (background for the spec)
Converting a design-tool frame to design-system code requires knowing each
layer's *semantic* settings — which theme, which surface, which elevation, and
whether a dimension hugs/fills/is-fixed. On the host platform (Figma) those
settings are encoded as **variable modes** and **layout-sizing modes**, but they
are not reliably available to an AI coding agent:

1. **Mode names are gated.** The REST endpoint that maps mode-IDs to names
   (`/v1/files/:key/variables/local`) requires an **Enterprise** plan and a
   `file_variables:read` scope. Most users don't have it.
2. **Code Connect requires Dev Mode** — a paid seat. Excludes free users.
3. **Mode *count* is plan-capped** — Starter ≈ 1, Professional 10, Organization
   20, Enterprise 40 per collection. Free files cannot even hold a multi-mode
   theme system.

Consequence: an agent reading the frame (raster or REST) must **guess** theme/
surface/sizing from rendered pixels — producing wrong tokens (e.g. a coral fill
guessed as "Tertiary" when it is "Primary") and bloated, brand-frozen inline
styles.

### 1.2 The method (end to end)
A design-tool **plugin** — which runs inside the editor with **standard,
non-Enterprise plugin permissions on every plan including free, and without Dev
Mode** — resolves the semantics *locally* and persists them so a
non-privileged downstream consumer can read them.

**A. Resolve (in the plugin, via the Plugin API).** For each node:
- `explicitVariableModes` + the collection's modes → the **explicitly-set** mode
  *names* (Theme=Primary, Surface=Auto, Effects=Level-N);
- `resolvedVariableModes` → the **effective** (inherited) value, so inherited
  axes are known without being emitted;
- `boundVariables` → the **names** of variables bound to properties (fills, etc.);
- `layoutSizingHorizontal` / `layoutSizingVertical` → **HUG / FILL / FIXED**;
- `componentProperties` / `variantProperties` → instance semantics (elevation
  Level, Ratio fit, etc.).

**B. Persist ("Prep File for AI Coding").** The plugin walks the selection (or
page), and for each node:
- writes the resolved values as **shared plugin metadata** on the node
  (`setSharedPluginData(namespace, key, json)`) — a hidden, render-free note;
- **suppresses inherited ("Auto") axes** — it persists only explicitly-set axes
  plus the resolved effective value, so the downstream emitter omits inherited
  attributes (inheritance is reconstructed from ancestors);
- clears prior notes before writing (idempotent re-runs);
- optionally **copies a paste-ready payload** (the enriched node tree + a
  reference to the AAID) and/or the shareable file link.

**C. Consume (two paths).**
- **REST path (token-holding consumer, e.g. the tuning workbench):** fetch the
  node with the **shared-plugin-data parameter** (`?plugin_data=shared`); the
  response now carries the resolved notes; the converter emits code
  deterministically — no guessing.
- **Static-artifact path (end-user AI client):** the user pastes the enriched
  payload + is given the **AAID** (the static naming-convention/rules document,
  per claim 62) as context; the agent emits design-system code with **no live
  server** — consistent with the AAID's "avoid live MCP infrastructure" design.

**D. Render.** Theme/surface are applied in code through the **data-attribute
cascade** (`data-theme` / `data-surface`), not through host-platform variable
modes — so theme switching works at runtime **independent of the platform's
per-plan mode cap**.

### 1.3 Free-tier fallback
For a Starter file limited to a single mode, the design carries **one mode**
(the user's chosen theme); the plugin still stamps the **resolved** theme/
surface, and the code cascade themes correctly. The user loses in-editor
multi-mode switching but keeps full, accurate design→code — so the capability is
**available on every plan**.

### 1.4 Why it's novel / the value
- **Local resolution bypasses the Enterprise gate** — mode *names* obtained
  through the plugin API, persisted as shared metadata a non-privileged REST
  consumer can read, so accurate modes reach the agent with **no Enterprise plan
  and no Dev Mode**.
- **Auto-suppression** → minimal, inheritance-correct output.
- **Deterministic, not heuristic** → eliminates the fill-color-guessing error.
- Feeds the **one-attribute-pair → token-bundle** reduction (claims 142–149).

```
Plugin (any plan, no Dev Mode)
  └─ resolve modes/sizing/variants to NAMES (Plugin API)
  └─ stamp nodes (shared plugin data, Auto suppressed)        ── "Prep File for AI Coding"
        │
        ├─ REST consumer: GET …/nodes?plugin_data=shared ─→ converter ─→ code (deterministic)
        └─ AI client: paste enriched payload + AAID (static) ─→ code (no live server)
                                                                   │
                                                   runtime: data-theme/data-surface cascade
```

---

## Part 2 — Claims to add

> Style/numbering follow the spec; 150–158 extend the AAID block (62–72), the
> conversion/adoption block (95–100), and the code-reduction additions (142–149).

### Summary

| # | Type | Claim | Anchor |
|---|---|---|---|
| 150 | independent | Plugin resolves modes/sizing to names locally and persists them as shared node metadata a non-privileged consumer can read | new |
| 151 | dependent | Suppress inherited (Auto) axes; persist only explicit + resolved effective value | 150 |
| 152 | dependent | Also persist HUG/FILL/FIXED sizing and instance variant props (elevation level) | 150 |
| 153 | dependent | Persist bound-variable names, not opaque IDs | 150 |
| 154 | independent | Recover stamps via the shared-plugin-data API parameter; prefer them over appearance inference | new |
| 155 | dependent | Fallback: match resolved fill to the theme whose background token equals it | 154 |
| 156 | independent | Plan-independent, dev-mode-free design→code; theming via data-attribute cascade, not modes | new |
| 157 | dependent | A single-mode free file renders multiple themes via the cascade + stamp | 156 |
| 158 | dependent | Plugin produces a paste-ready AAID payload (enriched tree + AAID ref) to clipboard, no live server | 62 |
| 159 | independent | Code→design: parse code, instantiate same-named components, assign the variable mode for each theme/surface pair, set elevation/sizing modes — standard permissions, no dev mode | new |
| 160 | dependent | Attribute-pair→mode assignment needs no mapping layer | 159 |
| 161 | dependent | Plugin assigns pre-existing modes (within any plan's cap), does not create them | 159 |
| 162 | dependent | Lossless round-trip: design→code→design (or the reverse) is structurally equivalent | 159 |


**150. (independent) — Local mode-resolution to shared metadata.**
A method for preparing a design-tool document for design-system code generation,
comprising, in a plugin executing within the design tool under standard
(non-administrative, non-Enterprise) permissions and without a code-inspection
("dev") mode: for each of a plurality of nodes, resolving the node's variable-
collection mode assignments and layout-sizing modes to human-readable names
using the design tool's in-process plugin interface; and persisting the resolved
names as shared, render-free metadata on the node, such that a subsequent
consumer lacking access to the design tool's privileged variable-resolution API
can recover the node's theme, surface, effect, and sizing semantics by reading
said metadata.

**151.** The method of claim 150, wherein resolving comprises distinguishing
**explicitly-assigned** axes (from the node's explicit variable-mode map) from
**inherited** axes (from the node's resolved variable-mode map), and persisting
only the explicitly-assigned axes together with the resolved effective value,
such that a downstream emitter omits attributes for inherited axes and
reconstructs them from ancestor context.

**152.** The method of claim 150, wherein the persisted metadata further
includes, per node, a layout-sizing classification of fixed, hug, or fill for
each axis, derived from the node's layout-sizing properties, and one or more
instance variant-property values including an elevation level.

**153.** The method of claim 150, wherein the persisted metadata further
includes, for a property bound to a design-system variable, the variable's name
rather than an opaque identifier, such that the consumer maps the property to a
named design-system token without the privileged variable-resolution API.

**154. (independent) — Non-privileged recovery via shared metadata parameter.**
A design→code conversion method comprising: requesting, from a design tool's
content API, a node representation accompanied by a shared-plugin-metadata
parameter that causes the response to include metadata previously written to the
nodes by a plugin per claim 150; and generating design-system code for each node
using the recovered theme, surface, effect, and sizing names in preference to
values inferred from the node's rendered appearance, thereby eliminating
appearance-based inference of design-system semantics.

**155.** The method of claim 154, wherein, absent recovered metadata for a node,
the method falls back to inferring the node's surface or theme by matching the
node's resolved fill value to a design-system theme whose background token
equals said value, the design-system token definitions being available to the
converter independently of the design tool.

**156. (independent) — Plan-independent, dev-mode-free design→code.**
A method of enabling design→code generation for users of a design tool across
all subscription tiers, including a free tier whose per-collection variable-mode
count is insufficient to encode a multi-theme system, comprising: encoding the
design system's themes and surfaces in code as a data-attribute cascade resolved
at render time rather than as design-tool variable modes; representing each
node's intended theme and surface as shared plugin metadata per claim 150; and
generating code that applies theme and surface via said data attributes — such
that theme switching operates at runtime independently of the design tool's
per-tier variable-mode limit and without a paid code-inspection mode.

**157.** The method of claim 156, wherein a free-tier document carrying a single
variable mode is nonetheless rendered in multiple themes by the generated code
through the data-attribute cascade, the node's intended theme being taken from
its shared plugin metadata.

**158. (dependent on claim 62) — Paste-ready static AAID payload.**
The AI-agent integration method of claim 62, wherein a design-tool plugin
produces, on a single user action, a self-contained context payload comprising
(i) a normalized node tree annotated with resolved theme, surface, effect, and
sizing names per claim 150 and (ii) a reference to or copy of the AI Agent
Integration Document, and places said payload on the system clipboard for the
user to provide to an AI coding agent, such that the agent generates design-
system code from the payload without a live server connection to the design tool.

---

## Part 3 — Reverse direction (code → design)

### 3.1 The logic
Because both sides use one naming vocabulary, code→design is the same mapping run
backwards — run by the plugin, since the design tool exposes no public REST
*write* API for building nodes. A single shared mapping table drives both
directions so they cannot drift.

| Design → code (Parts 1–2) | Code → design (reverse) |
|---|---|
| stamp resolves a Mode; converter reads it | parse a code element; plugin **assigns** the Mode |
| `Theme: Primary` → `data-theme="Primary"` | `data-theme="Primary"` → set node Theme mode = Primary |
| `Surface: Auto` → omit attribute | omitted attribute → leave Surface inherited (Auto) |
| `Effects: Level N` → `elevation={N-1}` | `elevation={N}` → set Effects = Level N+1 |
| layout-sizing FILL/HUG/FIXED → fill/omit/px | `width:100%`/none/`200` → set layout-sizing mode |
| named component → emit | named component → **instantiate** same-named design-tool component |
| auto-layout → gap/padding/justify | gap/padding/justify → set auto-layout |

Three steps: **parse** the code into the same normalized intermediate (the
inverse of the converter); **build** in the plugin (instantiate same-named
components, assign theme/surface/effect/sizing modes, set auto-layout, nest
children); done. Surfaced via a third plugin action — **"Build Design from
Code"** — mirroring "Prep File for AI Coding."

### 3.2 Why it stays free-friendly
- **No mapping layer** — the attribute-pair *is* the mode name in both directions.
- **Assigning an existing mode needs no Enterprise** — the per-plan cap governs
  *creating* modes, not *assigning* them; so a user whose imported design system
  already holds the modes can have them assigned on any plan, no dev mode.
- **Lossless round-trip** — design→code→design (or code→design→code) yields a
  structurally equivalent artifact, because both directions share the vocabulary.

### 3.3 Claims

**159. (independent) — Code→design via the shared naming vocabulary.**
A method for constructing a design-tool representation from design-system code,
comprising, in a plugin executing within the design tool under standard
(non-Enterprise) permissions and without a code-inspection ("dev") mode: parsing
the code into a normalized element tree of design-system component references and
their semantic properties; for each element, instantiating the design-tool
component whose name matches the code component under a shared naming convention,
and **assigning** to the instantiated node the variable-collection mode
corresponding to the element's theme and surface data-attribute pair, the effect
mode corresponding to its elevation property, and the layout-sizing mode
corresponding to its sizing property; and assembling the nodes with auto-layout
derived from the element's stack/gap/padding/alignment — being the inverse of the
resolve-and-stamp method of claim 150.

**160.** The method of claim 159, wherein assigning the variable mode for an
element requires no mapping layer between code data-attribute identifiers and
design-tool mode identifiers, the identifiers being identical under the shared
naming convention.

**161.** The method of claim 159, wherein the plugin **assigns pre-existing
variable modes** to nodes rather than creating new modes, such that
reconstruction operates within any subscription tier's per-collection mode limit
and on a free tier limited to a single mode.

**162.** The method of claims 150 and 159, wherein converting a design-tool
representation to code and back, or code to a design-tool representation and
back, yields a structurally equivalent artifact (a lossless round-trip), because
both directions are governed by the same naming vocabulary and the same shared
property-to-mode mapping table.
