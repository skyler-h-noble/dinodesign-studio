# Background selection

The page background is **a theme and a surface level** — the same vocabulary
components use (`data-theme` + `data-surface`), rather than four opaque strings.

Source: `src/utils/backgroundSelection.ts`. Tests:
`src/__tests__/backgroundSelection.test.ts`.

---

## The grid

Four themes × five surface levels = **20 backgrounds**. At core tone 6:

| theme | Dimmest | Dim | Base | Bright | Brightest |
| --- | --- | --- | --- | --- | --- |
| Primary | Color-1 | Color-4 | **Color-6** \* | Color-9 | **Color-11** \* |
| Secondary | Color-1 | Color-4 | Color-6 | Color-9 | Color-11 |
| Tertiary | Color-1 | Color-4 | Color-6 | Color-9 | Color-11 |
| Neutral | **Color-1** \* | Color-3 | Color-6 | Color-9 | **Color-12** \* |

\* the four options that existed before, resolving to exactly the tones they
always did.

| Legacy string | Theme | Surface |
| --- | --- | --- |
| `white` | Neutral | `Surface-Brightest` |
| `black` | Neutral | `Surface-Dimmest` |
| `primary-base` | Primary | `Surface` |
| `primary-light` | Primary | `Surface-Brightest` |

---

## Two rules that are not tidy, on purpose

**`Surface-Brightest` is Color-12 on Neutral and Color-11 on a chromatic
theme.** Neutral's Color-12 is the white page. On a chromatic ramp Color-12 is
so desaturated that it also reads as white, throwing away the tint that makes it
a *branded* background — Color-11 is the brightest tone that still reads as the
brand. This is not a new asymmetry: `white` was already Neutral-12 and
`primary-light` already Primary-11.

**A chromatic theme's levels are placed *between* anchors, not at fixed tones.**
`Surface` is the brand's own core tone, which moves per brand, so fixed
neighbours do not survive: measured across cores 1-12, the table
`[1, 3, core, 9, 11]` put `Surface-Bright` **below** `Surface` at core 10 and
collided with `Surface-Dim` at core 3 — only cores 4-8 stayed ordered. The
levels now interpolate:

```
Surface-Dimmest   = 1
Surface-Dim       = midpoint of 1 and core
Surface           = core          (clamped to [3, 9])
Surface-Bright    = midpoint of core and 11
Surface-Brightest = 11
```

A picker that shows "Bright" darker than "Base" reads as a rendering bug rather
than a mapping one, so ordering is asserted for every core.

---

## How it is stored

The four combinations that have a legacy name **keep storing that name**. A
system saved today still opens in an older build, and the ~40 consumers that
branch on `'white'` / `'black'` / `'primary-base'` / `'primary-light'` keep
matching. The other sixteen store `Theme/Surface`, e.g. `Secondary/Surface-Dim`.

`parseBackground()` reads either form, plus the `backgroundTheme` +
`backgroundN` fields that already existed on `UserSelections`. Unrecognised
input falls back to white rather than throwing — a stored value from a future
build should not blank the studio.

No migration is needed. Nothing was rewritten in Firestore.

---

## Why the export needed almost no change

`backgroundTheme` and `backgroundN` were already required fields, and
`defaultThemeLogic` already preferred them over the string. `defaultConfig.theme`
is just a string used to build `{Backgrounds.<theme>.Background-<n>...}`
references, so Secondary and Tertiary work without a new code path.

Two wiring gaps did need closing:

- **Dark mode.** The fallback honoured `backgroundN`, which is a LIGHT-mode
  position — a `Surface-Brightest` pick would have painted a near-white page in
  dark mode. The theme carries over, the tone does not: in dark mode the page
  is the chosen palette's **tone 2** (see [Dark mode](#dark-mode-the-ladder)
  below).
- **The preview.** `buildPreviewCSS` had a case per legacy string and a
  `default:` that fell through to white, so all sixteen new combinations would
  have previewed as a white page while the export painted the real one — a
  textbook [invariant 5](../CLAUDE.md#design-system-invariants) divergence. It
  now resolves through the same table.

---

## Accessibility

Swept across the full grid — 20 backgrounds × 3 card styles × both modes, every
surface and container level: **0 failures**.

```bash
npx tsx scripts/audit-containers.ts
```

While sweeping, two levels turned out never to have been graded at all.
`addSurfaceEnds` emits `Surface-Dimmest` and `Surface-Brightest`, but the copy
into the `Backgrounds` tree listed only three surface keys, so both were
computed and then dropped — and the report, which looks them up there, silently
skipped them. The report's own list also said "eight surface levels" and named
eight, when the system emits ten. Both are fixed; the ends now resolve and pass.

The ends reaching `Backgrounds` means they also reach the Figma payload. Adding
variables is recoverable; **deleting them is not** (invariant 8), so do not
"clean up" the two new keys.

---

## Dark mode: the ladder

Decided by the owner (final model, 2026-11-03). In dark mode every theme —
Default included, no special case — paints its five levels like this, on its
own palette (the Default theme: the page-background palette):

| level | dark mode paints |
| --- | --- |
| Surface-Dimmest | **pure black `#000000`** |
| Surface-Dim | tone 1 |
| Surface | tone 2 — so the dark **page** is tone 2 |
| Surface-Bright | tone 3 |
| Surface-Brightest | tone 4 |

Strictly darkest to lightest, all inside the dark band. Light mode does not
change: the grid above is the light-mode picture.

**Surface-Dimmest is black for every theme.** That is the owner's deliberate
choice; a tinted tone 1 is not wanted there. It no longer depends on whether
the designer picked a Black page or black cards.

Cards sit on top of these as **solid colors mixed from tone 5 and the surface
they are on** — 45 / 60 / 75 / 88 / 100% tone 5, `blendColors`, no opacity —
see [Container logic](container-logic.md#dark-mode--solid-colors-mixed-from-tone-5-and-the-surface).
Each surface level declares its own five card colors and the cards inherit
them. Figma holds one value per theme, so its cards are the mix on the page
(tone 2) wherever they sit; the CSS and preview mix per surface. Tone 5 is the
first tone the surfaces do not use, so a card is always lighter than the
surface under it. A card inside a card uses a higher Container level (High or
Highest).

This replaces a first dark ladder from earlier the same day (every surface
one tone higher, no black, cards lifted along each surface's ramp).

### How it gets there

Source: `src/utils/darkLadder.ts` (rules) and
`src/utils/cssgen/darkLadderPass.ts` (applied to the JSON at the end of
`exportColorSystemToJSON`, so the CSS export and the Figma payload both read
it).

The Theme layer is mode-independent — Figma builds it once, from Light-Mode —
and it names LIGHT-mode tone indices: Primary's Surface reads
`{Text.Surfaces.Neutral.Color-6}` because it paints tone 6 in light mode. So
the dark ladder lives in the Modes layer: in dark mode the table entry at a
light-mode index holds the curated answer for the dark tone that index is
painted at. Each theme's window of indices is read from its own references;
where two themes name one index for different tones, the entry answers for the
lighter one, which is safe because every dark-mode foreground is lighter than
its surface. Black has no row of its own in the tables (they are keyed by tones
1-12), so Surface-Dimmest reads tone 1's answers — by the same rule, whatever
passes on tone 1 passes on black.

The few references that named a tone directly — a theme's Surface-Dimmest /
Brightest (`{Colors.<P>.Color-3}` / `-11`), Neutral's black anchor, the
Default theme's Surface-Dimmest — now name a Backgrounds row (or
Default-Background), which resolves to the same tone in light mode.

`DARK_PAGE_N` (2) is the tone the page paints; the export reads its tables at
the page palette's Surface index, through the same window.

Tests: `src/__tests__/darkLadder.test.ts` (what the CSS paints per brand x
theme, the preview and Figma agree, light mode byte-identical).

## Related

- [Container logic](container-logic.md) — what sits *on* these backgrounds.
- [Design system architecture](design-system-architecture.md).

## Bars use the theme's levels, not this grid

The App Bar, Nav Bar and Status Bar pickers use the same Theme × level
vocabulary, but **not** this grid's tones. A bar's level is the theme's own
surface level of that name — `surfaceWindow` (Dim = core − 1, Bright = core + 1,
Dimmest / Brightest anchored) — via `barToneFor` in `backgroundSelection.ts`.

Why: a bar is published to Figma as a Theme mode plus a Surface mode, and Figma
can only show a tone some surface level actually has. On this grid Popsicles'
"Tertiary · Bright" was tone 9, which no Tertiary level uses (3 / 5 / 6 / 7 / 11),
so code drew a light blue no Figma setting could reproduce. Decided 2026-10-20.

The page background keeps this grid; only bars changed.

Neutral bars read Neutral's **locked** window — black / 9 / 10 / 11 / white
(`neutralSurfaceWindow`) — which is what the export's Neutral theme paints. They
briefly kept this grid's Neutral ladder, so "Neutral · Base" was a mid grey in
the studio and a near-white in Figma. The Advanced button-tone grid uses the
same ladders, and `tokenParity.test.ts` checks all twenty of its cells against
the export in both modes.
