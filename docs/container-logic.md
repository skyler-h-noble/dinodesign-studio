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

### White cards (light mode)

Face is **Neutral Color-12**. The opacities sit high because white cards must
still read as white — the lower levels only let a little of the page through.

| Level | Opacity |
| --- | --- |
| `Container-Lowest` | 92% |
| `Container-Low` | 94% |
| `Container` | 97% |
| `Container-High` | 98% |
| `Container-Highest` | **Neutral Color-12** |

### Black cards (light mode)

Face is **Neutral Color-1**. This ramp runs the **other way**: the floor is the
pure colour and the higher levels let the page bleed through, so a raised card
lightens against a light page.

| Level | Opacity |
| --- | --- |
| `Container-Lowest` | **Neutral Color-1** |
| `Container-Low` | 96% |
| `Container` | 94% |
| `Container-High` | 92% |
| `Container-Highest` | 90% |

Note the pure level is `Lowest` here, not `Highest`.

### Dark mode

Dark mode keeps its own ladder and blends **Color-3 over Color-2** rather than
over the background: 50 / 65 / 75 / 90 / Color-3.

---

## Which tone a tonal card uses

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
  Color-12. There is nothing to blend with; elevation comes from the drop
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
```

The ramp test covers every `Background-N`, not just the four a user can pick — a
themed zone can put a container on any of them, and both failure modes (running
backwards, or flat) are invisible without an assertion.
