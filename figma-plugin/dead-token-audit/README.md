# Dead Token Audit

A Figma plugin that finds bindings pointing at variables whose **collection no
longer exists**, and text layers on styles that are no longer local.

## Why it exists

A dead binding is invisible. The variable still resolves, so Figma shows the
layer as correctly bound and the swatch looks right in the panel — the value
just stops tracking the brand forever. The `Buttons` set in this library carried
about 190 of them with no visual symptom at all, and they were only found by
resolving every binding's collection id by hand.

The test is NOT "does this variable resolve" — it does. The test is whether its
collection is still one of the file's local collections. When a collection is
restructured and the references are not rewritten in the same pass, every
binding into it survives as a ghost. That is invariant 1 in `CLAUDE.md`, seen
from the component side rather than the payload side.

It reports three kinds:

| Kind | Meaning |
| --- | --- |
| **dead collection** | variable resolves, its collection is gone — the common case |
| **deleted variable** | the id resolves to nothing at all |
| **orphaned style** | a TEXT node on a `textStyleId` that is not in the local styles |

## Ships vs board furniture

Every finding is classified, because the counts are misleading otherwise:

- **in components** — inside a COMPONENT or a variant. This reaches every
  instance, so it is the number that matters.
- **board only** — loose frames on the page, `✏️` annotations, and the
  COMPONENT_SET container itself. A set's own padding only spaces the variants
  inside the purple box; it never reaches an instance.

Rows sort by the shipping count first.

## Install

Figma desktop → **Plugins → Development → Import plugin from manifest…** and
pick `manifest.json` in this folder. No build step; it is plain JS.

## Use

1. Pick a scope — **This page**, **Whole file**, or **Selection**
2. **Scan**. Whole file calls `loadAllPagesAsync()` and can take a minute on a
   library this size.
3. Click any row to select those nodes and zoom to them. It switches pages if
   the nodes live elsewhere, and selects at most 200 at a time.
4. **Copy report** dumps a tab-separated list for pasting elsewhere.

## Reading a result

The token name is the dead variable's own name, and it usually tells you the
generation it came from:

```
Button-Height                          bare, no group — the pre-Component-Size era
Typography/Labels/Extra-Small/...      the old typography tree
Spacing/Spacing-2, core-spacing/...    three different spacing generations
Drop-Shadows/Drop3-Blur                the old elevation set
```

Most map 1:1 onto a live name once you see the pattern — `Spacing/Spacing-2` to
`Sizing::Sizing-2`, `Typography/Labels/Extra-Small/Character-Spacing` to
`Labels/Label-Small-Letter-Spacing`. **Rebind them; do not clear them.** Clearing
a dead binding leaves a hardcoded literal, which is the same failure wearing
different clothes.

## What it deliberately does not do

- **It does not fix anything.** Every mapping is a judgement — `Spacing/Spacing-1`
  has live twins in both `Sizing` and `Spacing` with the same value, and only a
  person knows which is meant.
- **It does not flag hardcoded literals.** A `0.2` opacity typed onto a bound
  colour, or a stroke weight of `3` with no variable, is also drift — but it is
  a different audit, and mixing them would bury the dead bindings.

## A trap worth knowing

`page.findAll()` already includes the page's direct children, so
`findAll().concat(page.children)` double-counts everything at page level. This
plugin keeps a visited set for that reason; an earlier hand-rolled version of
this scan reported a page as having 4 dead bindings when it had 1.

## "The node ... does not exist"

Ids shaped `I8590:24408;8576:21136;8590:24405` are **instance sublayers** —
nodes inside a nested instance, addressed by a path rather than a real id.
Figma materialises them on demand, so the reference `findAll()` returns can be
collected before the next line reads a property off it, and any property access
then throws.

The scan skips those nodes and **counts them**, shown as `N unreadable` in the
summary. It is reported rather than swallowed on purpose: a silent skip lowers
the dead-binding count, which is wrong in the reassuring direction — the same
shape as the bug this plugin exists to find. A non-zero count means re-run, or
scan that component's page directly.
