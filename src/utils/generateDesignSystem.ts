import { uploadDesignSystemFile, getDesignSystemFileUrl, getPublicFileUrl } from './firebase/storage';
import { STORAGE_BUCKET } from './firebase/client';
import type { ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from '../types';
import { toneToColorNumber } from './colorScale';
import { generateFullLightPalettes, generateFullDarkPalettes } from './generateFullPalettes';
import { exportColorSystemToJSON } from './cssgen/exportColorSystem';
import { generateCSSFiles, generateBaseCSS } from './cssgen/exportToCSS';
import { generateFigmaJSON } from './generateFigmaJSON';

/**
 * Returns a public download URL for a file in a design system.
 * Used by Playground / ApiTokens to load the user's exported tokens.
 */
export async function getStoredFileUrl(uuid: string, filename: string): Promise<string> {
  return getDesignSystemFileUrl(uuid, filename);
}

const BORDER_RADII: Record<ComponentStyle, { small: number; medium: number; large: number }> = {
  professional: { small: 4, medium: 8, large: 12 },
  modern: { small: 6, medium: 12, large: 16 },
  bold: { small: 2, medium: 4, large: 8 },
  playful: { small: 12, medium: 20, large: 28 },
};

interface GenerateInput {
  designSystemName: string;
  colorScheme: ColorScheme;
  userSelections: UserSelections;
  typographyStyles: TypographyStyle[];
  componentStyle: ComponentStyle;
  styleCustomizations?: any;
  surfaceStyle?: SurfaceStyle;
  moodBoardUrl?: string | null;
  moodBoardFile?: File | null;
  /** Monotonic export version. Plugins compare this against their last-imported
   *  value to decide whether the design system has new changes. Defaults to 1. */
  version?: number;
  /** Existing UUID for re-exports. When provided, files are uploaded to the
   *  same Firebase Storage path so the Figma plugin's stored Dino ID still
   *  resolves. When omitted, a fresh UUID is generated. */
  uuid?: string;
}

// ─── Map our button mode names to the pipeline's button style names ───
function mapButtonStyle(button: string): string {
  switch (button) {
    case 'primary': return 'primary-fixed';
    case 'secondary': return 'secondary-fixed';
    case 'tonal': return 'tonal-fixed';
    case 'laddered': return 'laddered-fixed';
    case 'black-white': return 'black-white';
    default: return 'primary-fixed';
  }
}

// ─── DINO-TOKENS.md ───
function buildDinoTokensMd(uuid: string, input: GenerateInput): string {
  const colors = input.colorScheme.colors;
  const radii = BORDER_RADII[input.componentStyle];
  const showcaseBase = 'https://designology.netlify.app';
  const storybookUrl = `${showcaseBase}/storybook/?user=${uuid}`;

  const styleName = input.componentStyle.charAt(0).toUpperCase() + input.componentStyle.slice(1);

  return `# ${input.designSystemName} — Dino Design System

## Your Design System

| | |
|---|---|
| **Dino ID** | \`${uuid}\` |
| **Playground** | [${showcaseBase}/?user=${uuid}](${showcaseBase}/?user=${uuid}) |
| **Figma** | Open the Dino Figma plugin and paste your Dino ID |
| **Storybook** | [${storybookUrl}](${storybookUrl}) |

### Install in Your Project

\`\`\`bash
npm install @dynodesign/components
npx @dynodesign/init ${uuid}
\`\`\`

This downloads the CSS token files into your project and sets up the provider.

---

## STRICT RULES

1. **NEVER hardcode hex colors.** Use CSS token variables: \`var(--Background)\`, \`var(--Text)\`, \`var(--Container)\`, \`var(--Border)\`, \`var(--Header)\`, \`var(--Quiet)\`, \`var(--Buttons-Primary-Button)\`, \`var(--Buttons-Primary-Text)\`, etc.
2. **NEVER style buttons manually.** Use \`<Button>\` with \`variant\` and \`color\` props (\`variant="solid"\`, \`color="primary|secondary|tertiary|error|success|warning|info"\`).
3. **NEVER set font styles manually.** Use typography components: \`<H1>\`, \`<H2>\`, \`<H3>\`, \`<H4>\`, \`<H5>\`, \`<H6>\`, \`<Body>\`, \`<BodySmall>\`, \`<Caption>\`, \`<Label>\`.
4. **Use \`data-theme\`** for theming sections: \`Default\`, \`Primary-Light\`, \`Primary\`, \`Secondary-Dark\`, \`Error-Light\`, \`App-Bar\`, \`Nav-Bar\`, etc.
5. **Use \`data-surface\`** for surface levels: \`Surface\`, \`Surface-Dim\`, \`Surface-Bright\`, \`Container\`, \`Container-Low\`, \`Container-High\`.
6. **Use \`<Alert variant="error|success|warning|info">\`** for status messages — never manually color error text.
7. **Use design system layout components**: \`<Card>\`, \`<TextField>\`, \`<TextArea>\`, \`<Select>\`, \`<VStack>\`, \`<HStack>\`, \`<Tabs>\`, \`<Dialog>\`, \`<Modal>\`.
8. **All components** are imported from \`'@dynodesign/components'\`.
9. **Check the Storybook** for component API before building custom UI: [${storybookUrl}](${storybookUrl})
10. **The design system is the source of truth** — treat it as a requirement, not a suggestion.

---

## Brand Colors

\`\`\`css
:root {
  --color-primary: ${colors[0]};
  --color-secondary: ${colors[1]};
  --color-tertiary: ${colors[2]};
}
\`\`\`

Each brand color generates a 12-tone LCH palette (Color-1 = darkest, Color-12 = lightest). Access raw palette colors with \`var(--Primary-Color-1)\` through \`var(--Primary-Color-12)\`. Same for Secondary, Tertiary, Neutral, Info, Success, Warning, Error.

---

## Provider Setup

\`\`\`jsx
import { DynoDesignProvider } from '@dynodesign/components';

// Firebase Storage URL pattern. Each file is at:
// https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/design-systems%2F${uuid}%2F{filename}?alt=media
const TOKEN_BASE = 'https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/design-systems%2F${uuid}%2F';
const tokenUrl = (file) => TOKEN_BASE + encodeURIComponent(file) + '?alt=media';

function App() {
  return (
    <DynoDesignProvider
      cssUrls={[
        tokenUrl('tokens-base.css'),
        tokenUrl('tokens-semantic.css'),
        tokenUrl('tokens-component.css'),
        tokenUrl('tokens-light.css'),
        tokenUrl('tokens-dark.css'),
      ]}
      defaultTheme="Default"
      defaultStyle="${styleName}"
      defaultSurface="Surface"
    >
      {/* Your app */}
    </DynoDesignProvider>
  );
}
\`\`\`

---

## Theme System (\`data-theme\`)

Apply \`data-theme\` to any element to change the color context for it and all children.

### Available Themes

| Category | Values |
|----------|--------|
| **Light** | Default, Primary-Light, Primary, Secondary-Light, Secondary, Tertiary-Light, Tertiary, Neutral-Light, Neutral |
| **Dark** | Primary-Dark, Secondary-Dark, Tertiary-Dark, Neutral-Dark |
| **Semantic** | Info-Light, Info, Success-Light, Success, Warning-Light, Warning, Error-Light, Error, Info-Dark, Success-Dark, Warning-Dark, Error-Dark |
| **Navigation** | App-Bar, Nav-Bar, Status |

\`\`\`jsx
{/* Page section with primary theme */}
<section data-theme="Primary">
  <H2>This section uses Primary colors</H2>
  <Body>Text, borders, buttons all adapt automatically</Body>
</section>

{/* Dark hero banner */}
<div data-theme="Primary-Dark">
  <H1>Dark themed hero</H1>
</div>

{/* Error alert area */}
<div data-theme="Error-Light">
  <Alert variant="error">Something went wrong</Alert>
</div>
\`\`\`

**Light themes** (-Light suffix) use the palette's lightest tone as background.
**Medium themes** (no suffix) use the palette's mid-range tone.
**Dark themes** (-Dark suffix) use the palette's darkest tone.
**Default** adapts based on user selection — it can be white, black, tonal, or gray.

---

## Surface System (\`data-surface\`)

Surfaces create depth within a theme. Apply \`data-surface\` to containers, cards, and nested elements.

### Available Surfaces

| Surface | Use For |
|---------|---------|
| \`Surface\` | Page-level background (set by the theme) |
| \`Surface-Dim\` | Slightly darker than Surface |
| \`Surface-Bright\` | Slightly lighter than Surface |
| \`Container\` | Cards, dialogs, popovers — elevated from Surface |
| \`Container-Low\` | Subtle inset containers |
| \`Container-Lowest\` | Deepest inset level |
| \`Container-High\` | Raised containers (more prominent) |
| \`Container-Highest\` | Most elevated containers |

\`\`\`jsx
{/* Page with nested containers */}
<div data-theme="Default">
  <Body>Page-level content on Surface</Body>

  <Card data-surface="Container">
    <H3>Card Title</H3>
    <Body>Card content — uses Container colors</Body>

    {/* Nested element inside a card */}
    <div data-surface="Container-Low">
      <BodySmall>Inset content within the card</BodySmall>
    </div>
  </Card>
</div>
\`\`\`

**Important**: When nesting surfaces, text colors automatically adapt. A \`Container\` inside a dark theme gets lighter text. You do NOT need to set text colors manually.

---

## Component Style (\`data-style\`)

Selected style: **${styleName}** (border-radius: ${radii.small}px / ${radii.medium}px / ${radii.large}px for small/medium/large)

| Style | Small Radius | Medium Radius | Large Radius |
|-------|-------------|---------------|--------------|
| Professional | 4px | 8px | 12px |
| Modern | 6px | 12px | 16px |
| Bold | 2px | 4px | 8px |
| Playful | 12px | 20px | 28px |

\`\`\`jsx
<div data-style="${styleName}">
  {/* All components inside inherit this border radius */}
  <Button>Styled Button</Button>
  <Card>Styled Card</Card>
</div>
\`\`\`

---

## Token Reference — All CSS Variables

When a theme is applied, these shorthand variables resolve automatically:

### Core Layout Tokens

\`\`\`css
var(--Background)           /* page background color */
var(--Surface)              /* surface background */
var(--Surface-Dim)          /* dimmer surface */
var(--Surface-Bright)       /* brighter surface */
var(--Container)            /* card/container background */
var(--Container-Low)        /* low container */
var(--Container-Lowest)     /* lowest container */
var(--Container-High)       /* high container */
var(--Container-Highest)    /* highest container */
\`\`\`

### Text Tokens

\`\`\`css
var(--Text)                 /* body text */
var(--Header)               /* heading text */
var(--Quiet)                /* muted/secondary text */
var(--Container-Text)       /* text on containers */
var(--Container-Header)     /* heading on containers */
var(--Container-Quiet)      /* muted text on containers */
\`\`\`

### Border Tokens

\`\`\`css
var(--Border)               /* primary borders */
var(--Border-Variant)       /* subtle/secondary borders */
var(--Container-Border)     /* borders on containers */
var(--Container-Border-Variant) /* subtle borders on containers */
\`\`\`

### Interactive State Tokens

\`\`\`css
var(--Hover)                /* hover background */
var(--Active)               /* active/pressed background */
\`\`\`

### Button Tokens

Buttons have per-color tokens. Replace \`{Color}\` with: Default, Primary, Secondary, Tertiary.

\`\`\`css
var(--Buttons-{Color}-Button)   /* button fill color */
var(--Buttons-{Color}-Text)     /* button text color */
var(--Buttons-{Color}-Hover)    /* button hover color */
var(--Buttons-{Color}-Active)   /* button active/pressed color */
var(--Buttons-{Color}-Border)   /* outline button border */
\`\`\`

Container-level button tokens:
\`\`\`css
var(--Container-Buttons-Default-Button)
var(--Container-Buttons-Default-Text)
var(--Container-Buttons-Default-Hover)
var(--Container-Buttons-Default-Active)
var(--Container-Buttons-Default-Border)
\`\`\`

### Bevel Tokens (3D Button Effect)

\`\`\`css
var(--Highlight)            /* bevel top-left highlight (RGBA with opacity) */
var(--Lowlight)             /* bevel bottom-right shadow (RGBA with opacity) */
\`\`\`

Bevel is applied as \`box-shadow\` with inset shadows:
\`\`\`css
box-shadow:
  inset <offset>px <offset>px <blur>px var(--Highlight),
  inset -<offset>px -<offset>px <blur>px var(--Lowlight);
\`\`\`

Offset/blur scale with button size (Small/Medium/Large).

### Drop Shadow Tokens

\`\`\`css
var(--Dropshadow-Color)           /* shadow on surfaces */
var(--Container-Dropshadow-Color) /* shadow on containers */
\`\`\`

5-level elevation system. Use on the parent surface, not the element itself:
\`\`\`css
.level-1 { box-shadow: 0 1px 2px var(--Dropshadow-Color); }
.level-2 { box-shadow: 0 2px 4px var(--Dropshadow-Color), 0 1px 2px var(--Dropshadow-Color); }
.level-3 { box-shadow: 0 4px 8px var(--Dropshadow-Color), 0 2px 4px var(--Dropshadow-Color); }
.level-4 { box-shadow: 0 8px 16px var(--Dropshadow-Color), 0 4px 8px var(--Dropshadow-Color); }
.level-5 { box-shadow: 0 16px 32px var(--Dropshadow-Color), 0 8px 16px var(--Dropshadow-Color); }
\`\`\`

### Focus Tokens

\`\`\`css
var(--Focus-Visible)        /* focus ring color (used with :focus-visible) */
\`\`\`

### Typography Tokens

\`\`\`css
var(--Font-Family-Header)   /* heading font */
var(--Font-Family-Body)     /* body font */
var(--Style-Border-Radius)  /* component border radius */
var(--Card-Radius)          /* card border radius */
\`\`\`

---

## Typography

| Role | Family | Weight |
|------|--------|--------|
${input.typographyStyles.map(t => `| ${t.type} | ${t.family} | ${t.weight} |`).join('\n')}

---

## Component Usage

Import from \`@dynodesign/components\`:

\`\`\`jsx
import {
  // Layout
  VStack, HStack, Grid, Container, Divider,

  // Typography
  H1, H2, H3, H4, H5, H6, Body, BodySmall, Label, Caption,

  // Inputs
  Button, TextField, TextArea, Select, Checkbox, Radio, Switch, Slider,

  // Display
  Card, Alert, Badge, Tag, Avatar, Tooltip, Chip,

  // Navigation
  AppBar, NavBar, BottomNavigation, Tabs, Breadcrumbs, Pagination, Menu,

  // Theming
  ThemedZone,

  // Feedback
  Dialog, Modal, Drawer, Snackbar, Progress, Skeleton,

  // Data
  Table, List, Accordion,
} from '@dynodesign/components';
\`\`\`

### Button

\`\`\`jsx
{/* Variant pattern: {color}, {color}-outline, {color}-light */}
{/* Colors: primary, secondary, tertiary, neutral, info, success, warning, error */}

<Button variant="primary">Solid primary</Button>
<Button variant="primary-outline">Outlined primary</Button>
<Button variant="primary-light">Light primary</Button>
<Button variant="neutral-outline">Outlined neutral</Button>
<Button variant="error">Solid error</Button>
<Button variant="ghost">Ghost (no background)</Button>

{/* Sizes: small, medium, large */}
<Button variant="primary" size="large" startIcon={<AddIcon />}>
  Save Changes
</Button>
\`\`\`

**Button color values**: \`default\`, \`primary\`, \`secondary\`, \`tertiary\`, \`neutral\`, \`info\`, \`success\`, \`warning\`, \`error\`

### Card

\`\`\`jsx
<Card>
  <H3>Card Title</H3>
  <Body>Card content is automatically on a Container surface.</Body>
  <Button variant="solid" color="default">Action</Button>
</Card>
\`\`\`

Cards automatically apply \`data-surface="Container"\`, so text colors, button colors, and borders adapt.

### TextField

\`\`\`jsx
<TextField label="Email" placeholder="you@example.com" />
<TextField label="Password" type="password" error="Required" />
\`\`\`

### Alert

\`\`\`jsx
<Alert variant="info">Informational message</Alert>
<Alert variant="success">Success message</Alert>
<Alert variant="warning">Warning message</Alert>
<Alert variant="error">Error message</Alert>
\`\`\`

### Layout

\`\`\`jsx
<VStack spacing={3}>
  <H2>Vertical Stack</H2>
  <Body>Items stacked vertically with gap</Body>
</VStack>

<HStack spacing={2}>
  <Button>Left</Button>
  <Button>Right</Button>
</HStack>
\`\`\`

---

## Component Prop Patterns

### Typography — Layout Prop

All typography components (H1–H6, Body, BodySmall, Caption, Label, etc.) accept a \`layout\` prop that controls horizontal sizing:

\`\`\`jsx
{/* "fill" (default) — component stretches to fill available width */}
<H2 layout="fill">Page Title</H2>

{/* "hug" — component sizes to its content, no stretching */}
<H2 layout="hug">Page Title</H2>
<Caption layout="hug">Subtitle text</Caption>

{/* Use "hug" when placing typography side-by-side to prevent wrapping */}
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <H2 layout="hug">Title</H2>
  <Caption layout="hug">3 items</Caption>
</div>
\`\`\`

### AppBar

\`\`\`jsx
{/* Always wrap in ThemedZone */}
{/* Mobile */}
<ThemedZone theme="App-Bar" surface="Surface-Bright" as="header">
  <AppBar
    mode="mobile"              {/* "mobile" | "desktop" */}
    mobileVariant="title"      {/* "title" | "search" (mobile only) */}
    title="My App"             {/* shown in mobile title variant */}
    subtitle="Tagline"         {/* optional subtitle */}
    companyName="My App"       {/* brand name */}
    barColor="default"         {/* "default" | "white" */}
    rightContent={<Avatar />}  {/* React node for the right side */}
  />
</ThemedZone>

{/* Desktop */}
<ThemedZone theme="App-Bar" surface="Surface-Bright" as="header">
  <AppBar
    mode="desktop"
    companyName="My App"
    navLinks={['Home', 'About', 'Contact']}
    showRightButtons           {/* shows action buttons on right */}
    loginType="login"          {/* login button type */}
    menuType="hamburger"       {/* menu type */}
    brandType="name"           {/* "name" | other */}
    searchPosition="right"     {/* search bar position */}
  />
</ThemedZone>
\`\`\`

### BottomNavigation

\`\`\`jsx
{/* Wrap in ThemedZone with Nav-Bar theme */}
<ThemedZone theme="Nav-Bar" surface="Surface-Bright">
  <BottomNavigation
    value={selectedIndex}                    {/* currently selected tab index */}
    onChange={(event, newIndex) => {}}        {/* tab change handler */}
    items={[
      { label: 'Home', icon: <HomeIcon /> },
      { label: 'Search', icon: <SearchIcon /> },
      { label: 'Settings', icon: <SettingsIcon /> },
    ]}
  />
</ThemedZone>
\`\`\`

---

## Dark Mode

Dark mode is applied via theme suffixes: \`Primary-Dark\`, \`Secondary-Dark\`, \`Tertiary-Dark\`, \`Neutral-Dark\`.

\`\`\`jsx
{/* Dark section */}
<div data-theme="Primary-Dark">
  <H1>Dark Mode Section</H1>
  <Card>
    <Body>Card adapts automatically in dark mode</Body>
  </Card>
</div>
\`\`\`

All tokens (text, borders, buttons, containers, shadows) automatically invert for dark backgrounds. You never need to set text or button colors manually for dark mode.

### Dark Mode Color Scale

In dark mode, the 12-tone palette shifts to darker LCH tones. Color-1 remains darkest, Color-12 remains lightest, but the entire range is compressed toward the dark end. Buttons in dark mode always use Color-12 (lightest in the palette) for visibility.

---

## Nesting Rules — How Tokens Cascade

The design system uses CSS custom property cascading. Here is the precedence:

1. **\`data-theme\`** — sets Background, Text, Header, Quiet, Border, Hover, Active, and button colors
2. **\`data-surface\`** — overrides Background + provides Container-level text/border/button tokens
3. **\`data-style\`** — sets border radius

\`\`\`html
<!-- Full nesting example -->
<div data-theme="Default" data-style="${styleName}">
  <!-- Page level: uses Surface tokens -->
  <h1 style="color: var(--Header)">Page Title</h1>
  <p style="color: var(--Text)">Body text on surface</p>

  <!-- Card: uses Container tokens -->
  <div data-surface="Container" style="background: var(--Container); border: 1px solid var(--Container-Border)">
    <h2 style="color: var(--Container-Header)">Card Title</h2>
    <p style="color: var(--Container-Text)">Card body text</p>
    <button style="background: var(--Container-Buttons-Default-Button); color: var(--Container-Buttons-Default-Text)">
      Action
    </button>
  </div>

  <!-- Themed section nested inside -->
  <section data-theme="Primary-Light">
    <p style="color: var(--Text)">Now using Primary-Light text color</p>
  </section>
</div>
\`\`\`

**Key rule**: You do NOT need to manually adjust colors when nesting. The CSS cascade handles it. Just set \`data-theme\` and \`data-surface\` — all tokens resolve correctly.

---

## Hover & Active Pattern

Interactive elements follow a one-step pattern:

- **Active** = one step from the background color in the palette
- **Hover** = 50% mix between background and Active color
- Dark tones (Color 1-5): step goes darker
- Light tones (Color 6-12): step goes lighter

\`\`\`css
/* Surface hover/active */
.interactive:hover  { background: var(--Hover); }
.interactive:active { background: var(--Active); }

/* Button hover/active */
.btn:hover  { background: var(--Buttons-Primary-Hover); }
.btn:active { background: var(--Buttons-Primary-Active); }
\`\`\`

---

## CSS Files Reference

Your design system includes these CSS files (all at \`https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/design-systems%2F${uuid}%2F{filename}?alt=media\`):

| File | Contents |
|------|----------|
| \`foundation.css\` | Raw palette colors (Color-1 through Color-12 for each palette), typography tokens, component sizing |
| \`core.css\` | Text, Header, Quiet, Border, Hover, Active, Tag, Icon, Hotlink colors for all palettes and surfaces |
| \`typography-tokens.css\` | Font family, weight, and size definitions |
| \`Light-Mode.css\` | All light theme selectors (Default through Neutral) |
| \`Dark-Mode.css\` | All dark theme selectors |
| \`base.css\` | Button tokens, Default-Button mappings, Background/Surface/Container definitions, effects |
| \`styles.css\` | Border radius values per style (Professional, Modern, Bold, Playful) |

Load order matters: foundation → core → typography-tokens → Light-Mode → Dark-Mode → base → styles.

---

Generated by [Dino Design](https://dinodesign.ai)
`;
}

// ─── Main generation function ───

export async function generateAndUploadDesignSystem(input: GenerateInput): Promise<string> {
  const uuid = input.uuid || crypto.randomUUID();

  // 1. Build full 9-palette sets for light and dark mode
  const lightPalettes = input.colorScheme.tonePalettes || {};
  const darkPalettes = input.colorScheme.darkModeTonePalettes || {};

  const fullLightPalettes = generateFullLightPalettes(
    lightPalettes.primary || [],
    lightPalettes.secondary || [],
    lightPalettes.tertiary || [],
  );

  const fullDarkPalettes = generateFullDarkPalettes(
    darkPalettes.primary || [],
    darkPalettes.secondary || [],
    darkPalettes.tertiary || [],
  );

  // 2. Generate the complete JSON via the real pipeline
  const selectedBackground = input.userSelections.backgroundTheme === 'Primary' ? 'primary' as const : 'neutral' as const;
  const buttonStyle = mapButtonStyle(input.userSelections.button);

  const header = input.typographyStyles.find(t => t.type === 'header');
  const decorative = input.typographyStyles.find(t => t.type === 'decorative');
  const body = input.typographyStyles.find(t => t.type === 'body');

  let designSystemJSON: any;
  try {
    designSystemJSON = exportColorSystemToJSON(
      fullLightPalettes,
      fullDarkPalettes,
      selectedBackground,
      buttonStyle as any,
      input.colorScheme.extractedTones,
      input.componentStyle,
      {
        header: header ? { family: header.family, weight: header.weight } : undefined,
        decorative: decorative ? { family: decorative.family, weight: decorative.weight } : undefined,
        body: body ? { family: body.family, weight: body.weight } : undefined,
      },
      input.designSystemName,
      new Date().toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
      {
        appBar: input.userSelections.appBar,
        navBar: input.userSelections.navBar,
        toolBar: 'white',
      },
      input.surfaceStyle || 'light-tonal',
      undefined,
      {
        defaultTheme: input.userSelections.defaultTheme,
        background: input.userSelections.background as any,
        appBar: (() => { console.log('🔍 [EXPORT] appBar selection:', input.userSelections.appBar); return input.userSelections.appBar; })() as any,
        navBar: input.userSelections.navBar as any,
        status: input.userSelections.status as any,
        button: mapButtonStyle(input.userSelections.button) as any,
        cardColoring: input.userSelections.cardColoring,
        textColoring: input.userSelections.textColoring,
      },
    );

    // Add Platform section to JSON
    designSystemJSON.Platform = {
      Desktop: {
        'Container-Padding': { value: 'var(--Sizing-4)', type: 'spacing' },
        'Button-Height': { value: '32px', type: 'sizing' },
        'Min-Button-Width': { value: '80px', type: 'sizing' },
        'Min-Stack-Gap': { value: '0px', type: 'spacing' },
        'Platform-Label': { value: 'Desktop', type: 'string' },
      },
      'IOS-Mobile': {
        'Container-Padding': { value: 'var(--Sizing-2)', type: 'spacing' },
        'Button-Height': { value: '44px', type: 'sizing' },
        'Min-Stack-Gap': { value: '10px', type: 'spacing' },
        'Platform-Label': { value: 'IOS-Mobile', type: 'string' },
      },
      'IOS-Tablet': {
        'Container-Padding': { value: 'var(--Sizing-3)', type: 'spacing' },
        'Button-Height': { value: '48px', type: 'sizing' },
        'Min-Stack-Gap': { value: '10px', type: 'spacing' },
        'Platform-Label': { value: 'IOS-Tablet', type: 'string' },
      },
      Android: {
        'Container-Padding': { value: 'var(--Sizing-2)', type: 'spacing' },
        'Button-Height': { value: '48px', type: 'sizing' },
        'Min-Stack-Gap': { value: '12px', type: 'spacing' },
        'Platform-Label': { value: 'Android', type: 'string' },
      },
    };

    // Add Cognitive Accessibility section to JSON
    designSystemJSON.Cognitive = {
      Dyslexia: {
        'Cognitive-Multiplier': { value: '1.5', type: 'number' },
        'Body-Font-Family': { value: 'OpenDyslexic', type: 'fontFamily' },
      },
      ADHD: {
        'Cognitive-Multiplier': { value: '1.5', type: 'number' },
      },
    };
  } catch (err) {
    console.error('❌❌❌ JSON generation FAILED:', err);
    console.error('❌ Stack:', (err as Error).stack);
    console.error('❌ Input extractedTones:', input.colorScheme.extractedTones);
    console.error('❌ Input userSelections:', JSON.stringify(input.userSelections));
    // Fallback to simplified JSON
    designSystemJSON = {
      name: input.designSystemName,
      colors: input.colorScheme.colors,
      error: (err as Error).message,
      error: 'Full generation failed, simplified export',
    };
  }

  // 3. Generate CSS files from the JSON
  let cssFiles: Record<string, string> = {};
  console.log('🔍 [CSS Gen] JSON top keys:', Object.keys(designSystemJSON));
  console.log('🔍 [CSS Gen] Has Modes?', !!designSystemJSON.Modes);
  if (designSystemJSON.Modes) {
    console.log('🔍 [CSS Gen] Mode keys:', Object.keys(designSystemJSON.Modes));
    const lm = designSystemJSON.Modes['Light-Mode'];
    if (lm) {
      console.log('🔍 [CSS Gen] Light-Mode keys:', Object.keys(lm));
      console.log('🔍 [CSS Gen] Has Colors?', !!lm.Colors, 'Has Themes?', !!lm.Themes);
      if (lm.Colors?.Primary) console.log('🔍 [CSS Gen] Primary Color-1:', lm.Colors.Primary['Color-1']?.value);
    }
  }
  cssFiles = generateCSSFiles(designSystemJSON);
  console.log('✅ CSS files generated:', Object.keys(cssFiles));
  for (const [name, content] of Object.entries(cssFiles)) {
    console.log(`  ${name}: ${content.length} chars, ${content.split('\n').length} lines`);
  }

  // Also generate base.css
  let baseCSS = '';
  try {
    baseCSS = generateBaseCSS(designSystemJSON);
  } catch (err) {
    console.error('Base CSS generation failed:', err);
  }

  // 4. Build theme.json — store absolute Firebase Storage URLs so the Provider
  // can fetch them directly (Firebase URLs are encoded and can't be path-joined).
  const themeJson = JSON.stringify({
    name: input.designSystemName,
    foundation: getPublicFileUrl(uuid, 'foundation.css'),
    core:       getPublicFileUrl(uuid, 'core.css'),
    lightMode:  getPublicFileUrl(uuid, 'Light-Mode.css'),
    darkMode:   getPublicFileUrl(uuid, 'Dark-Mode.css'),
    base:       getPublicFileUrl(uuid, 'base.css'),
    styles:     getPublicFileUrl(uuid, 'styles.css'),
    defaultTheme: 'Default',
    defaultStyle: input.componentStyle.charAt(0).toUpperCase() + input.componentStyle.slice(1),
    defaultSurface: 'Surface',
    darkTheme: 'Neutral-Dark',
  }, null, 2);

  // 5. Build foundation.css and styles.css (simple static files)
  const headerFamily = header?.family || 'sans-serif';
  const decorativeFamily = decorative?.family || 'sans-serif';
  const bodyFamily = body?.family || 'sans-serif';
  const headerWeight = header?.weight || '700';
  const headerAllCaps = header?.allCaps ? 'uppercase' : 'none';
  const headerLetterSpacing = header?.letterSpacing || '0em';
  const decorativeWeight = decorative?.weight || '600';
  const decorativeAllCaps = decorative?.allCaps ? 'uppercase' : 'none';
  const decorativeLetterSpacing = decorative?.letterSpacing || '0em';
  const bodyWeight = body?.weight || '400';
  // Get customizations from input, fallback to preset defaults
  const sc = input.styleCustomizations;
  const buttonRadius = sc?.buttonRadius ?? BORDER_RADII[input.componentStyle].medium;
  const cardRadius = sc?.radius ?? Math.round(buttonRadius * 1.33);
  const cardPadding = cardRadius >= 16 ? 20 : 16;
  const buttonHeight = sc?.buttonHeight ?? 32;
  const smallButtonHeight = sc?.smallButtonHeight ?? 24;
  const largeButtonHeight = sc?.largeButtonHeight ?? 56;
  const minButtonWidth = sc?.minButtonWidth ?? 60;
  const iconButtonRadius = sc?.iconButtonRadius ?? buttonRadius;
  const bevelPercent = sc?.bevel ?? 0;
  const bevelOpacity = sc?.bevelOpacity ?? 50;
  const bevelPx = Math.round(buttonHeight * bevelPercent / 100);

  const foundationCSS = `:root {

  /* Button */
  --Button-Radius: ${buttonRadius}px;
  --Button-Icon-Radius: ${iconButtonRadius}px;
  --Button-Height: ${buttonHeight}px;
  --Small-Button-Height: ${smallButtonHeight}px;
  --Large-Button-Height: ${largeButtonHeight}px;
  --Button-Min-Width: ${minButtonWidth}px;
  --Button-Bevel: ${bevelPercent};
  --Button-Bevel-Px: ${bevelPx}px;
  --Button-Bevel-Opacity: ${bevelOpacity / 100};
  --Style-Border-Radius: var(--Button-Radius);

  /* Card */
  --Card-Radius: ${cardRadius}px;
  --Card-Focus-Radius: ${cardRadius + 3}px;
  --Card-Padding: ${cardPadding}px;
  --Style-Gradient-Color-1: var(--Buttons-Primary-Button);
  --Style-Gradient-Color-2: var(--Buttons-Primary-Button);
  --Style-Gradient-Angle: 0;

  --Sizing-1: 8px;
  --Sizing-2: 16px;
  --Sizing-3: 24px;
  --Sizing-4: 32px;
  --Sizing-Half: 4px;
  --Sizing-Quarter: 2px;
  --Sizing-Negative-1: -8px;
  --Sizing-Negative-Half: -4px;
  --Sizing-Negative-Quarter: -2px;
  --Sizing-Negative-1-and-Half: -12px;
  --Min-Stack-Gap: 0px;
}
`;

  const coreCSS = `:root {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Font-Family-Body: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Font-Family-Header: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Header-Text-Transform: var(--Set-Header-Text-Transform, none);
  --Header-Letter-Spacing: var(--Set-Header-Letter-Spacing, 0em);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Decorative-Text-Transform: var(--Set-Decorative-Text-Transform, none);
  --Decorative-Letter-Spacing: var(--Set-Decorative-Letter-Spacing, 0em);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
  --Cognitive-Multiplier: 1;
}

/* Platform Font Overrides */
[data-platform="IOS-Mobile"][data-fonts] {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-platform="IOS-Tablet"][data-fonts] {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-platform="Android"][data-fonts] {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}

[data-platform="IOS-Mobile"][data-fonts="Default"] {
  --Body-Font-Family: "SF Pro";
  --Header-Font-Family: "SF Pro";
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: "SF Pro";
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-platform="IOS-Tablet"][data-fonts="Default"] {
  --Body-Font-Family: "SF Pro";
  --Header-Font-Family: "SF Pro";
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: "SF Pro";
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-platform="Android"][data-fonts="Default"] {
  --Body-Font-Family: "Roboto";
  --Header-Font-Family: "Roboto";
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: "Roboto";
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}

/* Desktop Defaults */
:root {
  --Container-Padding: var(--Sizing-4);
  --Platform-Label: "Desktop";
  --Button-Height: 32px;
  --Min-Button-Width: 80px;
  --Set-Font-Family-Header: '${headerFamily}', serif;
  --Set-Font-Family-Header-Weight: ${headerWeight};
  --Set-Header-Text-Transform: ${headerAllCaps};
  --Set-Header-Letter-Spacing: ${headerLetterSpacing};
  --Set-Font-Family-Decorative: '${decorativeFamily}', sans-serif;
  --Set-Font-Family-Decorative-Weight: ${decorativeWeight};
  --Set-Decorative-Text-Transform: ${decorativeAllCaps};
  --Set-Decorative-Letter-Spacing: ${decorativeLetterSpacing};
  --Set-Font-Family-Body: '${bodyFamily}', sans-serif;
  --Set-Font-Family-Body-Weight: ${bodyWeight};
  --Set-Font-Family-Body-Semibold-Weight: 600;
  --Set-Font-Family-Body-Bold-Weight: 700;
  --Body-Font-Size: 16px;
  --Body-Letter-Spacing: 0;
  --Body-Line-Height: 24px;
  --Body-Paragraph-Spacing: 16px;
  --H1-Font-Size: 40px;
  --H1-Line-Height: 40px;
  --H1-Letter-Spacing: -1px;
  --H1-Paragraph-Spacing: 32px;
  --H2-Font-Size: 32px;
  --H2-Line-Height: 40px;
  --H2-Letter-Spacing: -1px;
  --H2-Paragraph-Spacing: 24px;
  --H3-Font-Size: 28px;
  --H3-Line-Height: 36px;
  --H3-Letter-Spacing: -.5px;
  --H3-Paragraph-Spacing: 20px;
  --H4-Font-Size: 24px;
  --H4-Line-Height: 32px;
  --H4-Letter-Spacing: -.5px;
  --H4-Paragraph-Spacing: 16px;
  --H5-Font-Size: 20px;
  --H5-Line-Height: 28px;
  --H5-Letter-Spacing: 0px;
  --H5-Paragraph-Spacing: 12px;
  --H6-Font-Size: 18px;
  --H6-Line-Height: 26px;
  --H6-Letter-Spacing: 0px;
  --H6-Paragraph-Spacing: 12px;
  --Label-Font-Size: 14px;
  --Label-Line-Height: 20px;
  --Label-Letter-Spacing: 0px;
  --Label-Paragraph-Spacing: 4px;
  --Button-Font-Size: 16px;
  --Button-Line-Height: 20px;
}

/* iOS Mobile */
[data-platform="IOS-Mobile"] {
  --Container-Padding: var(--Sizing-2);
  --Platform-Label: "IOS-Mobile";
  --Button-Height: 44px;
  --Min-Stack-Gap: 10px;
  --Body-Font-Size: 16px;
  --Body-Letter-Spacing: -.5px;
  --Body-Line-Height: 24px;
  --Body-Paragraph-Spacing: 16px;
  --H1-Font-Size: 32px;
  --H1-Line-Height: 40px;
  --H1-Letter-Spacing: -1px;
  --H1-Paragraph-Spacing: 24px;
  --H2-Font-Size: 28px;
  --H2-Line-Height: 32px;
  --H2-Letter-Spacing: -.5px;
  --H2-Paragraph-Spacing: 20px;
  --H3-Font-Size: 24px;
  --H3-Line-Height: 32px;
  --H3-Letter-Spacing: -.5px;
  --H3-Paragraph-Spacing: 16px;
  --H4-Font-Size: 20px;
  --H4-Line-Height: 28px;
  --H4-Letter-Spacing: 0px;
  --H4-Paragraph-Spacing: 12px;
  --H5-Font-Size: 18px;
  --H5-Line-Height: 26px;
  --H5-Letter-Spacing: 0px;
  --H5-Paragraph-Spacing: 12px;
  --H6-Font-Size: 16px;
  --H6-Line-Height: 24px;
  --H6-Letter-Spacing: .5px;
  --H6-Paragraph-Spacing: 8px;
  --Label-Font-Size: 13px;
  --Label-Line-Height: 18px;
  --Label-Letter-Spacing: 0px;
  --Label-Paragraph-Spacing: 4px;
  --Button-Font-Size: 16px;
  --Button-Line-Height: 20px;
}

/* iOS Tablet */
[data-platform="IOS-Tablet"] {
  --Container-Padding: var(--Sizing-3);
  --Platform-Label: "IOS-Tablet";
  --Button-Height: 48px;
  --Min-Stack-Gap: 10px;
  --Body-Font-Size: 17px;
  --Body-Letter-Spacing: -.5px;
  --Body-Line-Height: 25.5px;
  --Body-Paragraph-Spacing: 16px;
  --H1-Font-Size: 40px;
  --H1-Line-Height: 48px;
  --H1-Letter-Spacing: -1.5px;
  --H1-Paragraph-Spacing: 32px;
  --H2-Font-Size: 32px;
  --H2-Line-Height: 40px;
  --H2-Letter-Spacing: -1px;
  --H2-Paragraph-Spacing: 24px;
  --H3-Font-Size: 28px;
  --H3-Line-Height: 36px;
  --H3-Letter-Spacing: -.5px;
  --H3-Paragraph-Spacing: 20px;
  --H4-Font-Size: 24px;
  --H4-Line-Height: 32px;
  --H4-Letter-Spacing: -.5px;
  --H4-Paragraph-Spacing: 16px;
  --H5-Font-Size: 20px;
  --H5-Line-Height: 28px;
  --H5-Letter-Spacing: 0px;
  --H5-Paragraph-Spacing: 12px;
  --H6-Font-Size: 18px;
  --H6-Line-Height: 26px;
  --H6-Letter-Spacing: 0px;
  --H6-Paragraph-Spacing: 12px;
  --Label-Font-Size: 14px;
  --Label-Line-Height: 20px;
  --Label-Letter-Spacing: 0px;
  --Label-Paragraph-Spacing: 4px;
  --Button-Font-Size: 17px;
  --Button-Line-Height: 21px;
}

/* Android */
[data-platform="Android"] {
  --Container-Padding: var(--Sizing-2);
  --Platform-Label: "Android";
  --Button-Height: 48px;
  --Min-Stack-Gap: 12px;
  --Body-Font-Size: 16px;
  --Body-Line-Height: 24px;
  --Body-Letter-Spacing: .5px;
  --Body-Paragraph-Spacing: 16px;
  --H1-Font-Size: 36px;
  --H1-Line-Height: 40px;
  --H1-Letter-Spacing: -.5px;
  --H1-Paragraph-Spacing: 20px;
  --H2-Font-Size: 28px;
  --H2-Line-Height: 36px;
  --H2-Letter-Spacing: -.5px;
  --H2-Paragraph-Spacing: 20px;
  --H3-Font-Size: 24px;
  --H3-Line-Height: 32px;
  --H3-Letter-Spacing: 0px;
  --H3-Paragraph-Spacing: 16px;
  --H4-Font-Size: 20px;
  --H4-Line-Height: 28px;
  --H4-Letter-Spacing: 0px;
  --H4-Paragraph-Spacing: 12px;
  --H5-Font-Size: 18px;
  --H5-Line-Height: 26px;
  --H5-Letter-Spacing: 0px;
  --H5-Paragraph-Spacing: 12px;
  --H6-Font-Size: 16px;
  --H6-Line-Height: 24px;
  --H6-Letter-Spacing: .5px;
  --H6-Paragraph-Spacing: 8px;
  --Label-Font-Size: 13px;
  --Label-Line-Height: 18px;
  --Label-Letter-Spacing: 0px;
  --Label-Paragraph-Spacing: 4px;
  --Button-Font-Size: 16px;
  --Button-Line-Height: 20px;
}

/* Decorative Font Application */
/* Typography variants: Header uses body font by default, Decorative Header uses decorative font */

[data-surface="Surface"] [data-decorative],
[data-surface="Surface-Dim"] [data-decorative],
[data-surface="Surface-Dimmest"] [data-decorative],
[data-surface="Surface-Bright"] [data-decorative] {
  --Font-Family-Header: var(--Set-Font-Family-Header);
  --Font-Family-Header-Weight: var(--Set-Font-Family-Header-Weight);
  --Font-Family-Overline: var(--Set-Font-Family-Decorative);
}

/* Explicit decorative variants — always available regardless of mode */
[data-typography="decorative-header"] {
  font-family: var(--Set-Font-Family-Header);
  font-weight: var(--Set-Font-Family-Header-Weight);
}
[data-typography="decorative-overline"] {
  font-family: var(--Set-Font-Family-Decorative);
}

/* Cognitive Accessibility Overrides */
[data-cognitive="Dyslexia"] {
  --Cognitive-Multiplier: 1.5;
  --Body-Font-Family: "OpenDyslexic";
  --Body-Font-Weight: 400;
  --Body-Semibold-Font-Weight: 700;
  --Body-Bold-Font-Weight: 700;
}

[data-cognitive="ADHD"] {
  --Cognitive-Multiplier: 1.5;
}
`;

  // Button bevel is implemented entirely inside the consumer's Button
  // component (reads --Button-Bevel, per-variant Highlight/Lowlight, and
  // the size-specific height token), so styles.css stays empty of button
  // overrides — adding any would win on specificity and break Button.js.
  const stylesCSS = `/* Overrides */\n`;

  // 6. Import typography-tokens.css
  const { typographyTokensCSS } = await import('./typographyTokens');

  // 7. Assemble all files for upload
  const uploadFiles: { name: string; content: string; type: string }[] = [
    { name: 'foundation.css', content: foundationCSS, type: 'text/css' },
    { name: 'core.css', content: coreCSS, type: 'text/css' },
    { name: 'typography-tokens.css', content: typographyTokensCSS, type: 'text/css' },
    { name: 'styles.css', content: stylesCSS, type: 'text/css' },
    { name: 'theme.json', content: themeJson, type: 'application/json' },
    { name: 'tokens.json', content: JSON.stringify(designSystemJSON, null, 2), type: 'application/json' },
    { name: 'figma.json', content: (() => {
      try {
        if (input.styleCustomizations) designSystemJSON._componentStyle = input.styleCustomizations;
        designSystemJSON._userSelections = input.userSelections;
        const figmaPayload = generateFigmaJSON(designSystemJSON);
        // Metadata that the Figma plugin reads to detect updates since its
        // last import. version is monotonic; lastModified is ISO 8601.
        figmaPayload.Metadata = {
          ...(figmaPayload.Metadata || {}),
          dinoId: uuid,
          version: input.version ?? 1,
          lastModified: new Date().toISOString(),
          name: input.designSystemName,
        };
        return JSON.stringify(figmaPayload, null, 2);
      } catch (e) { console.error('❌ figma.json generation failed:', e); return '{}'; }
    })(), type: 'application/json' },
    { name: 'DINO-TOKENS.md', content: buildDinoTokensMd(uuid, input), type: 'text/markdown' },
  ];

  // Add generated CSS files (Light-Mode.css, Dark-Mode.css, etc.)
  if (cssFiles['Light-Mode.css']) {
    uploadFiles.push({ name: 'Light-Mode.css', content: cssFiles['Light-Mode.css'], type: 'text/css' });
  }
  if (cssFiles['Dark-Mode.css']) {
    uploadFiles.push({ name: 'Dark-Mode.css', content: cssFiles['Dark-Mode.css'], type: 'text/css' });
  }
  if (baseCSS) {
    uploadFiles.push({ name: 'base.css', content: baseCSS, type: 'text/css' });
  }

  // Add any other generated CSS files — excluding the three the dedicated
  // branches above already pushed. Without `base.css` in this skip-list it
  // would land in the upload list twice (once from line 1199, once here),
  // which both wastes a network round-trip and leaves a confusing
  // "base.css, base.css" trail in the upload log.
  const alreadyPushed = new Set(['Light-Mode.css', 'Dark-Mode.css', 'base.css']);
  for (const [name, content] of Object.entries(cssFiles)) {
    if (!alreadyPushed.has(name)) {
      uploadFiles.push({ name, content, type: 'text/css' });
    }
  }

  // 7. Upload mood board image if available
  const moodBoardSource = input.moodBoardFile || input.moodBoardUrl;
  if (moodBoardSource) {
    try {
      let blob: Blob;
      if (input.moodBoardFile) {
        blob = input.moodBoardFile;
      } else {
        const response = await fetch(input.moodBoardUrl!);
        blob = await response.blob();
      }
      await uploadDesignSystemFile(uuid, 'moodboard.png', blob, blob.type || 'image/png');
      console.log(`Mood board uploaded (${(blob.size / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.error('Mood board upload error:', e);
    }
  }

  // 8. Upload all files to Firebase Storage
  for (const file of uploadFiles) {
    try {
      await uploadDesignSystemFile(uuid, file.name, file.content, file.type);
    } catch (err: any) {
      console.error(`Failed to upload ${file.name}:`, err);
      throw new Error(`Upload failed for ${file.name}: ${err?.message || String(err)}`);
    }
  }

  console.log(`Design system uploaded: ${uuid}`);
  console.log(`Files: ${uploadFiles.map(f => f.name).join(', ')}`);
  return uuid;
}
