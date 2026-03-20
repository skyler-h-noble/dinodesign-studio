# Dino Design — IP Strategy v5.0
## March 20, 2026

These additions should be integrated into dino-ip-strategy-v3.docx.

---

## Architecture Diagrams (FigJam)

1. [12-Tone LCH Scale with Dead Zone](https://www.figma.com/online-whiteboard/create-diagram/b5ce8410-defe-42f5-bb8e-34a6469428c8?utm_source=other&utm_content=edit_in_figjam)
2. [Token Resolution: Theme Builder vs Dino](https://www.figma.com/online-whiteboard/create-diagram/2cefee18-a1d0-4e61-b877-3365ad374074?utm_source=other&utm_content=edit_in_figjam)
3. [Multi-Channel Delivery from Single ID](https://www.figma.com/online-whiteboard/create-diagram/31592b86-5588-406d-bd9a-d2acb2f70277?utm_source=other&utm_content=edit_in_figjam)
4. [Surface Variant and Container Architecture](https://www.figma.com/online-whiteboard/create-diagram/f88bb25e-4e05-46b5-ad16-136d2db90475?utm_source=other&utm_content=edit_in_figjam)
5. [Complete Token Set Per Background Context](https://www.figma.com/online-whiteboard/create-diagram/b56691db-7bc7-4201-b9fa-32726b3084f5?utm_source=other&utm_content=edit_in_figjam)
6. [Generation Pipeline: Image to Design System](https://www.figma.com/online-whiteboard/create-diagram/79eb9cb2-68bb-4912-b2d9-723c294b072d?utm_source=other&utm_content=edit_in_figjam)
7. [Locked Foundation vs Flexible Decisions](https://www.figma.com/online-whiteboard/create-diagram/8d445127-2cbf-4120-940a-fca92ff68627?utm_source=other&utm_content=edit_in_figjam)
8. [Surface Variant Architecture — Closed Color System](https://www.figma.com/online-whiteboard/create-diagram/ff1662b6-ea82-4d84-b51d-4114b6175536?utm_source=other&utm_content=edit_in_figjam)

---

## 0. Add Before Section 1 — Why Dino Design Exists

### The Problem

AI is everywhere. People are using it every day to create digital experiences — websites, apps, dashboards, marketing pages. But the output of AI-generated UI has three fundamental problems:

1. **It's not branded.** AI produces generic interfaces. The colors, typography, and visual language don't reflect the user's brand. Every AI-generated app looks like every other AI-generated app.

2. **It's not accessible.** AI has no mechanism to guarantee WCAG compliance. It generates colors that look good but may fail contrast requirements. It produces layouts without touch target spacing. It creates focus states that don't meet visibility standards. There is no structural guarantee — only hope that the output happens to comply.

3. **There is no system.** AI generates one-off screens, not design systems. There is no token architecture, no theme structure, no component library, no Figma variables. The end user receives a picture of an interface, not the tools to build from it. They cannot evolve, extend, or maintain what AI produced.

### What Existed Before

Capital One's Theme Builder (U.S. Patent 12,455,724B2, open-sourced via FINOS under Apache 2.0) presented groundbreaking concepts: accessibility-aware theming, token-driven design, systematic color generation. But Theme Builder was a **configuration tool**, not a **generation pipeline**. It required a skilled designer to make dozens of manual decisions at every step. The output was a set of token definitions — not a deployable design system with components, Figma variables, documentation, and multi-channel delivery.

Putting Theme Builder's concepts to practical use — actually building a well-constructed, coded, branded, accessible design system from its output — remained a weeks-long professional undertaking. The concepts were right. The distance from concept to usable system was too far.

### What Dino Design Does Differently

Dino Design was built on a single conviction: **creating a customized, accessible, dynamic, tested design system should be quick and easy.**

Every architectural decision in the system serves this goal:

- **Single image input** — because asking a non-designer to configure color palettes, contrast ratios, and tone scales is asking them to fail. Upload a mood board. The system handles the rest.

- **Structural accessibility guarantees** — because contrast checking is fallible, slow, and produces false confidence. The 12-tone LCH scale makes non-compliance mathematically impossible. There is nothing to check because there is nothing that can fail.

- **Closed color vocabulary** — because computed colors are unpredictable and expensive. Every color in the system is one of 12 predetermined tones. No surprises. No edge cases. No "it worked in testing but fails in production."

- **Multi-channel delivery from a single ID** — because a design system that exists only as CSS files is not a design system. Designers need Figma variables. Developers need components. AI coding assistants need documentation. Everyone gets what they need, synchronized, from one identifier.

- **Identical naming across design and code** — because the handoff gap between designers and developers is where accessibility breaks. Every component name and every variant name in the Figma template matches exactly the component name and variant prop in the React code. A designer selects `Button / variant=solid / color=primary / size=medium` in Figma. A developer writes `<Button variant="solid" color="primary" size="medium" />`. There is no translation layer, no naming convention mismatch, no "the designer called it X but the developer calls it Y." This 1:1 naming parity eliminates an entire class of implementation errors.

- **Living, updatable system** — because design systems are not finished products. They evolve. New components are added. Typography is refined. Button styles change. Dino makes these updates trivial — change a setting, push to all channels. The locked brand foundation ensures updates can never break accessibility.

- **Evidence of quality** — because claiming accessibility compliance and proving it are different things. The accessibility report shows every contrast ratio for every token on every surface and container. The proof is the product, not a separate audit.

We have tried to streamline every step, thinking about the end user — how they will use their design system, how they will evolve it over time, and how to ensure the quality is strong and the evidence of its ability to produce accessible components and experiences is clear and auditable.

### Built With Its Own Output

Dino Design Studio (the creation tool) and the Hosted Playground (the delivery channel) are both built using `@dynodesign/components` — the same React component library that customers receive. The same 49 components, the same CSS custom property token architecture, the same `data-theme` / `data-surface` cascade, the same platform and cognitive accessibility overrides.

This is not incidental. It is a deliberate architectural decision with three consequences:

1. **Proof of capability.** The tool itself is the evidence that the design system works at production scale. Every screen the customer interacts with while creating their design system is rendered by the same components they will receive. If the creation tool works, their design system works.

2. **Continuous quality assurance.** Every bug in the component library is immediately visible in the creation tool. There is no "it works in the demo but fails in production" gap. The Dino team uses the components daily in a real production application, exposing issues that synthetic testing misses.

3. **Living reference implementation.** The creation tool and playground serve as a comprehensive reference for how to use the components, tokens, and architecture. Customers can inspect the tool itself to understand usage patterns — it is simultaneously the product and the documentation.

No prior art design system tool is built with its own output. Theme Builder was a configuration interface, not a consumer of the design system it produced. Supernova, Specify, and Style Dictionary are token management platforms that do not ship a component library, let alone use one internally.

### Accessibility Built In, Not Bolted On

The industry standard for accessibility is broken. Teams build features, ship code, then run an accessibility audit at the end of the sprint. The audit produces a list of violations. The violations go into the backlog. The code ships with exceptions. The backlog grows. The exceptions accumulate. Accessibility becomes technical debt — acknowledged, tracked, and never fully resolved.

Dino Design eliminates this pattern entirely by building accessibility into the core of the design system at every stage of the workflow:

1. **At the architecture level** — the 12-tone LCH scale makes non-compliant contrast mathematically impossible. There is no audit because there is nothing that can fail.

2. **In design** — the Figma plugin validates contrast, target sizes, and ARIA requirements against the customer's actual variable collections. Designers see violations in Figma, not in a post-handoff audit report.

3. **In code** — the VS Code extension resolves token references at authoring time and validates WCAG compliance before the code runs. The developer sees violations inline, not in a CI/CD report days later.

4. **With AI** — the Claude slash command validates accessibility of AI-generated code against the design system's known token vocabulary. AI-generated UI is checked at generation time, not after deployment.

5. **In the Playground** — real-time accessibility checks on customized components show compliance status as the user adjusts variants, with no separate audit step.

6. **In the report** — the downloadable accessibility report provides auditable proof of compliance for every token pair, every surface, every container, every interactive state, every platform.

The result: accessibility is not a sprint-end gate, not a backlog item, not an exception. It is a structural property of the system — validated continuously at design time, authoring time, generation time, and customization time. The customer never ships non-compliant code because the system never produces it.

**Important caveat:** Dino does not claim to solve all accessibility requirements. Full WCAG compliance includes content-level concerns (alt text on images, meaningful link text, logical reading order, keyboard navigation patterns, screen reader announcements) that depend on the specific content and interactions a team builds. These require human review and cannot be structurally guaranteed by a design system.

What Dino does eliminate are the **most common and most systemic accessibility failures**: color contrast violations and touch target sizing. These two categories account for the majority of automated accessibility audit findings across the industry — and they are precisely the failures that a design system can prevent structurally.

Every component in `@dynodesign/components` ships with correct ARIA attributes built in — `role`, `aria-expanded`, `aria-selected`, `aria-haspopup`, `aria-disabled`, and all required state attributes are implemented in the component code. A developer using `<Select>` gets the correct `role="combobox"`, `aria-expanded`, and keyboard handling without writing a single ARIA attribute.

However, content-specific ARIA values — `aria-label`, `aria-describedby`, `alt` text — must be set by the developer or AI to match the actual content. A `<Button>` has the correct `role="button"` automatically, but its `aria-label` depends on what the button does in context. If an AI generates `<Button>Click here</Button>`, the ARIA structure is correct but the label is meaningless for screen readers.

The Claude slash command and VS Code extension can check that these content-specific attributes are present and meaningful — flagging missing `aria-label` on icon buttons, empty `alt` on images, and generic labels like "Click here" — catching content-level issues at authoring time rather than in a post-deployment audit. This extends the "built in, not bolted on" principle from structural guarantees (contrast, target size) through component-level guarantees (ARIA roles and states) to best-effort content validation (labels, alt text, meaningful names).

### The Market Context

The explosion of AI-generated digital experiences creates an urgent need for the thing AI cannot produce: **systematic, accessible, branded design infrastructure.** Every AI-generated app that ships without a design system is a liability — inaccessible, unbranded, unmaintainable. Dino Design is the infrastructure layer that makes AI-generated experiences production-ready.

This is not a design tool. It is not a color picker. It is not a theme configurator. It is an **automated design system factory** that produces branded, accessible, multi-channel design infrastructure from a single image — and keeps it alive, updatable, and provably compliant for as long as the customer needs it.

---

## 1. Updates to DYNO-IP-2025-005 — LCH Tone Scale (Section 4)

### Replace Section 4.5 with:

**4.5 Light and Dark Mode Tone Scales**

Dino uses separate predetermined lightness values for light mode and dark mode tone scales, rather than simply inverting the light scale. This accounts for the perceptual asymmetry between light and dark backgrounds and ensures that the tone-to-tone contrast guarantees hold independently in both modes.

The specific scales are:

| Color-N | Light Mode (L) | Dark Mode (L) |
|---------|---------------|---------------|
| 1       | 1             | 1             |
| 2       | 10            | 5             |
| 3       | 19            | 12            |
| 4       | 28            | 18            |
| 5       | 37            | 24            |
| 6       | 58            | 58            |
| 7       | 71            | 64            |
| 8       | 81            | 70            |
| 9       | 90            | 76            |
| 10      | 95            | 82            |
| 11      | 98            | 85            |
| 12      | 99            | 89            |

The original scale design included 14 tones, with two tones at L=46.6 and L=53 occupying the perceptual midpoint of the lightness range. During verification, these tones were identified as a **structural dead zone**: at maximum chroma (62–70), no foreground tone in the scale achieves WCAG AA 4.5:1 contrast against backgrounds in the L=38–57 range, regardless of hue. This is a mathematical property of the LCH color space — not a bug in any particular implementation.

The dead zone was eliminated by removing these two tones entirely, producing the 12-tone scale. Every remaining tone pair achieves the target WCAG contrast ratio at maximum gamut chroma across all hues. The dead zone elimination was verified computationally across 360 hues in 1-degree increments for every foreground/background pair, including cross-palette scenarios (different hues for foreground and background).

Key verification results:
- Color-5 (L=37) to Color-11 (L=98): worst-case 4.64:1 at hue 240° (blue) — passes 4.5:1
- Color-6 (L=58) to Color-1 (L=1): worst-case 4.60:1 at hue 0° (red) — passes 4.5:1
- Color-6 (L=58) headers/borders to Color-2 (L=10): worst-case 3.81:1 — passes 3.1:1
- All 12 tones pass for Text (4.5:1), Header (3.1:1), Border (3.1:1), and Quiet (2.5:1)

Each mode also employs an independently designed chroma bell curve matched to its specific lightness values, rather than applying a single chroma distribution to both scales. This ensures chromatic richness is optimized for each mode's distinct lightness range — dark mode tones at L=85-89 receive appropriate chroma (multiplier 0.35-0.45) rather than the near-zero chroma (0.094) that a light-mode curve would assign to those lightness values.

### Add to Section 4.6 (Patent Claims):

**CLAIM 06  Dead Zone Elimination via Scale Architecture   Confidence: HIGH**
A color scale design method wherein lightness values in the perceptual midpoint range are intentionally excluded from the tone scale, such that every remaining tone pair achieves the target WCAG contrast ratio at maximum gamut chroma across all hues — eliminating the need for chroma reduction, contrast fallbacks, or post-generation verification, and making non-compliant foreground/background pairings structurally impossible rather than programmatically prevented.

**CLAIM 07  Independent Per-Mode Chroma Distribution   Confidence: HIGH**
A dual-scale color system wherein each mode (light and dark) employs an independently designed chroma bell curve mapped to its specific lightness values, rather than applying a single chroma distribution to both scales or deriving one from the other, ensuring that chromatic richness is optimized for each mode's distinct lightness range without producing desaturated or over-saturated tones at the scale extremes.

**CLAIM 08  Computational Verification of Structural Guarantee   Confidence: MEDIUM**
A method for validating a structurally-guaranteed accessible color scale comprising: computing WCAG contrast ratios for every foreground/background tone pair across all hues at the maximum chroma achievable for each tone's lightness; verifying that every mapped pair meets or exceeds the target contrast ratio; and producing a verification report that constitutes a mathematical proof of compliance independent of any specific brand color input.

---

## 2. Updates to DYNO-IP-2025-004 — DynoStack (Section 3)

### Add to Section 3.2 (after existing content):

**3.2.1 Platform-Aware Token Delivery**

The `--Min-Stack-Gap` token is delivered as part of a comprehensive platform-aware CSS architecture using `[data-platform]` attribute selectors:

| Platform     | Min-Stack-Gap | Container-Padding | Button-Height |
|-------------|---------------|-------------------|---------------|
| Desktop     | 0px           | 32px (Sizing-4)   | 32px          |
| iOS Mobile  | 10px          | 16px (Sizing-2)   | 44px          |
| iOS Tablet  | 10px          | 24px (Sizing-3)   | 48px          |
| Android     | 12px          | 16px (Sizing-2)   | 48px          |

This architecture allows a single codebase to enforce platform-appropriate WCAG 2.5.8 spacing without conditional logic, runtime detection, or build-time branching. The enforcement is CSS-native — the platform attribute on the root element cascades to all layout components through CSS custom property inheritance.

The platform architecture also includes:
- Complete typography scale per platform (H1-H6, Body, Label, Button) with platform-specific font sizes, line heights, letter spacing, and paragraph spacing
- Platform font family overrides via `[data-fonts]` and `[data-fonts="Default"]` — custom brand fonts when available, native system fonts (SF Pro for iOS, Roboto for Android) as fallback
- Cognitive accessibility overrides via `[data-cognitive="Dyslexia"]` and `[data-cognitive="ADHD"]` — font substitution (OpenDyslexic) and spacing multipliers

### Add new claim to Section 3.3:

**Note:** The platform token layer (`[data-platform]` attribute selectors for typography, sizing, padding) is covered by the Capital One Theme Builder patent under Apache 2.0. No independent claim is filed for platform-scoped tokens.

**CLAIM 06  DynoStack Min-Stack-Gap as WCAG-Coupled Platform Token   Confidence: HIGH**
The integration of DynoStack's runtime gap enforcement (DYNO-IP-2025-004) with platform-scoped `--Min-Stack-Gap` token values, wherein the same CSS custom property reference in the DynoStack enforcement mechanism resolves to platform-appropriate WCAG 2.5.8 spacing (0px desktop, 10px iOS, 12px Android) through CSS cascade — without requiring the layout component to detect the platform or perform conditional logic. The novel element is the coupling of the DynoStack invention (runtime child-inspection gap enforcement) with platform token resolution, not the platform token layer itself.

---

## 3. NEW SECTION — DYNO-IP-2025-012

### 12. Adjacent-Tone Surface Variant System

**Document ref.** DYNO-IP-2025-012
**Status:** Draft — Pending Formal Filing
**Date:** March 2026

#### 12.1 Summary

Dino Design defines surface variants (Surface-Dim, Surface-Dimmest, Surface-Bright) as adjacent tones in the LCH scale rather than opacity blends or arbitrary color shifts. Surface-Dim is Color-(N-1), Surface-Dimmest is Color-(N-2), and Surface-Bright is Color-(N+1). Because every tone in the 12-tone scale has pre-verified contrast against its mapped foreground tokens, surface variants are automatically WCAG compliant without additional contrast checking.

This eliminates the failure mode present in blend-based surface variants (used by Material Design 3, Theme Builder, and most design systems) where a percentage blend with black or white can push a surface into a contrast-failing lightness range — particularly near the dead zone (L=38-57) where no foreground provides sufficient contrast at high chroma.

#### 12.2 Full Token Set Per Surface Variant

Each surface variant carries the complete token set (Text, Header, Quiet, Border, Hover, Active, Focus-Visible, Buttons, Icons, Tags) resolved to the variant's specific tone — not inherited from the base surface. This is architecturally critical: a component on Surface-Dim has different (and independently verified) text, border, and header colors than the same component on the base Surface.

The CSS output uses descendant selectors:

```css
/* Base surface — default for the theme */
[data-theme="Primary"] {
  --Background: var(--Colors-Primary-Color-9);
  --Text: var(--Text-Surfaces-Primary-Color-9);
  --Header: var(--Header-Surfaces-Primary-Color-9);
  --Border: var(--Border-Surfaces-Primary-Color-9);
  /* ... full token set for Color-9 */
}

/* Surface-Dim overrides within the theme */
[data-theme="Primary"] [data-surface="Surface-Dim"] {
  --Background: var(--Colors-Primary-Color-8);
  --Text: var(--Text-Surfaces-Primary-Color-8);
  --Header: var(--Header-Surfaces-Primary-Color-8);
  --Border: var(--Border-Surfaces-Primary-Color-8);
  /* ... full token set for Color-8 */
}
```

This architecture means a developer writes `data-surface="Surface-Dim"` on any element and receives a complete, pre-verified, accessible color context — without knowing or caring which specific colors are being applied.

#### 12.3 Distinction from Prior Art

| Dimension | Prior Art (Material Design 3, Theme Builder) | Dino Design |
|-----------|----------------------------------------------|-------------|
| Surface variant method | Percentage blend with black/white | Adjacent tone in LCH scale |
| Contrast guarantee | Requires post-blend verification | Pre-verified by tone scale architecture |
| Failure mode | Blend can push into dead zone | Dead zone tones excluded from scale |
| Token inheritance | Variants inherit parent tokens | Each variant has independently mapped tokens |
| Developer API | Manual color calculation or opacity layer | Single data attribute (`data-surface`) |

#### 12.4 Patent Claims

**CLAIM 01  Adjacent-Tone Surface Variant Architecture   Confidence: HIGH**
A design system surface variant method comprising: defining surface variants as adjacent tones in a perceptually uniform color scale (N-1, N-2, N+1) rather than opacity blends or percentage shifts; mapping each variant tone to a complete, independently verified set of foreground tokens (text, header, border, quiet, button, icon) using the same tone-to-tone mapping table that guarantees the base surface's accessibility; and delivering each variant's token set via a CSS descendant selector pattern, such that developers apply a single data attribute to receive a complete accessible color context without manual color specification.

**CLAIM 02  Dead-Zone-Safe Surface Variants   Confidence: HIGH**
A surface variant system wherein variant tones are selected exclusively from a predetermined scale that has been structurally verified to exclude lightness values incapable of achieving target contrast ratios at maximum chroma, such that no surface variant — regardless of hue, chroma, or mode — can produce a contrast-failing background, eliminating the blend-into-dead-zone failure mode present in percentage-blend-based surface variant systems.

**CLAIM 03  Per-Variant Full Token Resolution   Confidence: HIGH**
A surface variant architecture wherein each variant (dim, dimmest, bright) carries a complete, independently resolved token set rather than inheriting tokens from the base surface, such that text, header, border, and interactive element colors are each independently optimized for the variant's specific lightness value — preventing the contrast degradation that occurs when base-surface tokens are applied to a shifted background.

---

## 4. NEW SECTION — DYNO-IP-2025-013

### 13. Dual-Mode Container Elevation System

**Document ref.** DYNO-IP-2025-013
**Status:** Draft — Pending Formal Filing
**Date:** March 2026

#### 13.1 Summary

Dino Design implements a dual-mode elevation system for containers that adapts to the perceptual characteristics of each mode:

**Light mode:** All container levels use the same background color (Color-11, L=98). Visual hierarchy is established exclusively through CSS box-shadow effect levels (Level-negative-1 through Level-5). This reflects the perceptual reality that shadows are clearly visible on light backgrounds.

**Dark mode:** Container levels are defined as fixed tone steps in the 12-tone scale, because shadows are perceptually invisible on dark backgrounds. The elevation hierarchy uses color differentiation instead:

| Container Level | Dark Mode Color |
|----------------|----------------|
| Container-Lowest | Color-2 (L=10) |
| Container-Low | 50% blend of Color-2 and Color-3 |
| Container | Color-3 (L=19) |
| Container-High | 50% blend of Color-3 and Color-4 |
| Container-Highest | Color-4 (L=28) |

Each container level is paired with an effect level that combines shadow and color hierarchy:

| Container Level | Effect Level |
|----------------|-------------|
| Container-Lowest | Effect-Level-negative-1 |
| Container-Low | Effect-Level-1 |
| Container | Effect-Level-2 |
| Container-High | Effect-Level-3 |
| Container-Highest | Effect-Level-4 |

#### 13.2 Distinction from Prior Art

Material Design 3 uses a single elevation system (shadow-based) in both modes, adding a semi-transparent white overlay in dark mode to simulate elevation. This produces muddy, washed-out surfaces. Dino's approach uses the perceptually correct mechanism for each mode — shadows where visible (light), color steps where shadows are not (dark).

#### 13.3 Patent Claims

**CLAIM 01  Mode-Adaptive Container Elevation Architecture   Confidence: HIGH**
A container elevation system comprising: in a light-mode context, applying identical background colors to all container levels and differentiating elevation exclusively through graduated CSS box-shadow effect levels; and in a dark-mode context, applying predetermined tone-stepped background colors to differentiate container levels, optionally combined with effect levels — such that the elevation mechanism adapts to the perceptual characteristics of each mode rather than applying a single elevation strategy uniformly.

**CLAIM 02  Predetermined Tone-Step Dark Mode Containers   Confidence: HIGH**
A dark-mode container elevation method wherein container levels are assigned background colors from predetermined positions in an accessible LCH tone scale, with intermediate levels produced by 50% blending of adjacent scale tones, such that all container backgrounds maintain verified WCAG contrast relationships with their associated foreground tokens without runtime contrast calculation.

---

## 5. NEW SECTION — DYNO-IP-2025-015

### 15. Channel-Optimized Token Resolution

**Document ref.** DYNO-IP-2025-015
**Status:** Draft — Pending Formal Filing
**Date:** March 2026

#### 15.1 Summary

Dino Design generates structurally different token representations for CSS and Figma from the same source logic, optimizing each for its consumption channel's performance characteristics. This is architecturally distinct from Theme Builder, which exported the same complex variable chain to both CSS and JSON — forcing CSS to carry the indirection overhead that only Figma requires.

**The problem with Theme Builder's approach — computed colors and deep chains:**

Theme Builder individually calculated text, header, icon, quiet, and border colors — each producing a unique computed color value. A button text color might be a different shade than a card text color, even on the same background, because each was independently derived. This produced hundreds of distinct color values in the system, each requiring its own contrast verification.

In CSS, a single token might resolve through 4-5 variable hops:
```
--Buttons-Primary-Text
  → var(--Default-Button-Primary-Medium-Text)
    → var(--Buttons-Primary-Medium-Text)
      → var(--Text-Surfaces-Primary-Color-11)
        → var(--Colors-Primary-Color-2)
          → #1a1a1a
```
Each `var()` reference is a runtime resolution step. The same complex chain was exported to both CSS and Figma JSON — forcing CSS to carry Figma's indirection overhead.

**Dino's approach — a closed color system:**

In Dino, the entire color vocabulary of the design system is exactly 12 tones per palette. Every token — text, header, quiet, border, icon, button background, button text, tag background, tag text, hover, active, focus-visible — resolves to one of these 12 predetermined colors:

```css
[data-theme="Primary"] {
  --Text: var(--Colors-Primary-Color-2);
  --Header: var(--Colors-Primary-Color-4);
  --Quiet: var(--Colors-Primary-Color-6);
  --Border: var(--Colors-Primary-Color-6);
  --Hover: var(--Colors-Primary-Color-8);
  --Buttons-Primary-Text: var(--Colors-Primary-Color-2);
  --Icons-Default: var(--Colors-Primary-Color-7);
}
```

No other colors exist in the system. No computed intermediaries. No blended values. No runtime calculations. Every semantic token is a direct reference to a palette tone — one hop to a hex value.

The 12 tone colors plus White (`#ffffff`), Black (`#000000`), and Transparent (`#00000000`) are the complete color vocabulary. If a color appears in the UI, it is one of these values. There is no exception.

**Figma JSON output** preserves the full indirection chain because Figma's variable mode system requires it for dynamic theme switching:
```json
{
  "Buttons-Primary-Text": {
    "value": "{Default-Button.Primary.Medium.Text}",
    "type": "color"
  }
}
```
The chain enables a designer to change the button mode and see all dependent tokens update automatically. The indirection IS the feature in Figma. But it never reaches the browser.

#### 15.2 The Closed Color System vs Computed Colors

This is a fundamentally different class of color system:

| Dimension | Theme Builder (Computed) | Dino (Closed) |
|-----------|------------------------|---------------|
| Color vocabulary | Hundreds of unique computed values | Exactly 12 tones per palette + White/Black/Transparent |
| Text color | Independently calculated per context | One of the 12 tones (looked up, not calculated) |
| Header color | Independently calculated per context | One of the 12 tones |
| Border color | Independently calculated per context | One of the 12 tones |
| Button text | Independently calculated per button | One of the 12 tones |
| New colors introduced | Every token potentially introduces a new color | Zero — the vocabulary is fixed |
| Contrast verification | Required per computed pair | Unnecessary — verified once for the 12-tone scale |
| CSS variable hops | 4-5 per token | 1 per token (direct palette reference) |
| Total distinct colors in system | Hundreds | 12 × palettes + 3 utilities |

#### 15.3 Performance Impact

For a complete design system with 8 palettes × 12 tones = 96 base color variables, ~30 semantic tokens per theme, 4 surface variants, and 16 themes:

Theme Builder's approach: ~2,000+ tokens × 4-5 hops each = 8,000-10,000 runtime variable resolutions per style recalculation. Plus hundreds of unique computed hex values that must each be stored and resolved.

Dino's approach: ~2,000+ tokens × 1 hop each = ~2,000 runtime variable resolutions. Every token resolves to one of 96 base palette hex values. All intermediate tokens (Default-Button, Buttons.Medium, Text.Surfaces) exist only in the Figma JSON — they are never shipped to the browser.

#### 15.4 The Architectural Insight

The key insight is twofold:

**First**, CSS and design tools have **opposite optimization requirements**:

| Requirement | CSS | Figma |
|------------|-----|-------|
| Resolution depth | Shallow (performance) | Deep (mode switching) |
| Intermediate tokens | Waste (unused indirection) | Required (enable designer workflows) |
| Final values | Hex preferred (fastest) | References preferred (dynamic) |
| Token count | Minimize (bundle size) | Maximize (designer control) |

**Second**, a closed 12-tone color vocabulary eliminates the need for computed colors entirely. Theme Builder's architecture required unique computed values because each token type (text, header, border) was independently derived — producing a different shade for each. Dino constrains ALL colors to the 12 predetermined tones, so every token is a lookup rather than a computation. The mapping table (background tone → foreground tone) replaces the computation engine.

Prior art (Theme Builder, Style Dictionary, Specify, Theo) treats channels as format conversions of the same structure. Dino treats them as independent optimization targets served from shared generation logic, with the CSS channel benefiting from the closed color system's inherent simplicity.

#### 15.5 Distinction from Prior Art

| Tool | Color System | CSS Output | Design Tool Output |
|------|-------------|-----------|-------------------|
| Theme Builder | Computed — hundreds of unique values | Full indirection chain (4-5 hops), same as JSON | Same chain — identical to CSS |
| Style Dictionary | Computed or referenced | Flat resolved values | Flat resolved values — Figma loses mode switching |
| Specify | Computed or referenced | Token references | Token references — CSS carries unnecessary overhead |
| Dino Design | Closed — exactly 12 tones per palette | 1-hop to palette Color-N (no intermediate tokens) | Full indirection chain preserved for mode switching |

#### 15.6 Patent Claims

**CLAIM 01  Closed Color Vocabulary Design System   Confidence: HIGH**
A design system color architecture wherein the complete color vocabulary comprises exactly N predetermined tones per palette generated from an LCH tone scale, and every semantic token in the system — including text, header, quiet, border, hover, active, focus-visible, button background, button text, icon, and tag colors — resolves to one of said N tones via a fixed lookup table, introducing zero computed, blended, or derived color values, such that the total number of distinct colors in the system is bounded by (N × number of palettes) plus a fixed set of utility colors (white, black, transparent), regardless of the number of components, themes, or surface variants.

**CLAIM 02  Channel-Optimized Token Resolution from Closed Color System   Confidence: HIGH**
A design system generation method comprising: defining a closed color vocabulary of N predetermined palette tones; maintaining an internal token resolution chain mapping semantic tokens through component tokens to palette tones for design tool compatibility; exporting said chain in full to a design tool format (JSON/Figma variables) to preserve dynamic mode switching capability; and simultaneously exporting a resolved representation to CSS wherein each semantic token references its terminal palette tone directly in a single variable lookup — such that the CSS output contains no intermediate token layers, no computed color values, and no resolution chains deeper than one hop.

**CLAIM 03  Lookup-Based Color Assignment vs Computation-Based   Confidence: HIGH**
A design system color assignment method wherein foreground colors (text, header, border, quiet, icon) for each background tone are determined by a fixed lookup table mapping background tone index to foreground tone index, rather than by computing contrast-satisfying color values per element pair — such that adding new components, themes, or surface variants to the system requires no color computation, no contrast verification, and no new color values, because the lookup table's outputs are constrained to the existing closed palette vocabulary.

**CLAIM 04  Dual-Channel Structural Divergence from Shared Logic   Confidence: HIGH**
A design system export architecture wherein a single generation pipeline produces structurally different outputs for code consumption and design tool consumption — the code output containing only direct palette references (closed vocabulary, single-hop resolution, zero intermediate tokens) and the design tool output containing a multi-level indirection chain (enabling mode switching, theme variants, and designer workflow flexibility) — rather than applying format conversion to a single canonical structure, and rather than computing unique color values for either channel.

---

## 6. Cognitive Accessibility Token Layer — NOT A NEW FILING

**Note:** Cognitive accessibility accommodations (Dyslexia, ADHD modes via `[data-cognitive]` attribute selectors) are implemented in Dino's CSS token architecture but are covered by the existing Capital One / FINOS Theme Builder patent (U.S. Patent 12,455,724B2). Dino's implementation is a derivative work under the Apache 2.0 license grant. No independent patent claim is filed for this feature.

---

## 7. Addition to DYNO-IP-2025-010 — ID-Synchronized Multi-Channel Delivery (Section 9)

### Add Section 9.6: Figma Variable Architecture and License Tier Bypass

#### 9.6 Figma Variable Architecture Constraints

Dino's Figma output is architecturally designed around three hard Figma platform limitations:

| Constraint | Limit |
|-----------|-------|
| Variables per Collection | 5,000 maximum |
| Modes per Collection | 40 maximum |
| Mode creation (Free/Professional license) | 10 maximum |

These constraints dictate the variable collection structure — the system must partition its token set across collections to stay under 5,000 variables each, while maximizing the use of the 40-mode limit to encode themes, surfaces, and platform variants as Figma modes.

#### 9.6.1 The License Tier Bypass

Figma's Free and Professional plans restrict users to creating collections with a maximum of 10 modes. Enterprise plans allow up to 40. This creates a significant barrier for smaller teams and independent designers who cannot afford Enterprise licensing.

Dino's Figma Design System Template is a pre-built library file that ships with collections already configured with up to 40 modes. Because the modes are pre-built in the template — not created by the user — Free and Professional users can **use** all 40 modes despite being restricted from **creating** collections with more than 10. The Dino Figma Plugin populates these pre-built mode slots with the customer's brand tokens via the user ID, without requiring the user to create or modify the collection structure.

This means a designer on Figma's free plan receives the same 40-mode design system variable architecture as an Enterprise customer — the template itself is the license equalizer.

#### 9.6.2 What the 40 Modes Encode

The 40-mode budget is allocated across the design system's variant dimensions:

| Mode Category | Modes Used | Examples |
|--------------|-----------|---------|
| Themes | ~16 | Primary, Primary-Light, Secondary, Secondary-Light, Tertiary, Tertiary-Light, White, Black, Info, Info-Light, Success, Success-Light, Warning, Warning-Light, Error, Error-Light |
| Surface variants | ~4 | Surface, Surface-Dim, Surface-Dimmest, Surface-Bright |
| Container variants | ~5 | Container, Container-Low, Container-Lowest, Container-High, Container-Highest |
| Light/Dark mode | 2 | Light-Mode, Dark-Mode |
| Platform | ~4 | Desktop, IOS-Mobile, IOS-Tablet, Android |
| Cognitive | ~2 | Default, Dyslexia |
| Reserved | ~7 | Future expansion |

The specific allocation is optimized to fit within the 40-mode ceiling while covering all variant dimensions that the CSS architecture supports.

#### 9.6.3 Variable Collection Partitioning

To stay under the 5,000 variable limit per collection, the token set is partitioned into semantically grouped collections:

- **Colors** — Base palette tones (12 × 8 palettes = 96 variables, well under limit)
- **Semantic Tokens** — Text, Header, Quiet, Border, Hover, Active per palette per tone (high count, may require split)
- **Component Tokens** — Buttons, Icons, Tags per theme
- **Typography** — Font families, sizes, weights, spacing per platform
- **Effects** — Shadow levels, border radius, gradients

Each collection uses modes independently — the Colors collection uses Light/Dark modes, the Typography collection uses Platform modes, etc. This is more efficient than a single monolithic collection.

#### 9.7 Living Design System — Push Updates Across All Channels

Because Dino hosts the design system rather than exporting it as a static artifact, the system becomes a **living, continuously updatable service**. The user's design system can receive improvements, fixes, and even new components without the user rebuilding, re-importing, or re-generating anything.

##### 9.7.1 Update Channels

| Channel | Update Mechanism |
|---------|-----------------|
| Hosted Playground / Storybook | Immediate — CSS served from Supabase storage, updated in place |
| CSS Tokens (npm/CLI) | User prompted to accept update; `npx @dynodesign/init` pulls latest |
| Figma Template | Plugin push — user enters ID, plugin updates variable collections in their template |
| AI Documentation (CLAUDE.md) | Immediate — hosted URL always serves latest version |
| Email notification | User informed of available update with changelog; enters ID to trigger sync |

##### 9.7.2 The Component Addition Problem in Prior Art

Adding a new component to an existing design system is one of the hardest problems in design tooling. In prior art:

**In Figma:** When a designer copies a component from one Figma file into another, the component carries its original file's variable references. If the target file has different variable collection names, different mode names, or a different token structure, the imported component either:
- Breaks visually (references resolve to nothing)
- Uses the wrong tokens (references resolve to the source file's values, not the target's)
- Requires manual re-binding of every variable reference to the target file's collections

This is why design system migrations are measured in weeks or months, not minutes.

**In code:** Importing a component from a different design system package means the component expects different CSS variable names. The developer must either rename all token references in the component or create an adapter layer mapping the new component's expected tokens to the existing system's tokens.

##### 9.7.3 Dino's Solution — Token-Native Component Addition

Because Dino hosts the design system template and controls both the component library and the token architecture, new components can be added to a customer's design system with zero migration cost:

**In Figma:** The Dino plugin adds new components directly into the customer's template file. Because the plugin controls the variable binding, new components are bound to the customer's existing variable collections at insertion time. The component adopts the customer's brand tokens automatically — it was never in a "foreign" token context.

**In code:** New components are added to the `@dynodesign/components` package. Because all components in the package consume the same CSS custom property names (the closed 12-tone vocabulary), a new component added to the package immediately works with the customer's existing CSS token files. No re-generation, no re-mapping, no adapter layer. The component uses `var(--Text)`, `var(--Border)`, `var(--Buttons-Primary-Button)` — the same variables every other component uses.

**In the hosted playground:** New components appear automatically because the playground renders the latest component library against the customer's stored tokens.

This is the key advantage of a hosted, ID-synchronized design system over a static export: the design system grows without the customer doing anything.

##### 9.7.4 Customer-Initiated Design System Updates

Once a design system is created in Dino Design, the brand foundation is locked — the customer cannot upload a new photo, change extracted colors, or regenerate the color scheme. This is intentional: the extracted palette and 12-tone scale are the structural foundation that guarantees accessibility, and regenerating them would invalidate all downstream token relationships.

What the customer CAN change at any time:
- **Assigned colors** — reassign which palette maps to which surface role
- **Fonts** — swap header, body, and decorative typefaces
- **Button style** — switch between Primary, Secondary, Tonal, Laddered, or Black/White
- **Card coloring** — Tonal, White, or Black
- **Text coloring** — Tonal or Black & White
- **Navigation element assignments** — Surface, Surface-Dim, Surface-Bright, Primary, Primary-Light, Black, White

These changes are pushed to both code (CSS regenerated and uploaded to the same ID) and Figma (plugin pulls updated tokens) simultaneously. The customer's design system is updated across all channels in seconds, not days.

This is the distinction between a **brand foundation** (locked — ensures structural accessibility) and **design decisions** (flexible — customer controls the look and feel within the accessible framework). No prior art design system tool makes this distinction. Prior art either locks everything (static export) or allows everything to change (risking accessibility violations).

##### 9.7.5 Update Acceptance Model

Updates are not forced. The customer is notified (via email, in-app message, or plugin notification) and chooses to accept. The acceptance model varies by channel:

- **CSS (hosted):** Updates to the hosted playground are immediate (the customer always sees the latest). Updates to the customer's local CSS files require explicit acceptance via CLI.
- **Figma:** The plugin shows available updates and the customer triggers the sync. No automatic changes to the customer's Figma file.
- **npm package:** Standard npm versioning — customer updates when ready.

This preserves customer control while enabling Dino to ship improvements continuously.

#### 9.8 Patent Claims

**CLAIM 05  Design Tool License Tier Bypass via Pre-Built Template   Confidence: HIGH**
A design system delivery method wherein a pre-built design tool template file contains variable collections configured with a number of modes exceeding the mode creation limit imposed by the user's license tier, such that the user can consume and utilize all pre-built modes (populated via plugin using a persistent identifier) despite being restricted from creating collections with that number of modes — effectively providing Enterprise-tier variable architecture to Free and Professional license holders without requiring a license upgrade.

**CLAIM 06  Constraint-Optimized Variable Collection Partitioning   Confidence: HIGH**
A method for structuring a design system within a design tool's variable system comprising: partitioning the token set into multiple semantically grouped variable collections, each independently consuming modes from the design tool's per-collection mode budget; and distributing variables across collections such that each collection remains under the design tool's per-collection variable limit — enabling a design system that exceeds any single collection's capacity constraints to be represented faithfully within the design tool's architectural limits.

**CLAIM 07  Zero-Migration Component Addition to Hosted Design System   Confidence: HIGH**
A method for adding new components to a customer's branded design system comprising: adding a component to a hosted component library that consumes design tokens via a predetermined closed vocabulary of CSS custom property names; wherein the new component automatically inherits the customer's brand tokens because it references the same token names as all existing components — requiring no re-generation of the customer's token set, no manual token re-mapping, no adapter layer, and no design system migration. The new component is immediately available in the customer's hosted playground, installable via the existing CLI command, and bindable to the customer's Figma variable collections via the existing plugin — all synchronized through the customer's persistent identifier.

**CLAIM 08  Push-Update Design System with Customer Acceptance Model   Confidence: HIGH**
A design system delivery architecture wherein the system provider can push updates (bug fixes, token improvements, new components, documentation changes) to a customer's design system across multiple delivery channels simultaneously, with the customer receiving notification and choosing to accept per channel — such that the design system is a continuously improving service rather than a static export, while the customer retains control over when changes are applied to their local development and design tool environments.

**CLAIM 09  Locked Foundation / Flexible Decisions Design System Architecture   Confidence: HIGH**
A design system management method comprising: generating an accessible design system from image analysis with a locked brand foundation (extracted palette, tone scale, contrast mappings) that cannot be modified post-generation, ensuring structural accessibility guarantees are preserved; and simultaneously exposing a set of design decision parameters (color assignment, typography, button style, navigation styling) that the customer can modify at any time, wherein modifications are re-validated against the locked foundation's accessibility constraints and pushed to all delivery channels (CSS, Figma, hosted preview, AI documentation) through the customer's persistent identifier — such that the design system remains continuously customizable without ever becoming non-compliant.

**CLAIM 10  1:1 Component and Variant Naming Parity Across Design and Code   Confidence: HIGH**
A design system architecture wherein every component name, variant name, and variant value in the design tool template (Figma) is identical to the corresponding component name, prop name, and prop value in the code component library (React), such that the design specification produced by a designer using the design tool is directly translatable to code without a naming convention mapping, translation layer, or design-to-code dictionary — eliminating the class of implementation errors caused by naming mismatches between design and development artifacts. No prior art design system tool enforces this 1:1 naming parity as an architectural constraint across both design tool and code output.

**CLAIM 11  Token-Native Design Tool Component Insertion   Confidence: HIGH**
A method for adding components to a customer's design tool file comprising: inserting a new component into the customer's pre-existing design tool template via a plugin; binding the new component's variable references to the customer's existing variable collections at insertion time; such that the inserted component adopts the customer's brand tokens automatically without carrying foreign token references, without requiring manual re-binding, and without the token conflict that occurs when components are copied between design tool files with different variable architectures.

---

## 8. Amendments to DYNO-IP-2025-008 — Font Detection and Typography (Section 7)

### Add Section 7.2.1: LLM-Based Typographic Intent Analysis

**7.2.1 LLM as Typographic Reasoning Engine**

Dino's font detection does not use a purpose-built font recognition model (WhatTheFont, Adobe Font Finder, Fontspring Matcherator). Instead, it uses a general-purpose large language model (LLM) to perform **typographic intent analysis** — a fundamentally different class of operation.

Purpose-built font recognition models are trained to answer one question: "What font is this?" They output a font name or a ranked list of candidates. They cannot reason about why a font was chosen, whether the capitalization is a design decision, or what the tracking communicates about the brand.

Dino's LLM analyzes the uploaded image and extracts structured typographic characteristics:

| Characteristic | What the LLM Detects | What Prior Art Detects |
|---------------|---------------------|----------------------|
| Classification | Serif, Sans-serif, Slab, Display, Handwritten, Monospace — with sub-classification (e.g., Didone vs Transitional serif) | Font name only |
| Weight | Specific weight (Thin, Light, Regular, Medium, Semibold, Bold, Black) inferred from stroke contrast | Not detected — returned as font metadata if the font is identified |
| Letter spacing | Tight, Normal, Wide — detected from character spacing in the image | Not detected |
| Width | Condensed, Normal, Extended — detected from character proportions | Not detected |
| Capitalization intent | Whether all-caps usage is a typographic design decision (branding, hierarchy) vs incidental (the text happens to be caps) | Not detected |
| Hierarchy role | Whether the detected text serves as heading, body, or accent based on visual positioning and size relationships | Not detected |

The critical distinction: prior art font detection answers "what font is this?" Dino's LLM answers "what typographic decisions were made and why?" This is intent analysis, not identification.

**7.2.2 Structured Output to Free Equivalent Matching**

The LLM's structured output (classification, weight, spacing, width, capitalization) is scored against the Google Fonts corpus to find the nearest free equivalent. This scoring is multi-dimensional — a match must satisfy classification, weight range, and width characteristics simultaneously. A condensed bold geometric sans-serif maps to a different Google Font than a normal-weight humanist sans-serif, even though both are "sans-serif."

The pipeline:
1. LLM analyzes image → structured characteristics (JSON)
2. Characteristics scored against Google Fonts metadata
3. Top candidates ranked by multi-dimensional similarity
4. Best match selected as default typography token
5. Full CSS typography tokens generated (font-family, weight, letter-spacing, text-transform)

The customer never touches font licensing. The output is always a free, self-hostable Google Font.

### Replace Section 7.3 with:

**7.3 Scenario B — No Font in Image: LLM Mood-Based Font Trio Inference**

When no detectable typography is present in the uploaded image, Dino does not fall back to a default font. Instead, the LLM analyzes the visual mood of the entire image — derived from color temperature, saturation distribution, composition style, texture, and dominant palette characteristics — and infers a **typographic personality**.

The LLM's mood analysis considers:

| Signal | Typographic Inference |
|--------|----------------------|
| Warm colors, organic textures | Transitional or humanist serifs; warm, approachable body fonts |
| Cool colors, minimal composition | Geometric sans-serifs; clean, modern body fonts |
| High saturation, bold contrast | Display serifs or strong slab serifs; impactful headings |
| Muted tones, fine detail | Didone or thin-weight serifs; elegant, refined typography |
| Earth tones, natural imagery | Slab serifs or rustic display fonts; grounded, authentic voice |
| Monochromatic, high contrast | Grotesque or neo-grotesque sans-serifs; minimal, contemporary |

From this analysis, the LLM suggests a curated font trio:
- **Header font** — expressive, establishes brand voice (display or serif)
- **Body font** — readable, complements the header (typically sans-serif or humanist serif)
- **Decorative/accent font** — functional, used for labels, captions, and UI elements

**What makes this novel:** No prior art design system tool, font tool, or design tool infers typography from image mood in the absence of detected fonts. The mood-to-font-trio mapping requires cross-domain reasoning — connecting visual aesthetics to typographic personality — which is uniquely enabled by LLM capabilities. A purpose-built font recognition model cannot perform this inference because it has no concept of "mood" or "personality."

### Add to Section 7.6 (Patent Claims):

**CLAIM 05  LLM-Based Typographic Intent Analysis   Confidence: HIGH**
A method for typography detection comprising: submitting an image containing typographic content to a general-purpose large language model; extracting structured typographic characteristics including classification with sub-classification (e.g., Didone serif vs Transitional serif), weight, letter spacing, character width (condensed/normal/extended), and capitalization intent (design decision vs incidental); wherein the LLM performs typographic intent analysis — reasoning about why typographic decisions were made — rather than font identification, producing a structured characteristic set that enables multi-dimensional matching to a typeface corpus regardless of whether the specific source font is identifiable.

**CLAIM 06  Multi-Dimensional Free Equivalent Scoring   Confidence: HIGH**
A method for automated font substitution comprising: receiving a structured set of typographic characteristics (classification, weight, spacing, width, capitalization) from image analysis; scoring said characteristics simultaneously against a corpus of freely available typefaces using multi-dimensional similarity matching; and selecting the nearest free equivalent that satisfies all characteristic dimensions — such that the substitution preserves the typographic intent of the source (condensed bold geometric sans maps to a different substitute than normal-weight humanist sans) rather than matching on classification alone.

**CLAIM 07  LLM Mood-to-Typography Cross-Domain Inference   Confidence: HIGH**
A method for typography selection in the absence of detectable text comprising: submitting a non-typographic image to a large language model; analyzing visual mood signals including color temperature, saturation distribution, composition style, and texture; mapping the inferred mood to a typographic personality using cross-domain reasoning (visual aesthetics → typographic character); and selecting a curated trio of typefaces (header, body, accent) that collectively express said typographic personality — wherein the inference requires cross-domain reasoning capabilities unique to general-purpose language models and cannot be performed by purpose-built font recognition systems.

**CLAIM 08  Hierarchy-Aware Multi-Font Detection   Confidence: MEDIUM**
A method for detecting multiple typographic roles in a single image comprising: identifying distinct text elements in the image; classifying each element's hierarchical role (heading, body, accent) based on visual positioning, relative size, and weight; extracting independent typographic characteristics for each role; and generating a multi-role font specification (header font, body font, decorative font) from a single image input — such that the design system receives a complete typography configuration rather than a single font identification.

---

## 9. Updates to Section 11 — Product Architecture & Delivery

### Replace 11.1 Token Architecture with:

**11.1 Token Architecture**

The CSS architecture uses a layered variable chain: Base colors → Semantic tokens → Component tokens → Theme tokens → Surface variant tokens → Mode overrides → Resolved values. DynoDesignProvider loads CSS via URL or raw CSS string.

The architecture includes four additional override layers not present in any prior art design system:
- **Platform layer** (`[data-platform]`): iOS Mobile, iOS Tablet, Android, Desktop — typography scales, touch target spacing, container padding (covered by Capital One patent under Apache 2.0; DynoStack smart gap enforcement is Dino's independent invention — DYNO-IP-2025-004)
- **Font layer** (`[data-fonts]`/`[data-fonts="Default"]`): Brand fonts vs native system fonts per platform
- **Cognitive layer** (`[data-cognitive]`): Dyslexia and ADHD accommodations via token overrides (covered by Capital One patent, used under Apache 2.0 license)
- **Surface variant layer** (`[data-surface]`): Adjacent-tone surface variants with per-variant full token resolution

Security model: Free preview CSS is intentionally incomplete (~10% of the system — base colors only). Paid files are served through Supabase Edge Functions that verify is_paid status before returning full CSS.

### Add to 11.2 Tech Stack:

| Category | Detail |
|----------|--------|
| Color space | LCH (Lightness, Chroma, Hue) — perceptually uniform |
| Tone scale | 12-tone, independently designed for light and dark modes |
| Chroma | Per-mode bell curves, max 70 (light) / 42 (dark) |
| Platform tokens | `[data-platform]` — iOS Mobile, iOS Tablet, Android, Desktop |
| Cognitive a11y | `[data-cognitive]` — Dyslexia (OpenDyslexic), ADHD modes |
| Surface variants | Adjacent-tone (N±1, N-2) with per-variant full token sets |
| Container elevation | Shadow-based (light), tone-stepped (dark) |
| Contrast verification | Computational proof across 360 hues × all tone pairs |

---

## 10. Amendments to DYNO-IP-2025-011 — Real-Time Accessibility Check (Section 10)

### Replace Section 10.2 with:

**10.2 What Is Checked — Full Component State, Interaction, and ARIA Coverage**

Dino's accessibility check goes beyond static contrast verification. It tests every component across all interactive states, verifies minimum target areas, and validates proper ARIA tagging — ensuring accessibility is maintained throughout the entire user interaction lifecycle, not just in the default resting state.

#### 10.2.1 Contrast Checks Across All States

| Element | States Tested | WCAG Criterion | Required Ratio |
|---------|--------------|----------------|----------------|
| Body text to background | Default | 1.4.3 (AA) | 4.5:1 |
| Header text to background | Default | 1.4.3 (AA, large text) | 3.1:1 |
| Quiet/secondary text to background | Default | 1.4.3 (AA) | 4.5:1 |
| Border to background | Default | 1.4.11 (AA) | 3.1:1 |
| Hotlink text to background | Default, Visited | 1.4.3 (AA) | 4.5:1 |
| Button background to surface | Default, Hover, Active, Focus | 1.4.11 (AA) | 3.1:1 |
| Button text to button background | Default, Hover, Active, Focus | 1.4.3 (AA) | 4.5:1 |
| Focus Visible indicator to surface | Focus | 2.4.11 (AA) | 3.1:1 |
| Icon to background | Default | 1.4.11 (AA) | 3.1:1 |
| Tag text to tag background | Default | 1.4.3 (AA) | 4.5:1 |

Critical distinction: prior art tools (axe, Lighthouse, WAVE) test contrast in the **default state only**. A button may pass contrast at rest but fail on hover if the hover state shifts the background into a low-contrast range. Dino tests every state independently.

#### 10.2.2 Interactive State Contrast Preservation

Hover and active states in Dino are predetermined tone shifts in the 12-tone scale. The check verifies:
- Text contrast maintained when background shifts to hover tone
- Text contrast maintained when background shifts to active tone
- Focus visible indicator (blue, surface-anchored) maintains 3.1:1 against default AND hover/active backgrounds
- Button text maintains 4.5:1 against button hover and active backgrounds

#### 10.2.3 Minimum Target Area

All interactive components verified against WCAG 2.5.8, platform-adjusted:

| Component | Desktop Min | iOS | Android |
|-----------|-----------|-----|---------|
| Button (small) | 24 × 24px | 44px height | 48px height |
| Button (medium) | 32 × 32px | 44px height | 48px height |
| Link / Hotlink | 24 × 24px | DynoStack enforced | DynoStack enforced |
| Icon button | 24 × 24px | 44px | 48px |
| Checkbox / Radio | 24 × 24px | Platform-scaled | Platform-scaled |
| Select trigger | 32px height | Platform-scaled | Platform-scaled |

#### 10.2.4 ARIA Validation

Every component in `@dynodesign/components` is tested for proper ARIA tagging:

| Check | What It Validates |
|-------|------------------|
| `role` attribute | Correct semantic role for component type (button, checkbox, dialog, tab, etc.) |
| `aria-label` / `aria-labelledby` | Interactive elements have accessible names |
| `aria-expanded` | Expandable components (accordion, dropdown, select) declare state |
| `aria-selected` | Selection components (tabs, radio, toggle) declare selection state |
| `aria-haspopup` | Components that open popups/menus declare it |
| `aria-disabled` | Disabled state communicated to assistive technology, not just visually |
| `aria-live` | Dynamic content regions declare update behavior |
| `aria-describedby` | Error states and helper text properly linked |

ARIA validation runs via jest-axe in the component test suite and is re-verified in the Playground's real-time accessibility check against the customer's actual token environment.

#### 10.2.5 The Accessibility Report

The downloadable report provides a complete audit across every background context in the system:

**4 Surface levels per theme:**
- Surface (default)
- Surface-Dim (N-1)
- Surface-Dimmest (N-2)
- Surface-Bright (N+1)

**5 Container levels per theme:**
- Container-Lowest (Effect-Level-negative-1)
- Container-Low (Effect-Level-1)
- Container (Effect-Level-2)
- Container-High (Effect-Level-3)
- Container-Highest (Effect-Level-4)

**For each of these 9 background contexts, across every theme:**
- All token pairs (text/bg, header/bg, quiet/bg, border/bg, button-text/button-bg, icon/bg, tag-text/tag-bg, hotlink/bg)
- All interactive states (default, hover, active, focus)
- Focus Visible indicator contrast to surface (3.1:1)
- Minimum target areas per platform
- ARIA compliance per component

This is the **proof of compliance** — an auditable artifact, not a badge.

### Add to Section 10.5 (Patent Claims):

**CLAIM 05  Full-State Interactive Contrast Verification   Confidence: HIGH**
A component accessibility evaluation method wherein contrast ratios are verified independently for each interactive state — including default, hover, active, focus, and disabled — against both the component's foreground tokens and the surface or button background in that state, detecting state-specific contrast failures invisible to default-state-only audit tools.

**CLAIM 06  Platform-Aware Target Size Verification   Confidence: HIGH**
A component accessibility evaluation method wherein minimum interactive target sizes are verified against platform-specific requirements determined by the active `[data-platform]` token context, evaluating against iOS (44px), Android (48px), or desktop (32px) requirements based on the deployment context.

**CLAIM 07  Multi-Dimensional Accessibility Report Generation   Confidence: HIGH**
A method for generating a comprehensive accessibility compliance report evaluating every token pair across every theme, surface variant, container level, interactive state, and platform context — producing an auditable artifact documenting every contrast ratio, target size, focus indicator evaluation, and ARIA compliance result for the entire design system.

**CLAIM 08  Integrated ARIA Validation in Component Accessibility Check   Confidence: HIGH**
A component accessibility evaluation system wherein ARIA attribute correctness (roles, labels, states, properties) is verified both in automated testing (jest-axe) and in the real-time Playground accessibility check, such that ARIA compliance is evaluated against the component's actual rendered state in the customer's token environment — not against a static template or assumed default configuration.

**CLAIM 09  AI Coding Assistant Accessibility Validation via Custom Command   Confidence: HIGH**
A method for validating accessibility of AI-generated code within an AI coding assistant environment (Claude Code, Cursor) comprising: providing a custom slash command (e.g., `/a11y-check`) that analyzes the generated HTML/JSX against the design system's known token vocabulary, data-attribute cascade structure, and WCAG requirements; verifying that `data-theme`, `data-surface`, and `data-platform` attributes are correctly applied; confirming contrast ratios for all token pairs in the generated component's context; and reporting violations inline in the AI assistant's response — such that accessibility compliance is verified at code generation time, before the code reaches a browser or build system.

**CLAIM 10  Design Tool Plugin Accessibility Validation   Confidence: HIGH**
A Figma plugin capability that validates accessibility compliance of components within the design tool environment, comprising: evaluating contrast ratios between variable-resolved foreground and background colors in the customer's active variable collection; verifying minimum target sizes against platform-specific requirements encoded in the variable collection's platform modes; and reporting violations within the design tool interface — such that designers receive accessibility feedback during the design process rather than after handoff to development.

---

## 11. PROVISIONAL — DYNO-IP-2025-016 — VS Code Extension for Token Cascade Validation

**Document ref.** DYNO-IP-2025-016
**Status:** PROVISIONAL — Under Consideration
**Date:** March 2026

### 16.1 Summary

A VS Code extension that validates proper usage of Dino's data-attribute token cascade in developer code, ensuring `data-theme`, `data-surface`, `data-platform`, and `data-cognitive` attributes are applied correctly.

### 16.2 What the Extension Validates

| Check | What It Catches |
|-------|----------------|
| `data-theme` presence | Components outside a theme context (tokens undefined) |
| `data-surface` nesting | Surface variants without parent theme |
| `data-surface` valid values | Typos or invalid surface names |
| `data-platform` on root | Missing platform declaration |
| Component prop matching | Invalid variant props |
| Nested theme warnings | Unintended cascade from `data-theme` inside `data-theme` |
| Missing DynoDesignProvider | Component usage without provider wrapper |
| ARIA completeness | Interactive components missing required ARIA attributes |
| Contrast validation | Resolves token references in context and verifies WCAG contrast ratios at authoring time |
| Target size check | Flags interactive elements below minimum target size for the active `data-platform` |
| Hover/focus state contrast | Verifies contrast is maintained in hover, active, and focus states — not just default |
| Focus Visible | Confirms focus indicator has 3.1:1 contrast against the resolved surface |
| Color-only information | Detects cases where color alone communicates meaning without a secondary indicator |

#### 16.2.1 Why This Is Different from Existing A11y Linters

Existing VS Code accessibility extensions (axe Linter, eslint-plugin-jsx-a11y) check static HTML/JSX for missing attributes — `alt` text, `role`, `aria-label`. They have no knowledge of the design system's token architecture. They cannot:

- Resolve `var(--Colors-Primary-Color-9)` to a hex value and compute contrast
- Understand that `data-theme="Primary"` establishes a color context that changes all child tokens
- Verify that a `data-surface="Surface-Dim"` descendant maintains contrast with its own (different) text token
- Check hover/active state contrast because the state colors are token references, not inline styles

Dino's extension can do all of this because it knows the 12-tone scale, the token mapping table, and the data-attribute cascade architecture. It resolves the full token chain at authoring time and validates the resolved colors against WCAG — the same way the browser would resolve them at runtime, but before the code ever runs.

### 16.3 Patent Claims

**CLAIM 01 (PROVISIONAL)  Design Token Cascade Validation and Accessibility Checking in Development Environment   Confidence: HIGH**
A development environment extension that validates both structural correctness and accessibility compliance of a data-attribute-driven design token architecture at authoring time, comprising: verifying data-attribute cascade correctness (theme, surface, platform context); resolving CSS custom property token references to their terminal color values using knowledge of the design system's 12-tone palette and mapping table; computing WCAG contrast ratios for all resolved foreground/background pairs including hover, active, and focus states; verifying minimum target sizes against platform-specific requirements; confirming focus indicator contrast against resolved surface colors; and surfacing violations as inline editor warnings — such that accessibility compliance is verified during code authoring rather than requiring runtime rendering, browser-based audit tools, or manual inspection.

**CLAIM 02 (PROVISIONAL)  Token-Aware Contrast Resolution in Development Environment   Confidence: HIGH**
A method for evaluating color contrast in a development environment wherein CSS custom property references (e.g., `var(--Colors-Primary-Color-9)`) are resolved to hex color values using the design system's known palette definition, and WCAG contrast ratios are computed against the resolved background color determined by the active `data-theme` and `data-surface` attribute context — enabling contrast validation that is impossible for generic accessibility linters which cannot resolve design token references or understand cascading attribute-driven color contexts.

Note: These claims are provisional. The IP position is established regardless of shipping timeline.

---

## 12. Updated IP Registry Table (Section 2)

Add these rows to the Document Ref table:

| Document Ref. | Subject |
|--------------|---------|
| DYNO-IP-2025-012 | Adjacent-tone surface variant system with per-variant token resolution |
| DYNO-IP-2025-013 | Dual-mode container elevation (shadow-based light, tone-stepped dark) |
| DYNO-IP-2025-015 | Channel-optimized token resolution — resolved hex for CSS, indirection chain for Figma |
| DYNO-IP-2025-010 (addendum) | Figma license tier bypass via pre-built template + constraint-optimized variable partitioning |
| DYNO-IP-2025-011 (addendum) | Full-state, full-component accessibility verification including hover, focus, active, and min target area |
| DYNO-IP-2025-011 (addendum) | AI coding assistant a11y validation via custom slash command |
| DYNO-IP-2025-011 (addendum) | Figma plugin accessibility validation |
| DYNO-IP-2025-016 (provisional) | VS Code extension for data-attribute validation and token cascade enforcement |
| *(No filing)* | Cognitive accessibility token layer — covered by Capital One patent under Apache 2.0 |
