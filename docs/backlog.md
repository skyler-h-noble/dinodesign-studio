# Backlog

Open items, each one found while doing something else and left rather than
folded into an unrelated change. Grouped by what has to happen, not by
priority — a Figma-side item and a code-side item can block each other, and
splitting them by urgency hides that.

Every entry states the CONSEQUENCE of leaving it, because most of these fail
silently. That is the whole reason they are written down: a value that stops
tracking the brand looks exactly like a value that was always that number.

Opened 2026-09-24, out of the Dynamic-Button / menu-radii / Caption-ramp pass.
Item 15's Label question closed the same day; item 7a added after the
typography boards were drawn.

---

## Code — safe, decided, just not done

### 1. `Button-ExtraSmall` is excluded from the Figma payload but is in use

`EXCLUDED_STYLES` (`src/utils/typographyPlatform.ts:738`) skips it, and the
stated reason is that the file has no extra-small button. Both halves are true
and they are not the same claim: it is not a button size, it is the label style
for a `letterNumber` button at `size="small"`
(`~/DinoDesign/src/components/Button/Button.js:495`, the only consumer besides
`Typography/index.js:23`).

The file carries `Typography/Omni/Buttons/Button-ExtraSmall-Font-Weight` and
`-Letter-Spacing` as hand-typed rows. Nothing writes them. Their 600 / 0 is
right by luck and will not move when the brand does.

**Do:** drop `Button-ExtraSmall` from `EXCLUDED_STYLES`, correct the comment to
the real reason. The sizes group gains `Button-ExtraSmall-Font-Size` /
`-Line-Height`, which the file does not have yet — created on import, so
nothing to lose.

**Already safe:** the value that made this risky is gone. The static Android and
iOS-Tablet blocks declare `--Button-ExtraSmall-Line-Height: 28px` for an 11px
style, but leading is computed rather than read on every non-Desktop device, so
it lands at 13 (iOS) and 16 (Android).

### 2. `DEVICE_OWNED_METRICS` does not cover the new Dynamic aliases

`src/utils/componentSize.ts:502` lists `Button-Height` and `Button-Icon` — the
metrics that are ALIASES in the file and must never be written as literals,
because `populateComponentSize` cannot tell one from the other and an overwrite
deletes the link with no error.

`Component-Size/Button/Dynamic-Button-Font-Size`, `-Line-Height` and
`-Letter-Spacing` are now exactly that shape and are not on the list. Nothing
writes them today, so this is prevention: the list exists so a metric added
upstream cannot quietly rejoin the payload and clobber an alias.

**Do:** add the Dynamic names. Also settle the naming — the three siblings live
in `Button/` while `Dynamic-Font-Weight` sits ungrouped at the collection root.

### 3. `Dynamic-Font-Weight` may be a literal 400

Read off the Menu Item node, it resolves to 400 while every other property on
that text style is an alias. The brand owns body weight
(`--Set-Font-Family-Body-Weight`), so if this holds a literal, a brand that
picks 300 or 500 leaves every menu label at 400.

**Do:** confirm in Figma. If literal, point it at
`Typography → Body/Body-Font-Weight`.

### 4. Stale claim: Line-Height does not switch on the face

`src/utils/typographyPlatform.ts:37` lists Line-Height under "what DOES switch"
between Omni and System. `DEVICE_PROPS` (line 125) puts it with Font-Size as a
device property, and the comment directly above it says the opposite of line 37.
The payload agrees with `DEVICE_PROPS`.

This pass confirmed it from the other side: the Caption leading work moved
values per DEVICE and both faces followed. A file every AI tool reads is the
worst place for a claim the code contradicts — that is how the `Menu`
"pretend it doesn't exist" entry survived for months.

**Do:** one-line correction.

### 5. System mode flattens the extra weights on mobile

`Caption-Bold-Font-Weight` is 700 on Desktop and **500 on iOS and Android** in
System mode. `systemWeight` (`src/utils/systemTypography.ts:205`) runs over the
extra-weight token, `roleOf` matches `Caption` at line 68 and returns `label`,
and both platform tables set label to 500 — so the bold is erased. Desktop
escapes only because its System mirrors Omni.

`Legal-Semibold` resolves through the same branch and should be checked in the
same pass. A System-mode caption-bold on a phone is not bold, and nothing
reports it.

**Do:** make `systemWeight` leave an extra-weight token alone, or resolve it
against its base step plus the weight's own offset.

### 6. The legacy `Components` payload writes to a collection that is gone

`src/utils/generateFigmaJSON.ts` still builds a flat `Components` collection
(Button / Card / Modal / Input / Menu). The file's collection list has no
`Components` — it was replaced by `Component-Size`, which carries the same
numbers keyed by mode.

Kept in step by hand so far, including the `Menu` group rename in this pass.
That is two payloads describing the same values, which is the exact shape
invariant 5 warns about; the only reason it has not drifted is that someone
remembers to edit both.

**Do:** confirm nothing else consumes it, then delete. Note this is a payload
deletion, not a Figma variable deletion — invariant 8 does not apply.

---

## Figma — authoring the code now expects

### 7a. Text-style names must match what the payload creates

The Figma payload creates text styles from the scale's own `name`, so a
hand-authored style under a different name lands BESIDE the generated one
rather than replacing it — two styles for one size, neither obviously wrong.

Most are plainly `Group/Small|Medium|Large`. These nine are not, and eight of
them differ from the typography boards as drawn on 2026-09-24:

```
Caption/Standard          board says Caption-Medium
Legal/Standard
Badge/Standard
Button/Standard           not Button-Medium
Button/Extra Small        space, not ExtraSmall
Label/Extra Small         space
Label/Medium All Caps     spaces, no hyphens
Display/Alt-Large         Alt-Medium, Alt-Small - hyphen inside the step
Eyebrow/Small             SINGULAR style name; the variable folder is Eyebrows/
```

The Eyebrow pair is the sneakiest: folder plural, style name singular, both
correct, neither matching the other.

Also on the boards: `Caption-Small-Bold` and `Caption-Large-Bold` need no new
tokens. 700 is size-independent, so each composes its base step's size, leading
and tracking with `Caption-Bold`'s weight — which is why Bold rides on one step
instead of three.

### 7. `Caption/Small` and `Caption/Large` text styles

Caption became a three-step ramp (12 / 14 / 16). `Caption/Standard` already
exists and its values did not move. The Devices-Type variables arrive on the
next import for all seven devices; the two new STYLES have to be created by
hand.

### 8. `Menu-Item-Radius` out of the `Radio` group

In progress. The payload now writes `Menu/Dropdown-Frame-Radius`,
`Menu/Menu-Item-Radius` and `Menu/Menu-Focus-Radius`. Any of those three
sitting under a different group is a silent no-op on import — update-only,
matched on the full `Group/Name`.

### 9. The hand-typed 12 will be overwritten

`Dropdown-Frame-Radius` is generated as `min(Input-Radius, Card-Radius, 16px)`.
The 12 currently in the file survives only if the brand's input radius resolves
to 12. Worth checking before assuming it sticks — and if it does not, that is
information about the brand, not a bug in the rule.

---

## Open design decisions

### 10. Does mobile zero the brand's caption tracking?

Desktop tracks captions at 0.1px; the static mobile blocks declare `0px`. The
new steps took the blocks' existing answer, so mobile now reads a consistent
**0 / 0 / 0** rather than a self-contradicting 0.0996 / 0 / 0.1008.

Consistent is not the same as correct. Omni mode is defined as "the brand's
faces", and a brand decision that changes per device is odd on its face. The
`0px` is also older than the generated Desktop block, so it may simply be
stale.

**Decides it:** whether the brand tracks captions at all. Changing it means all
three steps in all three platform blocks together.

### 11. The static mobile blocks restate values that may be stale

The caption tracking above is one instance of a class. Those blocks are
hand-written and older than the generated Desktop block, and the code already
describes them as short by several styles. Anything they restate that does not
actually vary by platform is a second copy that can only fall behind.

**Do:** audit which declarations in the three blocks differ from `:root` and
whether each difference is intentional.

### 12. The 16px ceiling on `Dropdown-Frame-Radius` lost its reason

`src/utils/componentRadii.ts:264`. The stated justification is full-bleed rows
whose hover highlight would be clipped into a crescent at a large corner. The
rows are now inset by 8px (`MENU_ITEM_INSET`, line 292) and never reach the
corner, so nothing is clipped.

The cap may still be worth keeping on looks alone. But it should say so, rather
than resting on a reason that no longer holds — a rule defended by a false
argument gets discarded the first time someone checks it.

### 13. Should the menu radii scale with the size mode?

All three are flat across small / medium / large. `Input-Radius` has `Sm-` and
`Lg-` variants, so if a small Select should open a less-rounded menu, the frame
wants to key off `Sm-Input-Radius` at small instead of repeating medium.

### 14. Is the menu focus ring inset or outside?

`Menu-Focus-Radius` is generated as `inner(Menu-Item-Radius)` — a 1px inset,
matching Input's inner focus and the 3 / 4 / 12 the file already held. If the
ring actually sits OUTSIDE the row it wants `focus()` (`r + 3`) and lands on 7.

### 15. Which type groups get a `Dynamic-*` twin

Settled: Display, H1–H6, Badge and Legal stay explicit-only. Body, Subtitle and
Eyebrow get twins — the case is a small card whose eyebrow, subtitle and body
all step up together. Button and Number qualify too.

Two names, never one: the explicit step stays for editorial use where the
designer pins a size, and the Dynamic one follows the mode inside a sized
component. Same shape Button already has.

**Settled 2026-09-24 — Label.** It was never four sizes. `Medium-All-Caps` is
a case variant, and `ExtraSmall` is an off-ramp step like `Button-ExtraSmall`:
the lib reads it (`Typography.js:361`) but the design does not offer it as one
of the three. `Label-Small-All-Caps` and `Label-Large-All-Caps` were added to
the scale so the group is three sizes x two cases, and the Dynamic twin maps
Small / Medium / Large. ExtraSmall stays in CSS and out of the mapping.

**Constraint worth restating:** these are FIGMA-ONLY. The lib picks the
typography component from the size prop (`Button.js:489-495`), so there is no
CSS consumer for a dynamic token and none should be emitted. They are
alias-only in Figma, which is what item 2 protects.

### 16. `Icon-Size` resolves to 24 on a 32px menu row

`Button-Icon` at a 32px button is 20 — `0.625 × height`,
`src/utils/buttonSizing.ts:94` — and 24 is the large step's value. Either the
icon is deliberately oversized for a menu row, or `Icon-Size` is coming through
a different mode than `Button-Height` is.

### 17. `--Button-Font-Size` disagrees with the stepped ladder, and never reaches Figma

core.css emits a single aggregate per platform:
`src/utils/generateDesignSystem.ts:1242 / 1299 / 1344 / 1389` — Desktop 16,
iOS-Mobile 16, **iOS-Tablet 17**, Android 16. The per-step
`Button-Standard-Font-Size` is 16 on all seven devices.

The lib reads `var(--Button-Standard-Font-Size, var(--Button-Font-Size))`
(`~/DinoDesign/src/components/Typography/Typography.js:539`), so the aggregate
is a fallback that currently never fires. But the Figma payload parses
`typography-tokens.css` only, which has no unstepped Button style — so the
aggregate has no Figma variable at all, and nothing reconciles 17 with 16.

**Options:** emit iOS-Tablet's aggregate as 16 to match the ladder, or have the
aggregate read `var(--Button-Standard-Font-Size)` in every platform block so
there is one number instead of two. The second is better — it makes the
fallback structural rather than coincidental.

### 18. Caption and Badge cannot follow a scaling card

Both were single-size; Caption now has three steps, Badge deliberately does
not. In a small card a badge stays at 11 while the type around it steps down.
Accepted for now — recorded so it is a decision rather than an oversight.

### 19. Tooltip should paint from `--Text`

Added 2026-09-28, after Tooltip was built in Figma.

A tooltip is the one surface that is meant to sit ON TOP of whatever is behind
it and stay legible regardless — it can appear over a card, a themed section,
an image or the page. Giving it its own background tone means picking a colour
that has to be checked against every surface it can float above, and the check
has no natural place to live.

**Paint it from the pair the system already guarantees:** background
`var(--Text)`, label `var(--Background)`. Those two are defined as each other's
contrast partner at 4.5:1 for every theme, surface level and light/dark mode —
so an inverted chip built from them is legible **by construction** rather than
by a value someone verified once. It also inverts for free in dark mode, which
is the behaviour a tooltip wants and the one most systems hand-roll.

This is the same move `CodeBlock` already makes from the other direction: it
declares `data-theme="Neutral"` + `data-surface="Surface-Dimmest"` so its dark
region follows the brand's own neutrals instead of everyone's `#1e1e1e`.

**Do:**

- Figma — the tooltip's fill binds to the Text token and its label to the
  Background token, NOT to a hand-picked dark neutral.
- Lib — `Tooltip` should follow the same pair rather than MUI's default, and
  must not be given `style={{ background }}`.
- Check what the arrow/pointer does: it has to take the same fill, and a
  border on it would need `--Background` too or it will hairline against the
  chip.

**The thing to avoid:** a tooltip that reads a specific palette tone. That is
the `Surface::Eyebrow` mistake from the Carousel — a token that rotates per
surface, so the tooltip changes hue depending on which themed section it
happens to open over, passing contrast in one place and failing in another with
nothing reporting it.

