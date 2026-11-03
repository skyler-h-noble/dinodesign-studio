/**
 * The file an end user hands to their AI coding tool: DINO-TOKENS.md, served
 * as the "CLAUDE.md URL" (/api/tokens/:id/md) and included in the ZIP.
 *
 * Two jobs, in this order:
 *
 *  1. Say THIS system's choices — the page background, the bars, the button,
 *     the cards, the text — and the exact code that reproduces each. Without
 *     it an AI tool guesses: it paints its own bar color, puts a background on
 *     <main>, and the designer's decisions never reach the page.
 *  2. The handful of rules that keep everything else on the system. The full
 *     component guide is the lib's own CLAUDE.md in node_modules; this file
 *     points there instead of restating it.
 *
 * Kept compact on purpose: end users are token-conscious, and every line here
 * is read on every prompt. Pure (no Firebase import) so a test can render it.
 *
 * What this emits has to match what users install — change it alongside a lib
 * release (see the studio CLAUDE.md).
 */
import type { UserSelections, ComponentStyle } from '../types';
import { parseBackground, parseBar, type BackgroundSelection } from './backgroundSelection';
import { resolveButtonChoice } from './buttonChoice';

/* Where the hosted playground lives.
 *
 * Written into the generated doc that customers hand to an AI tool, so it
 * outlives this app — a stale host keeps being quoted in files already
 * distributed. One exported constant for every caller. */
export const SHOWCASE_BASE = 'https://omni-design.netlify.app';

export interface EndUserDocInput {
  uuid: string;
  /** The published theme.json URL — what OmniDesignProvider's themeURL takes. */
  themeUrl: string;
  designSystemName: string;
  /** Primary, Secondary, Tertiary hex, in that order. */
  colors: string[];
  userSelections: Partial<UserSelections>;
  componentStyle: ComponentStyle;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Neutral · Surface-Brightest (white)" — the names the code uses, plus the
 *  plain word where there is one. */
export function selectionLabel(sel: BackgroundSelection): string {
  const plain =
    sel.theme === 'Neutral' && sel.surface === 'Surface-Brightest' ? ' (white)'
    : sel.theme === 'Neutral' && sel.surface === 'Surface-Dimmest' ? ' (black)'
    : sel.surface === 'Surface-Brightest' ? ' (a pale tint)'
    : sel.surface === 'Surface-Dimmest' ? ' (its deepest tone)'
    : '';
  return `${sel.theme} · ${sel.surface}${plain}`;
}

function buttonLabel(sel: Partial<UserSelections>): string {
  const choice = resolveButtonChoice(sel.button, sel.buttonTone);
  const color = {
    primary: 'Primary',
    secondary: 'Secondary',
    match: 'Match — takes each section\'s own palette (Primary on Neutral)',
    laddered: 'Laddered — one step on from each section\'s palette (Primary → Secondary → Tertiary → Primary)',
    'black-white': 'Black & white — black on light surfaces, white on dark',
  }[choice.color];
  if (choice.color === 'black-white') return color;
  const tone = choice.tone === 'tonal'
    ? 'tonal (its tone shifts to stand out on each surface)'
    : 'fixed (the brand tone on every surface)';
  const cells = sel.buttonCellTones && Object.keys(sel.buttonCellTones).length
    ? ', with per-surface adjustments'
    : '';
  return `${color}, ${tone}${cells}`;
}

const CARD_LABEL: Record<string, string> = {
  tonal: 'Tonal — tinted from the section they sit on, so they follow its theme',
  white: 'White — the same white card on every theme',
  black: 'Black — the same near-black card on every theme',
};

const TEXT_LABEL: Record<string, string> = {
  tonal: 'Tonal — tinted from each surface\'s palette',
  'black-white': 'Black & white only',
};

export function buildDesignSystemDoc(input: EndUserDocInput): string {
  const { uuid, themeUrl, designSystemName: name, userSelections: sel } = input;
  const [primary = '', secondary = '', tertiary = ''] = input.colors;
  const background = parseBackground(sel.background);
  const appBar = parseBar(sel.appBar);
  const navBar = parseBar(sel.navBar);
  const status = parseBar(sel.status);
  const style = cap(input.componentStyle);
  const card = CARD_LABEL[sel.cardColoring ?? 'tonal'] ?? CARD_LABEL.tonal;
  const text = TEXT_LABEL[sel.textColoring ?? 'tonal'] ?? TEXT_LABEL.tonal;

  return `# ${name} — build with Omni Design

This file teaches an AI coding tool to build with the **${name}** design
system. Save it as \`CLAUDE.md\` in your project root (Cursor: \`.cursorrules\`).
It covers this system's choices; for every component, read
\`node_modules/@omni-design/components/CLAUDE.md\` after installing.

| | |
|---|---|
| Dino ID | \`${uuid}\` |
| Theme URL | ${themeUrl} |
| Playground | ${SHOWCASE_BASE}/?user=${uuid} |
| Figma | Run the Omni Design plugin → "Import your Omni Design" → paste the Dino ID |

## 1. Setup

\`\`\`bash
npm install @omni-design/components @omni-design/icons @mui/material@^7 @emotion/react @emotion/styled
\`\`\`

\`\`\`jsx
// main.jsx
import { OmniDesignProvider } from '@omni-design/components';

<OmniDesignProvider themeURL="${themeUrl}">
  <App />
</OmniDesignProvider>
\`\`\`

The provider loads this system's CSS — colors, fonts, shapes, light and dark —
and puts the page background on the root. Do not import the CSS files
yourself. The CSS styles no bare elements, so set the body once:

\`\`\`css
body { margin: 0; font-family: var(--Font-Family-Body); font-size: var(--Body-Medium-Font-Size); line-height: var(--Body-Medium-Line-Height); }
\`\`\`

## 2. This system's choices — reproduce them, don't guess

The designer picked these in the OmniDesign studio. They are already in the
CSS under the names in the right column, so using the name reproduces the
choice in light and dark mode. Never pick your own instead.

| Part | Designer's choice | In code |
|---|---|---|
| Page background | ${selectionLabel(background)} | The root is \`data-theme="Default"\` + \`data-surface="Surface"\`, and that IS this background. A region with no \`theme\` inherits it; \`<Section theme="Default">\` returns to it inside another theme. Don't put a theme or surface on \`<body>\` or \`<main>\`. |
| App bar | ${selectionLabel(appBar)} | \`<AppBar>\` with \`barColor\` unset — it wears \`App-Bar\`. A top bar or side rail you build: \`<ThemedZone theme="App-Bar" surface="Surface">\`. |
| Phone bottom bar | ${selectionLabel(navBar)} | \`<BottomNavigation>\` or \`<Toolbar>\` with no color prop — they wear \`Nav-Bar\`. Built by hand: \`<ThemedZone theme="Nav-Bar" surface="Surface">\`. |
| Phone status bar | ${selectionLabel(status)} | \`data-theme="Status"\` — device mockups only. |
| Main button | ${buttonLabel(sel)} | \`<Button variant="default">\`; \`default-outline\` for the second action. (\`variant="primary"\` is always the Primary palette, not this choice.) |
| Cards | ${card} | \`<Card>\` with no variant. It sits on a \`Container\` level; nest \`Container-Low\` / \`Container-High\` for depth. Never give a card a background. |
| Text | ${text} | Automatic — text components pick it. Never set a text color by hand. |
| Shape | ${style} | Set on the root; radii come from the CSS. Never write a radius. |

Brand colors, for reference only — never write these in code: Primary
\`${primary}\` · Secondary \`${secondary}\` · Tertiary \`${tertiary}\`. Each is a
12-tone palette, alongside Neutral and the Info / Success / Warning / Error
palettes; the CSS picks the right tone for every surface.

## 3. Where each color goes

Primary, Secondary and Tertiary are roles. Each brings text, buttons, icons and
a whole theme that pass contrast on every surface — so use all three, rather
than one accent and grays.

| Use | Write |
|---|---|
| Most of the page | the page background (no \`theme\`), or \`<Section theme="Primary">\` |
| One or two highlight bands (testimonials, stats, pricing) | \`<Section theme="Secondary" surface="Surface">\` |
| A pale tint or a deep band of any palette | \`surface="Surface-Brightest"\` / \`surface="Surface-Dimmest"\` |
| Small accents | \`<Avatar color="tertiary">\`, \`<IconBadge color="tertiary">\`, \`<Icon color="secondary">\` — Tertiary is never a whole section |
| Colored words (a stat, a label) | \`color="primary"\` / \`"secondary"\` / \`"tertiary"\` on the text component — not whole paragraphs |
| The small line above a heading | \`<Eyebrow>\` — it takes its color from the section (Primary → Secondary, Secondary → Tertiary, Tertiary and Neutral → Primary). Don't recolor it. |
| Status messages | \`<Alert color="success">\` (or \`info\` / \`warning\` / \`error\`) — it themes itself. A whole status region: \`<Section theme="Error" surface="Surface-Brightest">\` |
| Telling neighboring sections apart | alternate the \`theme\`; neighboring surface levels can look alike |

## 4. Rules

- **Themes:** \`Default\`, \`Primary\`, \`Secondary\`, \`Tertiary\`, \`Neutral\`, \`Info\`, \`Success\`, \`Warning\`, \`Error\`, \`App-Bar\`, \`Nav-Bar\`, \`Status\`. There are no \`-Light\` / \`-Medium\` / \`-Dark\` themes — lighter or darker is the surface.
- **Surfaces:** \`Surface-Dimmest\`, \`Surface-Dim\`, \`Surface\`, \`Surface-Bright\`, \`Surface-Brightest\`; card levels \`Container-Lowest\`, \`Container-Low\`, \`Container\`, \`Container-High\`, \`Container-Highest\`.
- **Paint a region with \`<Section theme surface>\`.** \`<ThemedZone>\` sets the same attributes without painting. Never \`background: var(--Surface)\`, \`var(--Container)\` or a hex — that paints the box but leaves its text and borders on the old tone.
- **\`style\` is for layout only.** No color, background, border, radius or font on a component — use \`variant\`, \`color\`, \`theme\`, \`surface\`. Text color is the \`color\` prop (\`quiet\`, \`primary\`, …), never \`style={{ color }}\`. Hand-rolled CSS reads \`var(--Text)\`, \`var(--Quiet)\`, \`var(--Header)\`, \`var(--Border)\`, \`var(--Border-Variant)\`, \`var(--Hover)\`, \`var(--Pressed)\`.
- **Use the components** for every element — no raw \`<button>\`, \`<input>\`, \`<select>\`, \`<h1>\`–\`<h6>\`, \`<p>\`, \`<a>\`; no \`@mui/material\` imports. Icons: \`import HomeIcon from '@omni-design/icons/Home'\`, not \`@mui/icons-material\`.
- **Buttons:** a color plus \`-outline\`, or \`ghost\` / \`text\`. Button, Chip and Badge have no \`-light\`. Icon-only: \`<Button iconOnly aria-label="Delete item"><DeleteIcon /></Button>\` — name the action on the button, nothing on the icon.
- **Body has no bold** — bold body text is \`<Subtitle>\`.
- **Choices and navigation:** a segmented choice is \`<ToggleButtonGroup>\`; tabs that go to pages are \`<Tabs navigation>\`; a card that goes somewhere is \`<Card href>\`.
- **Menus:** \`<Dropdown><MenuButton/><Menu><MenuItem/></Menu></Dropdown>\` — \`Menu\` alone renders nothing. Anything else that floats, or a menu inside a scroll area or clipped card: \`<Popover>\`.
- **Code, commands, copyable URLs:** \`<CodeBlock code language>\`.
- **Leave these to the system:** links don't change color on hover, and shadows come from the components (floating things cast black ones). Don't add either.
- **Missing a component?** Tag it — \`// MISSING-LIB-COMPONENT: <Name>\` — never fake one with a styled \`<div>\`.
- **Check your work:** \`grep -rnE "#[0-9a-fA-F]{3,8}\\b|rgba?\\(|(color|background|borderColor)\\s*:" src/\` — no hits (or only layout) means every color is the system's, and contrast passes in light and dark.
`;
}
