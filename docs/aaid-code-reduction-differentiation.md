# AAID — Differentiation & Code-Reduction (spec support + new claims 142–146)

> Draft support text for the patent spec (`Draft Spec(151962011.1).docx`) and refined claims.
> Extends the AAID block (claims 62–72), the conversion block (95–97), and the
> partial-adoption block (98–100). **Not legal advice — for patent counsel review.**

> **Correction (status).** An earlier assessment — made before the
> `Draft Spec(151962011.1).docx` was available — stated that the AAID /
> mode-to-code mapping was *not* claimed and was an "unprotected gap," and that
> the `figmaToCode.ts` reference to "claims 62–72" was unbacked. **That was
> incorrect.** Claims **62–72** (the AAID block) and **95–100** (conversion +
> partial adoption) already claim the core mechanism: an AI agent generating
> design-system code from named components, tokens, and surface context with no
> hardcoded visual values, in both directions, without a live server. The
> `figmaToCode.ts` reference is accurate. The claims below (142–149) **refine
> and extend** that existing, already-claimed mechanism — they do not fill a
> void. The novel *additions* here are the single-attribute-pair token bundle
> (142), the no-mapping-layer Mode↔data-attribute identity (143), the
> enumerated inline-emission prohibitions (144), the quantified code-reduction
> factor (145), inline-to-attribute-pair collapse during adoption (146), and the
> Auto/explicit suppression + round-trip (148).

---

## 1. How this differs from existing design↔code tools

Existing design-to-code and code-to-design tools for vector design platforms
(e.g. design-tool "dev mode" inspectors, and third-party generators) operate by
**extracting resolved visual values** from a design — hex/RGB colors, pixel
dimensions, per-corner radii, per-layer shadow offsets — and **emitting those
literal values back out**, either as inline style declarations on each element
or as one-off generated class names whose rule bodies contain the literals. The
direction of travel does not change the unit of output: in both directions the
artifact is **a per-property enumeration of resolved values bound to a specific
element**.

This produces three structural consequences:

1. **Output volume scales with property count × element count.** Every element
   re-states every visual property it uses.
2. **The output is brand-frozen.** Because the values are literals, a later
   brand/theme/mode change does not propagate; the generated code must be
   re-generated or hand-edited.
3. **Accessibility is not guaranteed.** Literal values carry no contrast or
   target-size guarantee; correctness must be re-checked downstream.

The present disclosure differs in the **unit of output**. Instead of emitting
resolved values, the AI agent (per the AAID, claims 62–72) emits **semantic
component references plus a small set of named scoping attributes** — most
importantly a **(theme, surface) attribute-pair** — and emits **no resolved
visual values at all**. The values are supplied later, at render time, by the
design system's token cascade.

| | Prior-art design↔code | Present disclosure |
|---|---|---|
| Unit of output | per-property literal per element | semantic component + scoping attributes |
| Color / radius / shadow | inline literals or generated classes | never emitted; resolved by cascade |
| Output volume | property-count × element-count | ~constant per region (one attribute-pair) |
| Brand/mode change | does not propagate (re-generate) | propagates automatically (token resolves at runtime) |
| Accessibility | re-check downstream | guaranteed by construction (token architecture) |
| Direction symmetry | needs an ID-mapping layer | **same attribute vocabulary both directions — no mapping layer** |

---

## 2. The mechanism that reduces code: one attribute-pair resolves a token bundle

In the design system, a **(theme, surface) attribute-pair** declared on a
containing element exposes, through the CSS cascade, a complete, mutually
consistent **bundle of correlated tokens** to that element and all of its
descendants — without any of those tokens being written by the agent. The
bundle includes, for that theme + surface:

- background (`--Background`)
- foreground content tokens (`--Text`, `--Quiet`, `--Header`)
- border tokens (`--Border`, `--Border-Variant`)
- interaction-state tokens (`--Hover`, `--Active`, `--Focus-Visible`)
- link tokens (`--Hotlink` / link, link-hover, link-visited)
- per-palette button tokens (`--Buttons-<Palette>-Border/Highlight/Lowlight`, etc.)
- icon and tag tokens
- the surface-appropriate dropshadow color tokens (`--Dropshadow-Color-1..N`)

A single declaration such as:

```html
<section data-theme="Primary" data-surface="Surface"> … </section>
```

therefore **selects on the order of fifteen-to-thirty correlated, individually
accessibility-verified token values at once**. The per-property-inlined
alternative would require the agent to emit each of those values explicitly on
each element that consumes it.

### Worked example (measured against an actual region)

Region: a vertical stack of six elevated tiles (the "Frame 57" elevation demo).

**Prior-art-style output** (illustrative), per tile, enumerates: `background`,
`color`, `border-color`, and a multi-layer `box-shadow` (the elevation-5 tile
alone is a five-layer shadow, each layer carrying a color literal) — plus the
container's own background, text, and border. Across six tiles this is on the
order of **40–60 literal property declarations**, every one a brand-specific
value that freezes on a brand change.

**Present-disclosure output** for the same region:

```jsx
<VStack data-theme="Primary" gap="var(--Sizing-2)">
  <Box surface="Container" elevation={0}><Ratio ratio="1:1" /></Box>
  <Box surface="Container" elevation={1}><Ratio ratio="1:1" /></Box>
  <Box surface="Container" elevation={2}><Ratio ratio="1:1" /></Box>
  <Box surface="Container" elevation={3}><Ratio ratio="1:1" /></Box>
  <Box surface="Container" elevation={4}><Ratio ratio="1:1" /></Box>
  <Box surface="Container" elevation={5}><Ratio ratio="1:1" /></Box>
</VStack>
```

The agent emits **one `data-theme` pair on the parent and one `surface`
attribute + one `elevation` integer per tile** — and **zero** color, border,
radius, or shadow literals. The five-layer elevation-5 shadow, the per-surface
shadow tint, the container background, the foreground tokens — all resolve from
the cascade. The output is **brand-dynamic** (a later theme change re-colors it
with no code edit) and **accessible by construction**.

**Reduction factor (claim 145).** Define the reduction as the ratio of
*correlated token values resolved* to *scoping declarations emitted*. Here a
single `data-theme="Primary" data-surface="Surface"` resolves ~20 correlated
tokens, and the cascade re-uses that same scope for every descendant — so a
single parent attribute-pair scopes an entire subtree, and the per-element cost
collapses to a single semantic attribute (`surface`) plus an `elevation`
integer. The agent emits **one attribute-pair to resolve a plurality of
correlated visual tokens**, and the multiplicative saving grows with the number
of descendants the scope covers.

---

## 3. Bidirectionality with no mapping layer

Because the **same finite attribute-pair vocabulary is used on both the
design-tool Mode dimension (Theme / Surface modes) and the CSS
data-attribute dimension** (`data-theme` / `data-surface`), an agent
translating a design-tool layer to a code element — or a code element back to a
design-tool layer — does **not** require an intermediate table mapping
design-tool Mode identifiers to CSS scoping identifiers. The identifier *is* the
same token in both representations. A node whose Theme mode is `Primary` and
whose Surface mode is `Auto` (inherited) translates directly to
`data-theme="Primary"` with **no** `data-surface` (because `Auto` denotes
inheritance, the agent suppresses it). This identity is what makes the
translation lossless and round-trippable, and is the practical basis for
emitting only **explicitly-set, non-inherited** axes.

---

## 4. Partial adoption: collapsing existing inline code into attribute-pairs

For legacy/unmatched components (claims 98–100), the same mechanism runs in
reverse as a **reduction transform**: when a component's inline style
declarations collectively correspond to a known (theme, surface) bundle, the
adoption process **removes the inline declarations and substitutes a single
attribute-pair on a parent element**, collapsing many inline literals into one
scoping declaration — converting brand-frozen inline code into brand-dynamic,
cascade-resolved code without rewriting the component's structure.

---

## 5. Refined / new claims

> Numbering follows the user's draft (142–146); 147–149 are suggested additions.

**142.** The AI-agent integration method of claim 62, wherein the token
naming-convention document encodes a finite enumerated set of (theme, surface)
attribute-pair values addressable by the AI agent, such that a region's complete
visual styling — including background, foreground content tokens, border tokens,
interaction-state tokens for hover and active, link tokens, and per-palette
button tokens — is selectable by a single attribute-pair declaration on a
containing element rather than by enumeration of individual style properties.

**143.** The integration method of claim 142, wherein the attribute-pair
vocabulary is identical between a design-tool Mode dimension and a CSS
data-attribute dimension, such that an AI agent translating between a
design-tool layer and a corresponding code element does not require a mapping
layer between design-tool Mode identifiers and CSS scoping identifiers.

**144.** The integration method of claim 62, wherein the AAID explicitly
enumerates inline-property emissions prohibited to the AI agent, including
without limitation inline color literals, inline RGB or HSL function notations,
inline style props specifying color, background-color, or border-color, inline
box-shadow and border-radius declarations, and class names containing color
literals, such that AI-generated code is structurally prevented from carrying
brand-specific visual values that would resist brand updates.

**145.** The AI-assisted code-generation method of claim 71, wherein the size of
the AI agent's output for a branded user-interface region is reduced relative to
a per-property-inlined alternative by a factor corresponding to the number of
correlated cascade-resolved token values selected per emitted attribute-pair
declaration, such that the AI agent emits a single attribute-pair to resolve a
plurality of correlated visual tokens for a containing element and its
descendants.

**146.** The partial token-adoption method of claim 98, wherein the adoption
process detects inline style declarations on a UI component and substitutes the
inline declarations with a data-attribute pair declaration on a parent element
when the inline values collectively correspond to a known (theme, surface)
bundle in the design system, such that one or more inline declarations collapse
into a single attribute-pair scoping the component.

### Suggested additional dependents

**147.** The integration method of claim 142, wherein the (theme, surface)
bundle includes interaction-state and focus tokens, such that hover, active, and
focus-visible appearances are obtained without the AI agent emitting any
state-specific style rule, and said state appearances retain verified contrast
relationships by construction.

**148.** The method of claim 143, wherein an axis of the design-tool Mode
dimension carrying an inherited ("auto") value is suppressed from the emitted
code element, such that the AI agent emits a scoping attribute only for an axis
explicitly assigned a non-inherited mode, and a corresponding code-to-design
translation reconstructs the inherited axis from ancestor context without an
explicit per-node value.

**149.** The method of claim 145, wherein a single attribute-pair declared on an
ancestor element scopes the resolved token bundle to a plurality of descendant
elements through cascade inheritance, such that the per-element output cost for
each descendant is independent of the number of visual properties that
descendant consumes.
