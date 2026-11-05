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
  is the chosen palette's **tone 3** (see [Dark mode](#dark-mode-the-ladder)
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

Decided by the owner (2026-11-04). In dark mode every theme except the three
bands below — Default included — paints its five levels like this, on its own
palette (the Default theme: the page-background palette):

| level | dark mode paints |
| --- | --- |
| Surface-Dimmest | tone 1 |
| Surface-Dim | tone 2 |
| Surface | tone 3 — so the dark **page** is tone 3 (`DARK_PAGE_N`) |
| Surface-Bright | tone 4 |
| Surface-Brightest | tone 5 |

Strictly darkest to lightest, all inside the dark band. Light mode does not
change: the grid above is the light-mode picture.

**No pure black, except where the designer chose it.** A Black page
(`Neutral/Surface-Dimmest`, or the legacy `black`) or black cards keep the
selection rule from 7ad2bf4 (`blackChosen`): wherever the **Neutral** palette
paints its tone 1 — Neutral's Surface-Dimmest, and the Default theme's when
the page palette is Neutral — it paints `#000000` instead. Every other tone 1
is the palette's own tinted tone 1. (Before the ladder work, Neutral's
Surface-Dimmest was locked to black in dark mode for everyone; the black-only-
when-chosen rule is the narrower one the owner asked to keep.)

Cards are **solid colors mixed from tone 4 and the page (tone 3)** — one step
above the page, 50 / 65 / 75 / 90 / 100% tone 4, `blendColors`, no opacity —
see [Container logic](container-logic.md#dark-mode--tone-4-mixed-with-the-page-one-set-per-theme).
That holds for tonal and white cards. **Black cards stay black** (owner,
2026-11-05): Neutral Color-1 over the theme's page at 90 / 92 / 94 / 96 / 100%
([Container logic](container-logic.md#dark-mode--black-cards-stay-black)).
**One set per theme, the same on every surface level**, so Figma, the CSS and
the preview hold exactly the same five values. On the page and the Dim levels
a card reads as raised. On Surface-Bright (tone 4) and Surface-Brightest
(tone 5) the cards sit level with or darker than the surface — an accepted
consequence, not worked around: in dark mode cards belong on the page and the
Dim levels. A card inside a card uses a higher Container level (High or
Highest), which is lighter because the levels rise toward tone 4.

History: this is the first dark ladder's surfaces (7ad2bf4, tones 1-5, page on
tone 3) with the pre-ladder card relationship shifted up one tone. In between,
ab8c3e6 / 7ed5bc8 painted black and tones 1-4 with the page on tone 2 and
tone-5 cards; that model is gone.

### Bands: Primary, Secondary and Tertiary keep their color

Decided by the owner later the same day (2026-11-04, after the Figma mockup
"Surf — dark mode colors (tones 1–5)", node 10837:2). For the **Primary,
Secondary and Tertiary themes only**, dark mode keeps some color:

| level | dark mode paints |
| --- | --- |
| Surface | **S = min(L, 8)**, where L is the tone that theme's Surface paints in light mode |
| Surface-Dimmest | S - 2 |
| Surface-Dim | S - 1 |
| Surface-Bright | S + 1 |
| Surface-Brightest | S + 2 |

(clamped to 1..12), on the theme's own palette, from the dark ramp. A light
tone 1-7 "stays true" — the same index, painted from the dark ramp — and 8-12
is capped at 8. Surf: Primary light 9 -> dark 8 (levels 6 / 7 / 8 / 9 / 10),
Secondary 9 -> 8, Tertiary 7 -> 7 (5 / 6 / 7 / 8 / 9). Popsicle and Cocktails
sit on light tone 6, so their bands are 4 / 5 / 6 / 7 / 8.

Cards are the ladder's card relationship shifted onto the band: tone S+1 mixed
over S at 50 / 65 / 75 / 90 / 100% (see
[Container logic](container-logic.md#dark-mode-bands-cards-one-tone-above-the-band)).

**Unchanged:** the Default theme and the page (tones 1-5, page 3, cards tone 4
over 3), Neutral, Info, Success, Warning, Error, App-Bar, Nav-Bar, Status and
the black rule. Light mode is byte-identical.

A band surface is often LIGHT (tones 6+ of the dark ramp start at L* 58), so its
foregrounds are dark: text, headers, links, the eyebrow (still the rotation's
palette), borders, focus, icons, buttons and tags are re-solved for the band
and graded by the same rendered report as every other surface. Each role takes,
in order: what it already names if that clears the band; another index of the
same table that is right in both modes; the palette tone its light answer IS
(the light table's own choice, from the dark ramp — "stays true"); or the dark
table's own answer for the tone the band paints. State and black/white buttons
move as a unit, and a state button's border stays its fill.

**How it gets there.** `cssgen/darkBandPass.ts`, step 7 of the dark-ladder pass.
It runs after the ladder, so every shared table, row and map is exactly what
the ladder made it and nothing another theme reads moves; only these three
themes' own Theme references change, in both modes, always to something that
resolves to the same light-mode color. The Theme layer is mode-independent, so
wherever a band needs a different dark answer for the same light reference it
needs a Modes variable of its own (`Band`, `Band-Button`; `Band-CSS` holds the
roles Figma draws as an alias at an opacity, and is the CSS's only). The windows
the maps are built from are recorded before the step (`Ladder-Windows`), and the
page reads the On-* its palette's theme had on the ladder (`Ladder-Page-Icons`).

**Figma cost.** Modes grows by ~115-165 variables for a brand on light tone 6
and ~280 for one on tone 8+ (Surf), most of it state and black/white buttons on
light bands (every dark entry the tables hold was solved for a dark surface)
plus cards, hover / pressed and border variants. The figmaModesTrim guard moved
from 4,450 to 4,800 for it, and on 2026-11-05 to 5,000 — Figma's own
per-collection limit.

**Bars in Figma.** A bar is published to Figma as a Theme mode plus a Surface
mode, so a bar set to "Primary · Surface" shows the Primary band in Figma's dark
mode, while the CSS keeps App-Bar / Nav-Bar / Status on the ladder as decided.
Closing that gap needs a bar-specific mode the Theme collection does not have
room for (10-mode cap).

The S = 5 case (a brand whose light Surface is tone 5) takes its cards one tone
BELOW the Surface (tone 4 over 5): tone 6 is in the dark ramp's light half, and
the five mixes of 6 over 5 run from L* ~41 to ~58, where no one text color
clears 4.5:1 on all of them. It is the shape the ladder already accepts on its
tone-5 Brightest.

Tests: `src/__tests__/darkBands.test.ts` (exact tones and cards for Surf,
Popsicle and Cocktails, CSS == preview == Figma per theme, every band role in
Figma == the CSS, WCAG on every band section and card, light mode identical in
the CSS and in Figma's light literals).

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
its surface. Black (only where chosen) has no row of its own in the tables
(they are keyed by tones 1-12), so it reads tone 1's answers — by the same
rule, whatever passes on tone 1 passes on black.

The few references that named a tone directly — a theme's Surface-Dimmest /
Brightest (`{Colors.<P>.Color-3}` / `-11`), Neutral's black anchor, the
Default theme's Surface-Dimmest — now name a Backgrounds row (or
Default-Background), which resolves to the same tone in light mode.

`DARK_PAGE_N` (3) is the tone the page paints; the export reads its tables at
the page palette's Surface index, through the same window.

Tests: `src/__tests__/darkLadder.test.ts` (what the CSS paints per brand x
theme, the preview and Figma agree, light mode byte-identical).

**The preview's page and card text** (fixed 2026-11-05). The preview's Brand
block states the brand palettes as their LIGHT ramps, so a dark-mode
`var(--Primary-Color-N)` drew a light tone, and it picked that tone with its
own contrast search on the light ramp: Popsicle's dark page Text was #f7d9fb
(light Color-9) where the CSS and Figma paint #e8beef. It now reads what the
export reads — the curated table's answer for the tone the level paints (the
page tone 3, a card its face, matched by lightness), resolved on the dark ramp
as a hex, with darkLadderPass step 6's lift for a card cell that misses the
lightest card — for Text and Header on the page and its cards, in both modes.
Test: `src/__tests__/pageCardTextParity.test.ts`. The page's Quiet is the one
role still solved by the preview's own search (it does not have the export's
shared per-tone opacity table).

## A neutral page: Card Coloring and Text Coloring

Owner's decision (2026-11-05): "Tonal uses the Primary tint." When the page
palette is Neutral (`white`, `black`, any `Neutral/…` pick), the page's tonal
cards come from the **Primary** row at the page's index and its tonal Text /
Header / Quiet from the **Primary** tables, in both modes — otherwise tonal
looked exactly like white cards and black-white text. White and black-white
keep Neutral; themed sections keep their own palette; a non-neutral page is
byte-identical in light mode. Full rule and measurements:
[Container logic](container-logic.md#a-neutral-page-tonal-cards-and-text-use-the-primary-tint).

**The light-mode grid gap is closed** (owner, 2026-11-05). The CSS export's
`defaultBackgroundTone` used to map only the four legacy strings; every other
grid pick fell to `Background-Theme` metadata that nothing writes, so in LIGHT
mode the published page was Primary Color-11. The studio passes no
`backgroundTheme` / `backgroundN` to the export, so the JSON (and the Figma
payload built from it) put the page on Primary at the core tone, and the preview
painted the right level but solved its text and borders for a white page. Now
every pick decodes through `toneFor` everywhere:

- `exportColorSystemToJSON` normalizes a grid value with a legacy name
  (`Neutral/Surface-Brightest`) to that name, and fills `backgroundTheme` /
  `backgroundN` for the other sixteen, so Default-Settings — what Figma reads —
  and the Default theme are built on the picked page (`gridBackgroundTone`).
- `defaultBackgroundTone` (CSS) and `buildPreviewCSS` paint the same theme and
  level, and the preview solves its roles for that page rather than for white.
- Rule B reaches the light CSS for every Neutral pick, not only `white` /
  `black`.

Measured on Popsicle (tonal cards, tonal text), light page:

| pick | CSS before | preview before | Figma before | all three after |
| --- | --- | --- | --- | --- |
| `Neutral/Surface-Bright` | #fff5ff | #e2e2e2 (text #231725) | #b771c6 | #e2e2e2, text #231725 |
| `Secondary/Surface-Dim` | #fff5ff | #00495c (text #00617d) | #b771c6 | #00495c, text #c3e8f7 |

The four legacy strings publish byte-identical CSS for this change. Dark mode
keeps its page (the palette's tone 3), but a grid pick's dark CSS and Figma now
derive their other Default-theme levels from the right Default-Settings, which
brings them to the legacy Primary / Neutral picks' values. Tests:
`src/__tests__/backgroundGridParity.test.ts`.

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
