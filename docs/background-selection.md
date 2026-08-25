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
  dark mode. Every legacy branch lands on Color-2, so grid selections do too:
  the theme carries over, the tone does not.
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

## Related

- [Container logic](container-logic.md) — what sits *on* these backgrounds.
- [Design system architecture](design-system-architecture.md).
