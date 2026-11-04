# Container logic

How the five container levels get their colours, for every card style and mode.

Containers are the one part of the background system where the value is usually
*not* a palette tone. Four of the five levels are blends, and every rule below
exists because a plausible-looking wrong value shipped at least once.

Two implementations produce these values and they must agree
([invariant 5](../CLAUDE.md#design-system-invariants)):

| | file |
| --- | --- |
| Export / Figma | `src/utils/cssgen/generateSimplifiedBackgrounds.ts` |
| Phone preview | `src/utils/buildPreviewCSS.ts` |
| Dark-mode cards (both, shared) | `src/utils/darkLadder.ts` (`DARK_CARD_ALPHA`, `darkCardHex`), written by `cssgen/darkLadderPass.ts` |

Verified by `src/__tests__/containerTone.test.ts` and
`scripts/audit-containers.ts`.

---

## How a card style is selected

This is the part that is easy to get wrong, because the card style is **not**
read where the colours are made.

`getContainerVars` in `exportColorSystem.ts` decides which `Background-N` row a
theme's containers alias into:

| Card style | ContTheme | ContN | Row the containers read |
| --- | --- | --- | --- |
| White | `Neutral` | 12 | `Backgrounds.Neutral.Background-12` |
| Black | `Neutral` | 1 | `Backgrounds.Neutral.Background-1` |
| Tonal | the surface's theme | the surface's N | that surface's own row |

So white and black cards are **always Neutral** — Color-12 and Color-1 — no
matter which palette the surrounding theme uses. Only tonal cards follow the
theme.

The generator is then told the user's style so each row carries the right ramp.
It used to be hardcoded to `'tonal'`, which made the `professional` and `black`
branches unreachable — see [History](#history).

---

## The shape: one colour at five opacities

Every ramp is **one colour composited over the background** at rising opacity —
`blendColors(face, background, alpha)`, the same "white at X% over the page"
operation in all three cases. Not five different tones. Elevation reads as the
card gaining or losing presence against a fixed page, so the levels stay
unmistakably the same material and the steps can sit closer together than whole
tones allow.

Exactly **one level is the pure colour, and it is the only one that keeps a
token reference**. The other four are blends with no token to point at, so they
are emitted as hex.

> **Never emit token refs for the blended levels.** Doing so put the ramp on two
> curves at once — refs resolved to whole tones while their neighbours resolved
> to blends — and `Container-High` landed *below* `Container`. That is the
> non-monotonic bug, and it is silent.

---

## The three ladders

### Tonal cards (light mode)

Face is the theme's own tone: **Color-10** on a light background, **Color-2** on
a dark one. Rising elevation moves *away* from the page.

| Level | Opacity |
| --- | --- |
| `Container-Lowest` | 65% |
| `Container-Low` | 75% |
| `Container` | 85% |
| `Container-High` | 90% |
| `Container-Highest` | **the tone itself** |

**In light mode, color intensifies toward `Container-Highest` in every card
style.** Tonal reaches the pure tone, white takes on the most page, black
reaches pure black. White and black used to run the other way, so Highest was
their *least* colored level; they were reversed on 2026-10-10 using the same
five values, so `Container` itself did not move.

### White cards (light mode)

Face is **Neutral Color-12**. The opacities sit high because white cards must
still read as white — even the top level only lets a little of the page
through. The floor is pure white.

| Level | Opacity |
| --- | --- |
| `Container-Lowest` | **Neutral Color-12** |
| `Container-Low` | 98% |
| `Container` | 97% |
| `Container-High` | 94% |
| `Container-Highest` | 92% |

On a very pale page (Color-11 and up) the steps are tiny and neighbours can
round to the same hex — see [Known-flat cases](#known-flat-cases).

### Black cards (light mode)

Face is **Neutral Color-1**. The lower levels let the page bleed through and
the top level is the pure colour.

| Level | Opacity |
| --- | --- |
| `Container-Lowest` | 90% |
| `Container-Low` | 92% |
| `Container` | 94% |
| `Container-High` | 96% |
| `Container-Highest` | **Neutral Color-1** |

### Dark mode — tone 4 mixed with the page, one set per theme

Owner's decision (2026-11-04). In dark mode the surfaces are tones 1-5 and the
page is tone 3 ([background-selection.md](background-selection.md#dark-mode-the-ladder)).
A card is the theme palette's **tone 4 — one step above the page — mixed with
the page (tone 3)**, with more tone 4 at each level. Every value is a **solid
color** — no opacity on containers:

| level | dark mode |
| --- | --- |
| `Container-Lowest` | 50% tone 4, 50% page |
| `Container-Low` | 65% tone 4 |
| `Container` | 75% tone 4 |
| `Container-High` | 90% tone 4 |
| `Container-Highest` | tone 4 itself |

The mix is `blendColors(tone4, tone3, share)` — the same function, and the same
"one color over the background" shape, light-mode cards use (above). It is
worked out ahead of time and written as a plain 6-digit hex; Highest stays a
reference to the palette's Color-4.

This is the card relationship the generator had before the ladder work ("Dark
mode keeps its own ladder and blends Color-3 over Color-2: 50 / 65 / 75 / 90 /
Color-3", up to 7ad2bf4 — one step above a tone-2 page), shifted up one tone
with the page. `generateSimplifiedBackgrounds`' dark rows still compute the old
Color-3-over-Color-2 mix; `darkLadderPass` step 5 replaces it. Two models in
between were rejected: cards lifted along each surface's ramp (7ad2bf4), and
tone 5 mixed with the surface under it (ab8c3e6 / 7ed5bc8).

**One set per theme, the same on every surface.** The mix is always against
the page, never against the surface a card happens to sit on, so a theme's five
card colors are identical on Surface-Dimmest, Dim, Surface, Bright and
Brightest. That is what lets every implementation hold exactly the same values:

- **Figma:** the Surface collection's Container modes hold one value per theme
  and level — these five. They are stored in the dark Backgrounds rows
  (`darkLadderPass`, step 5), every row of a palette carrying the same set.
- **CSS export:** the theme's Containers block declares the five, read from the
  same rows. No surface block declares a `--Container-*`.
- **Preview:** the page palette's five (`darkCardEmit`) and each Primary /
  Secondary / Tertiary section's own five, restated on the cards inside it.

`darkLadder.test.ts` asserts the exact `blendColors` values, the same five on
every surface level, and Figma == CSS == preview per theme.

Every card style (tonal, white, black) is tonal in dark mode: a theme's cards
use that theme's palette, and the Default theme's use the page palette. This is
what the generator did before the ladder work too. Black cards and a Black page
change only the surfaces (Neutral's tone 1 paints pure black — see
[background-selection.md](background-selection.md#dark-mode-the-ladder)); the
cards stay Neutral tone 4 over Neutral tone 3 for a Neutral page. The
light-mode [collision rule](#the-collision-rule) does not apply: the dark card
face is tone 4 and the page is tone 3, so they never coincide.

**Known consequence (accepted by the owner).** Surface-Bright *is* tone 4 and
Surface-Brightest is tone 5, so on those two levels the cards sit level with
(Highest on Bright) or darker than the surface. No workaround is applied: in
dark mode cards belong on the page and the Dim levels, where every level reads
as raised. `darkLadder.test.ts` asserts this shape so it cannot change
unnoticed.

**Card roles pass on every card color.** Every role a card carries (text,
quiet, links, eyebrow, headers, borders, icons, focus, buttons and their
outline labels, tags) is lighter than the card in dark mode, so it is hardest
to read on the lightest card — tone 4 itself (Highest). `darkLadderPass` step 6
checks each card table cell on tone 4; a passing cell is left exactly as it is,
a failing one moves the fewest steps up its own palette that clear it (the same
move the Card Quiet block makes). The Default theme's card roles key off
Highest too (`exportToCSS`, `faceHex`), so they read the tone-4 entries.
`darkLadder.test.ts` then checks every role on every card color of every theme
on every surface: 4,500 across the test systems, none failing.

The Quiet opacity table (`solveQuietOpacities`) measures each tone index on its
card ground as well as its surface ground. With the new cards and surfaces, a
few themed surface sections no longer share a tone's alpha and get one of their
own (`sectionQuietOverrides`) — 0 to 13 Figma variables per system.

**A card inside a card uses a higher Container level** — High or Highest inside
a Container card. The levels rise toward tone 4, so a higher level inside is
lighter than its parent and exactly the color that level has anywhere
(measured: 7,200 nested higher-level cards, none failing a role). A *lower*
level inside a higher one (Lowest inside Container) comes out darker than its
parent — that is not the pattern. Its roles still pass (9,000 measured), but use
a higher level.

---

## Which tone a tonal card uses

This section is the **light-mode** rule (a dark background in light mode, such
as Black, included). Dark mode's cards are solid mixes of tone 4 over the page
instead (above); `generateSimplifiedBackgrounds` still computes the old
Color-3-over-Color-2 mix for the dark rows, and the dark ladder pass replaces it.

The face follows the **background's lightness — not the mode**:

```js
const backgroundIsLight = surfaceBaseTone >= 5;   // 0-based; tones 1-5 dark, 6-12 light
const tonalContainerTone = backgroundIsLight ? 10 : 2;
```

A black background in *light mode* is still a dark background. Keying this on
`isDark` is a bug the preview carried: it drew a near-white Color-10 card on a
black page while the export drew a near-black one, and every test passed because
each side was internally consistent.

**Color-10, not Color-11.** A tonal container should read as a distinct card on
the surface; at Color-11 against a Color-10/11 surface the edge only showed up
through the shadow, and on the lightest surfaces it vanished.

### The collision rule

On `Background-10` (light) and `Background-2` (dark) the surface **is** the
container tone, so every opacity blends a colour with itself and the card is
invisible — no elevation, no edge, at all five levels. That was 16 of 103
Background-N combos.

Those step one tone away from the page instead: **Color-11** on a Color-10
surface, **Color-3** on a Color-2 one. A raised card catches more light.

---

## Why blending is safe here

All five levels alias into **one** nominal index, `config.contN`, and the
foregrounds are looked up as `{Text.Containers.<Palette>.Color-<contN>}`. One
foreground is computed for one tone and applied to all five levels.

Blending toward the **background** is safe because the text is chosen to
contrast the container, so moving toward the page moves *away* from the text.
Each step gains contrast rather than losing it.

This is why an earlier attempt failed and this one does not. The reverted logic
blended Color-10 toward the surface at a per-level 0.12 → 0.22 and moved
*`Container` itself* off the tone the foreground tables are keyed to, which
broke Quiet/Text/Header contrast on tonal themes. Here the anchor tone stays in
the ramp.

Measured: **0 contrast failures in 286,560 checks** — 4 brands × 4 backgrounds ×
3 card styles, both modes, every level. The harness is sensitive: forcing the
face to a mid tone produces 680 failures.

**The face must be Neutral for white and black cards.** Using the row's own
palette Color-2 for black cards instead produced **40 failures** on
`black bg · black cards`, because the report grades every `Background-N` row —
not only the Neutral one the theme actually reads — and the foregrounds are
keyed to Neutral.

---

## Known-flat cases

Not every ramp has range. These are correct rather than broken:

- **White cards on a white page.** 92% of Neutral Color-12 over Color-12 is
  Color-12, so all five levels are white. There is nothing to blend with; elevation comes from the drop
  shadow, which is what light mode uses anyway.
- **Any card style whose face equals its background**, outside the two tonal
  collisions handled above.

---

## History

Traps that have already cost a session.

**The caller hardcoded `'tonal'`.** Every `Background-N` row was generated in
tonal mode regardless of what the user picked, so the `professional` and
`black` branches in `lightModeBackgroundsBase` were dead code.

**The lightest-Neutral override.** Because of that, white cards were faked by a
guard that ignored `containerStyle` entirely:

```js
if (paletteName === 'Neutral' && tone === 99) {   // comment said "Background-14"
  // ALL containers → {White}
```

On the 14-tone scale tone 99 was a separate near-white step. On the **12-tone
scale tone 99 IS Color-12** — the ordinary white background — so it fired for
every white-background system and forced all five containers to white even when
the user picked tonal. It is the `--Container: #ffffff` in Cocktail Hour, Surf's
Up, Chocolated and Omni Design. Both are now gone: the real style is passed
through and each branch owns its ramp.

**A synthetic palette will not reproduce it.** A hand-built linear ramp whose
lightest tone is 100 skips that branch entirely and makes the export look
correct. Test against `generateSemanticLightModeScale`, not a fixture you wrote.

**Dead ramp variables.** `rampLowN` / `rampMidN` / `rampHighN` and
`darkColorLow` / `darkColorMid` / `darkColorHigh` in `darkModeBackgroundsBase`
are computed and never used — containers always take `palette[1]` / `palette[2]`.
The comment above them describes a Color-1/2/3 shift that no longer happens.

---

## Verifying a change

```bash
npx vitest run src/__tests__/containerTone.test.ts   # ramp shape, both pipelines
npx tsx scripts/audit-containers.ts                  # contrast, every level and style
npx vitest run src/__tests__/darkLadder.test.ts      # dark: tone-4 cards, one set per theme, roles pass
```

The ramp test covers every `Background-N`, not just the four a user can pick — a
themed zone can put a container on any of them, and both failure modes (running
backwards, or flat) are invisible without an assertion.
