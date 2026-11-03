import { uploadDesignSystemFile, getDesignSystemFileUrl, getPublicFileUrl } from './firebase/storage';
import {
  bevelCSS, bevelJSON, PLATFORM_TARGET, PLATFORM_SPACER, platformButtonHeight,
  platformBevelCSS,
  fabBevelVars,
} from './bevelGeometry';
import { FAB_SIZE } from './componentSize';
import { extractHeroImage } from './heroImage';
import type { ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from '../types';
import { toneToColorNumber } from './colorScale';
import { generateFullLightPalettes, generateFullDarkPalettes } from './generateFullPalettes';
import { exportColorSystemToJSON } from './cssgen/exportColorSystem';
import { generateCSSFiles, generateBaseCSS } from './cssgen/exportToCSS';
import { generateFigmaJSON } from './generateFigmaJSON';
import { computeRadii, migrateLegacyRadii } from './componentRadii';
import { typographyDeclarations } from './cssgen/generateTypographyTokensCSS';
import { resolveRoles, SYSTEM_UI_STACK } from './typeScale';
import { overlayOffsetCSS, overlayWidthCSS, DEVICE_MARGIN } from './deviceChrome';
import { DEVICE_COLUMNS, DEVICE_GUTTER, gridCSS } from './layoutGrid';
import { buildDesignSystemDoc, SHOWCASE_BASE } from './endUserDocs';

/**
 * Returns a public download URL for a file in a design system.
 * Used by Playground / ApiTokens to load the user's exported tokens.
 */
export async function getStoredFileUrl(uuid: string, filename: string): Promise<string> {
  return getDesignSystemFileUrl(uuid, filename);
}

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
    case 'match': return 'match-fixed';
    case 'black-white': return 'black-white';
    default: return 'primary-fixed';
  }
}

/* The end-user doc (DINO-TOKENS.md, served as the "CLAUDE.md URL") lives in
 * endUserDocs.ts — pure, so a test can render it for a sample system.
 * SHOWCASE_BASE moved with it and is re-exported for existing callers. */
export { SHOWCASE_BASE };

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
        // Pass the WHOLE role, not just family + weight. Letter spacing, case,
        // the Header's Flex axes and the Display's size/leading/noise all live
        // on the role, and the JSON export needs them to describe the same
        // system the CSS does.
        header: header ? { ...header, type: undefined } as never : undefined,
        decorative: decorative ? { ...decorative, type: undefined } as never : undefined,
        body: body ? { ...body, type: undefined } as never : undefined,
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
        buttonTone: input.userSelections.buttonTone,
        buttonCellTones: input.userSelections.buttonCellTones,
        cardColoring: input.userSelections.cardColoring,
        textColoring: input.userSelections.textColoring,
      },
    );

    // Add Platform section to JSON.
    // `buttonHeight` proper is derived further down (after migrateLegacyRadii),
    // which is AFTER this point in the same scope — reading it here would hit
    // the temporal dead zone. Read the same input the migration defaults from.
    const platformDesktopButtonHeight = input.styleCustomizations?.buttonHeight ?? 32;
    /* No Platform section, removed 2026-09-29 with the Figma collection.
     *
     * Four modes where Devices-Type has seven, and the collection no longer
     * exists — so this reached the plugin (which reads tokens.json as well as
     * figma.json) and had it recreated on every import, the same way Cognitive
     * did.
     *
     * Button-Height, Min-Button-Width, Platform-Spacer and the overlay offsets
     * are all written elsewhere already — Devices-Type or Component-Size. What
     * had no other home: `Target`, `Min-Stack-Gap` and `Container-Padding`.
     *
     * All three are WEB-ONLY by decision, not by omission. They ship in
     * foundation.css per platform block, which is what the library reads —
     * Button.js grows a small button's tap target to `var(--Target)` at
     * runtime — and none of them describes something a Figma layer binds to.
     * See the fuller note in generateFigmaJSON beside the Platform removal. */

    /* No Cognitive section on tokens.json, removed 2026-09-29.
     *
     * It held a Dyslexia and an ADHD preset — a 1.5 line-height multiplier and
     * OpenDyslexic — and nothing read it back. What it DID do was reach the
     * Figma plugin, which reads tokens.json as well as figma.json and turned
     * the section into a `Cognitive` variable collection. That collection was
     * deleted by hand after every regenerate and recreated by the next one.
     *
     * The feature is not being removed, and this is the distinction worth
     * keeping straight. The cognitive multiplier and its overrides were removed 2026-10-29: nothing ever switched them on.
     * declares it at 1 and raises it to 1.5 under the accessibility overrides
     * further down this file, and the library multiplies line heights by it —
     * Link.js alone reads it five times. That is the whole mechanism. The JSON
     * section was a second statement of the same two numbers, for a consumer
     * that did not exist.
     *
     * If a Cognitive collection is ever wanted in Figma, it should come from
     * generateFigmaJSON like every other collection, where
     * figmaCollectionNames.test.ts would make someone confirm the file has one. */
  } catch (err) {
    console.error('❌❌❌ JSON generation FAILED:', err);
    console.error('❌ Stack:', (err as Error).stack);
    console.error('❌ Input extractedTones:', input.colorScheme.extractedTones);
    console.error('❌ Input userSelections:', JSON.stringify(input.userSelections));
    // Fallback to simplified JSON
    designSystemJSON = {
      name: input.designSystemName,
      colors: input.colorScheme.colors,
      error: (err as Error).message ?? 'Full generation failed, simplified export',
    };
  }

  // Attach _componentStyle BEFORE running any CSS generator so the
  // generators that depend on it (bevel, radius, modal-padding emission in
  // generateBaseCSS) actually see the user's component customizations.
  // Was previously only set later, inside the figma.json IIFE — which meant
  // base.css regenerated without bevel/radius/modal tokens.
  if (input.styleCustomizations) designSystemJSON._componentStyle = input.styleCustomizations;

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
    // Listed between core and the mode sheets because that is the cascade
    // order the Provider loads in (foundation → core → typography → mode →
    // base → styles).
    //
    // Omitting this slot did not fail loudly: the Provider simply never
    // fetched the brand's ramp, so the lib's BUNDLED typography-tokens.css
    // won on [data-device="Desktop"] and replaced it. A header weight of
    // 857 rendered as 600 and H1 came out 32px instead of 48px — a design
    // system quietly wearing the lib's default type.
    typography: getPublicFileUrl(uuid, 'typography-tokens.css'),
    lightMode:  getPublicFileUrl(uuid, 'Light-Mode.css'),
    darkMode:   getPublicFileUrl(uuid, 'Dark-Mode.css'),
    base:       getPublicFileUrl(uuid, 'base.css'),
    styles:     getPublicFileUrl(uuid, 'styles.css'),
    defaultTheme: 'Default',
    defaultStyle: input.componentStyle.charAt(0).toUpperCase() + input.componentStyle.slice(1),
    defaultSurface: 'Surface',
    /* No darkTheme. It was hard-coded 'Neutral' here, and the Provider obeyed
       it: in dark mode the root switched from Default to Neutral, bypassing
       the Default theme that carries the chosen page background into dark
       mode (its own palette at tone 2, DARK_PAGE_N). A Primary-background
       system went neutral. The Provider (0.36.3+) also ignores the field in
       already-published files. */
  }, null, 2);

  // 5. Build foundation.css and styles.css (simple static files)
  // The four faces, resolved once. Header is pinned to Google Sans Flex here
  // (with its axes) rather than taken from the picked family, so a design saved
  // before the switch still generates the same CSS as a fresh one.
  const resolvedFaces = resolveRoles(input.typographyStyles);
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
  // Get customizations from input, run legacy-shape migration, then compute
  // pixel radii once via computeRadii() so every consumer agrees.
  const sc = migrateLegacyRadii({
    ...(input.styleCustomizations || {}),
    buttonHeight: input.styleCustomizations?.buttonHeight ?? 32,
    smallButtonHeight: input.styleCustomizations?.smallButtonHeight ?? 24,
    largeButtonHeight: input.styleCustomizations?.largeButtonHeight ?? 56,
  });
  const buttonHeight = sc.buttonHeight;
  const smallButtonHeight = sc.smallButtonHeight;
  const largeButtonHeight = sc.largeButtonHeight;
  const minButtonWidth = input.styleCustomizations?.minButtonWidth ?? 60;
  // The large button's text floor. A 56px-tall button needs more room before it
  // stops looking like a stub, so it is the standard floor plus 40px rather
  // than a second number to keep in sync.
  const lgMinButtonWidth = minButtonWidth + 40;
  const bevelPercent = input.styleCustomizations?.bevel ?? 0;

  /* The user's own three heights, in one object so every bevel emission
     takes the same three rather than three separate arguments. */
  const bevelHeights = { medium: buttonHeight, small: smallButtonHeight, large: largeButtonHeight };
  const bevelOpacity = input.styleCustomizations?.bevelOpacity ?? 50;
  const bevelPx = Math.round(buttonHeight * bevelPercent / 100);
  const r = computeRadii(sc);

  /* The three picks, as stored on the design system record. */
  const coreColors = input.colorScheme.colors || [];

  const foundationCSS = `:root {

  /* ── The brand's CORE colors ────────────────────────────────────────────
     The three hexes the user actually picked, verbatim.

     Nothing else in the published CSS says which color a brand chose.
     generateScaledTones writes the pick into the tone NEAREST ITS LIGHTNESS,
     so the index differs per color — a dark pick lands low, a pale one high
     — and no fixed tone can stand for it. Color-Vibrant is not it either: that
     is hardcoded to Color-8, which on a light brand is a pale tint. The
     library's own Colors page showed Color-11 and then Color-8 and was wrong
     both times, because the information was never published.

     Emitted here rather than derived, so a consumer can show the brand's
     colors without reaching into Firestore — which a published stylesheet
     cannot do. */
  --Primary-Core: ${coreColors[0]};
  --Secondary-Core: ${coreColors[1]};
  --Tertiary-Core: ${coreColors[2]};

  /* Button */
  --Button-Radius: ${r.buttonRadius}px;
  --Sm-Button-Radius: ${r.smButtonRadius}px;
  --Lg-Button-Radius: ${r.lgButtonRadius}px;
  --Button-Inner-Focus-Radius: ${r.buttonInnerRadius}px;
  --Sm-Button-Inner-Focus-Radius: ${r.smButtonInnerRadius}px;
  --Lg-Button-Inner-Focus-Radius: ${r.lgButtonInnerRadius}px;
  --Button-Focus-Radius: ${r.buttonFocusRadius}px;
  --Sm-Button-Focus-Radius: ${r.smButtonFocusRadius}px;
  --Lg-Button-Focus-Radius: ${r.lgButtonFocusRadius}px;
  --Vertical-Button-Radius: ${r.verticalButtonRadius}px;
  --Sm-Vertical-Button-Radius: ${r.smVerticalButtonRadius}px;
  --Lg-Vertical-Button-Radius: ${r.lgVerticalButtonRadius}px;
  --Vertical-Button-Focus-Radius: ${r.verticalButtonFocusRadius}px;
  --Sm-Vertical-Button-Focus-Radius: ${r.smVerticalButtonFocusRadius}px;
  --Lg-Vertical-Button-Focus-Radius: ${r.lgVerticalButtonFocusRadius}px;
  --Button-Icon-Radius: ${r.iconButtonRadius}px;
  --Sm-Button-Icon-Radius: ${r.smIconButtonRadius}px;
  --Lg-Button-Icon-Radius: ${r.lgIconButtonRadius}px;
  --Button-Icon-Inner-Radius: ${r.iconButtonInnerRadius}px;
  --Sm-Button-Icon-Inner-Radius: ${r.smIconButtonInnerRadius}px;
  --Lg-Button-Icon-Inner-Radius: ${r.lgIconButtonInnerRadius}px;
  --Button-Icon-Focus-Radius: ${r.iconButtonFocusRadius}px;
  --Sm-Button-Icon-Focus-Radius: ${r.smIconButtonFocusRadius}px;
  --Lg-Button-Icon-Focus-Radius: ${r.lgIconButtonFocusRadius}px;
  --Button-Height: ${buttonHeight}px;
  --Small-Button-Height: ${smallButtonHeight}px;
  --Large-Button-Height: ${largeButtonHeight}px;
  --Button-Min-Width: ${minButtonWidth}px;
  --Lg-Button-Min-Width: ${lgMinButtonWidth}px;
  --Button-Bevel: ${bevelPercent};
  --Button-Bevel-Px: ${bevelPx}px;
  --Button-Bevel-Opacity: ${bevelOpacity / 100};
${Object.entries(fabBevelVars(FAB_SIZE, bevelPercent)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
  /* Bevel geometry — the literal box-shadow numbers, same values the Figma
     Platform/Components collections carry (there as bare numbers, here as px).
     Small and large don't vary by platform, so they live here; medium's live
     in core.css beside the platform button heights they're derived from. */
${bevelCSS('Sm-', smallButtonHeight, bevelPercent)}
${bevelCSS('Lg-', largeButtonHeight, bevelPercent)}
  --Style-Border-Radius: var(--Button-Radius);

  /* Card */
  --Accordion-Radius: ${r.accordionRadius}px;
  --Card-Radius: ${r.cardRadius}px;
  --Sm-Card-Radius: ${r.smCardRadius}px;
  --Lg-Card-Radius: ${r.lgCardRadius}px;
  --Card-Inner-Radius: ${r.cardInnerRadius}px;
  --Sm-Card-Inner-Radius: ${r.smCardInnerRadius}px;
  --Lg-Card-Inner-Radius: ${r.lgCardInnerRadius}px;
  --Card-Focus-Radius: ${r.cardFocusRadius}px;
  --List-Item-Radius: ${r.listItemRadius}px;
  --List-Item-Focus-Radius: ${r.listItemFocusRadius}px;
  --List-Item-Padding: ${r.listItemPadding}px;
  --List-Item-Gap: ${r.listItemGap}px;
  --Sm-List-Item-Padding: ${r.smListItemPadding}px;
  --Lg-List-Item-Padding: ${r.lgListItemPadding}px;
  --Sm-List-Item-Gap: ${r.smListItemGap}px;
  --Lg-List-Item-Gap: ${r.lgListItemGap}px;
  --Sm-List-Item-Radius: ${r.smListItemRadius}px;
  --Lg-List-Item-Radius: ${r.lgListItemRadius}px;
  --Sm-List-Item-Focus-Radius: ${r.smListItemFocusRadius}px;
  --Lg-List-Item-Focus-Radius: ${r.lgListItemFocusRadius}px;
  --List-Item-Image-Radius: ${r.listItemImageRadius}px;
  --List-Item-Default-Image-Width: ${r.listItemImageWidth}px;
  --Sm-List-Item-Default-Image-Width: ${r.smListItemImageWidth}px;
  --Lg-List-Item-Default-Image-Width: ${r.lgListItemImageWidth}px;
  --Sm-Card-Focus-Radius: ${r.smCardFocusRadius}px;
  --Lg-Card-Focus-Radius: ${r.lgCardFocusRadius}px;
  --Card-Padding: ${r.cardPadding}px;
  --Sm-Card-Padding: ${r.smCardPadding}px;
  --Lg-Card-Padding: ${r.lgCardPadding}px;

  /* Modal */
  --Modal-Padding: ${r.modalPadding}px;
  --Modal-Radius: ${r.modalRadius}px;
  --Dropdown-Frame-Radius: ${r.dropdownFrameRadius}px;
  --Menu-Item-Radius: ${r.menuItemRadius}px;
  --Menu-Focus-Radius: ${r.menuFocusRadius}px;
  --Modal-Inner-Radius: ${r.modalInnerRadius}px;
  --Modal-Focus-Radius: ${r.modalFocusRadius}px;

  /* Input */
  --Input-Radius: ${r.inputRadius}px;
  --Sm-Input-Radius: ${r.smInputRadius}px;
  --Lg-Input-Radius: ${r.lgInputRadius}px;
  --Input-Inner-Focus-Radius: ${r.inputInnerRadius}px;
  --Input-Focus-Radius: ${r.inputFocusRadius}px;
  --Sm-Input-Focus-Radius: ${r.smInputFocusRadius}px;
  --Lg-Input-Focus-Radius: ${r.lgInputFocusRadius}px;
  --Input-Swatch-Radius: ${r.inputSwatchRadius}px;
  --Sm-Input-Swatch-Radius: ${r.smInputSwatchRadius}px;
  --Lg-Input-Swatch-Radius: ${r.lgInputSwatchRadius}px;

  /* Checkbox — per-size corner radius = 20% of the box (16/20/24px).
     Border is 2px (set in the lib component). */
  --Sm-Checkbox-Radius: 3.2px;
  --Checkbox-Radius: 4px;
  --Lg-Checkbox-Radius: 4.8px;
  --Style-Gradient-Color-1: var(--Buttons-Primary-Button);
  --Style-Gradient-Color-2: var(--Buttons-Primary-Button);
  --Style-Gradient-Angle: 0;

  --Sizing-Quarter: 2px;
  --Sizing-Half: 4px;
  --Sizing-1: 8px;
  --Sizing-1-and-Half: 12px;
  --Sizing-2: 16px;
  --Sizing-2-and-Half: 20px;
  --Sizing-3: 24px;
  --Sizing-4: 32px;
  --Sizing-5: 40px;
  --Sizing-6: 48px;
  --Sizing-7: 56px;
  --Sizing-8: 64px;
  --Sizing-9: 72px;
  --Sizing-10: 80px;
  --Sizing-11: 88px;
  --Sizing-12: 96px;
  --Sizing-13: 104px;
  --Sizing-14: 112px;
  --Sizing-15: 120px;
  --Sizing-16: 128px;
  --Sizing-20: 160px;
  --Sizing-30: 240px;
  --Sizing-Negative-Quarter: -2px;
  --Sizing-Negative-Half: -4px;
  --Sizing-Negative-1: -8px;
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
  --Dropshadow-Color: 20, 20, 20;  /* fallback; overridden per-theme in Light/Dark-Mode.css */
}

/* Platform Font Overrides */
[data-device="IOS-Mobile"][data-fonts] {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-device="IOS-Tablet"][data-fonts] {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-device="Android"][data-fonts] {
  --Body-Font-Family: var(--Set-Font-Family-Body);
  --Header-Font-Family: var(--Set-Font-Family-Header);
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: var(--Set-Font-Family-Decorative);
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}

[data-device="IOS-Mobile"][data-fonts="Default"] {
  --Body-Font-Family: "SF Pro";
  --Header-Font-Family: "SF Pro";
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: "SF Pro";
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-device="IOS-Tablet"][data-fonts="Default"] {
  --Body-Font-Family: "SF Pro";
  --Header-Font-Family: "SF Pro";
  --Header-Font-Weight: var(--Set-Font-Family-Header-Weight);
  --Decorative-Font-Family: "SF Pro";
  --Decorative-Font-Weight: var(--Set-Font-Family-Decorative-Weight);
  --Body-Font-Weight: var(--Set-Font-Family-Body-Weight);
  --Body-Semibold-Font-Weight: var(--Set-Font-Family-Body-Semibold-Weight);
  --Body-Bold-Font-Weight: var(--Set-Font-Family-Body-Bold-Weight);
}
[data-device="Android"][data-fonts="Default"] {
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
  --Margin: ${DEVICE_MARGIN['Desktop']}px;
${overlayWidthCSS('Desktop').join('\n')}
  --Columns: ${DEVICE_COLUMNS['Desktop']};
  --Gutter: ${DEVICE_GUTTER['Desktop']}px;
${gridCSS('  ').join('\n')}
  --Container-Padding: var(--Sizing-4);
  --Platform-Label: "Desktop";
  --Button-Height: 32px;
  --Min-Button-Width: 80px;
  --Set-Font-Family-Header: '${resolvedFaces.header.family}', sans-serif;
  --Set-Font-Family-Header-Weight: ${resolvedFaces.header.weight};
  --Set-Header-Text-Transform: ${headerAllCaps};
  --Set-Header-Letter-Spacing: ${headerLetterSpacing};
  /* The four faces. Display is the expressive pick, Eyebrow is the OS UI stack
     unless a design overrides it, Header is always the Flex face. */
  --Set-Font-Family-Display: '${decorativeFamily}', sans-serif;
  --Set-Font-Family-Eyebrow: ${SYSTEM_UI_STACK};
  /* Kept so designs saved before the four faces still resolve. */
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
  /* Per-style ramp — generated from the same type scale that produces
     typography-tokens.css, so a consumer that never sets data-device gets
     the identical Desktop values. Editing sizes here is wrong; edit
     src/utils/typeScale.ts. */
${typographyDeclarations(input.typographyStyles)}
  --Label-Font-Size: 14px;
  --Label-Line-Height: 20px;
  --Label-Letter-Spacing: 0px;
  --Label-Paragraph-Spacing: 4px;
  --Button-Font-Size: 16px;
  --Button-Line-Height: 20px;
  /* Bevel geometry for ALL THREE sizes — derived from THIS platform's button
     heights, which is why it lives beside them rather than in foundation.css.
     Each [data-device] block below re-emits all three for its own heights.
     It used to re-emit the MEDIUM set only, so a small or large button wore
     Desktop's bevel on every platform. */
${platformBevelCSS('Desktop', bevelHeights, bevelPercent)}
  /* Hit target. The SMALL button keeps its visual size on every platform; the
     lib wraps it in a box that grows to --Target using --Platform-Spacer, so
     the button looks identical while the tappable area meets the platform
     minimum. */
  --Target: ${PLATFORM_TARGET.Desktop}px;
  --Platform-Spacer: ${PLATFORM_SPACER.Desktop}px;
  /* Floating overlays. Desktop reserves no system chrome, so these are the
     clearance alone — stated rather than left to fall back, because an unset
     custom property paints nothing and reports nothing. */
${overlayOffsetCSS('Desktop').slice(1).join('\n')}
}

/* iOS Mobile */
[data-device="IOS-Mobile"] {
  --Margin: ${DEVICE_MARGIN['IOS-Mobile']}px;
${overlayWidthCSS('IOS-Mobile').join('\n')}
  --Columns: ${DEVICE_COLUMNS['IOS-Mobile']};
  --Gutter: ${DEVICE_GUTTER['IOS-Mobile']}px;
  --Container-Padding: var(--Sizing-2);
  --Platform-Label: "IOS-Mobile";
  --Button-Height: ${platformButtonHeight('IOS-Mobile', buttonHeight)}px;
  --Min-Stack-Gap: 10px;
${platformBevelCSS('IOS-Mobile', bevelHeights, bevelPercent)}
  --Target: ${PLATFORM_TARGET['IOS-Mobile']}px;
  --Platform-Spacer: ${PLATFORM_SPACER['IOS-Mobile']}px;
${overlayOffsetCSS('IOS-Mobile').join('\n')}
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
[data-device="IOS-Tablet"] {
  --Margin: ${DEVICE_MARGIN['IOS-Tablet-Vertical']}px;
${overlayWidthCSS('IOS-Tablet-Vertical').join('\n')}
  --Columns: ${DEVICE_COLUMNS['IOS-Tablet-Vertical']};
  --Gutter: ${DEVICE_GUTTER['IOS-Tablet-Vertical']}px;
  --Container-Padding: var(--Sizing-3);
  --Platform-Label: "IOS-Tablet";
  --Button-Height: ${platformButtonHeight('IOS-Tablet', buttonHeight)}px;
  --Min-Stack-Gap: 10px;
${platformBevelCSS('IOS-Tablet', bevelHeights, bevelPercent)}
  --Target: ${PLATFORM_TARGET['IOS-Tablet']}px;
  --Platform-Spacer: ${PLATFORM_SPACER['IOS-Tablet']}px;
${overlayOffsetCSS('IOS-Tablet').join('\n')}
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

/* Android, a block each.
   Android-Tablet and Android-Mobile carry identical METRICS — Figma gives
   both a 48px button and a 12px spacer — so these two blocks hold the same
   values. They are written separately rather than sharing a selector list
   because every other platform has a block of its own, and a reader checking
   "is this platform covered" should find one answer in one shape. The two
   exist as separate devices because TYPOGRAPHY differs between them. */
/* Android tablet */
[data-device="Android-Tablet"] {
  --Margin: ${DEVICE_MARGIN['Android-Tablet-Vertical']}px;
${overlayWidthCSS('Android-Tablet-Vertical').join('\n')}
  --Columns: ${DEVICE_COLUMNS['Android-Tablet-Vertical']};
  --Gutter: ${DEVICE_GUTTER['Android-Tablet-Vertical']}px;
  --Container-Padding: var(--Sizing-2);
  --Platform-Label: "Android";
  --Button-Height: ${platformButtonHeight('Android-Tablet', buttonHeight)}px;
  --Min-Stack-Gap: 12px;
${platformBevelCSS('Android-Tablet', bevelHeights, bevelPercent)}
  --Target: ${PLATFORM_TARGET['Android-Tablet']}px;
  --Platform-Spacer: ${PLATFORM_SPACER['Android-Tablet']}px;
${overlayOffsetCSS('Android-Tablet').join('\n')}
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

/* Android phone */
[data-device="Android-Mobile"] {
  --Margin: ${DEVICE_MARGIN['Android-Mobile']}px;
${overlayWidthCSS('Android-Mobile').join('\n')}
  --Columns: ${DEVICE_COLUMNS['Android-Mobile']};
  --Gutter: ${DEVICE_GUTTER['Android-Mobile']}px;
  --Container-Padding: var(--Sizing-2);
  --Platform-Label: "Android";
  --Button-Height: ${platformButtonHeight('Android-Mobile', buttonHeight)}px;
  --Min-Stack-Gap: 12px;
${platformBevelCSS('Android-Mobile', bevelHeights, bevelPercent)}
  --Target: ${PLATFORM_TARGET['Android-Mobile']}px;
  --Platform-Spacer: ${PLATFORM_SPACER['Android-Mobile']}px;
${overlayOffsetCSS('Android-Mobile').join('\n')}
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
/* In decorative mode, eyebrows swap onto the Display face. Re-pointing the
   face token is all it takes — every style wearing that face follows, because
   each one's --<style>-Font-Family is relative to it. */

[data-surface="Surface"] [data-decorative],
[data-surface="Surface-Dim"] [data-decorative],
[data-surface="Surface-Dimmest"] [data-decorative],
[data-surface="Surface-Bright"] [data-decorative] {
  --Font-Family-Header: var(--Set-Font-Family-Header);
  --Font-Family-Header-Weight: var(--Set-Font-Family-Header-Weight);
  --Font-Family-Eyebrow: var(--Font-Family-Display);
}

/* Explicit decorative variants — always available regardless of mode */
[data-typography="decorative-header"] {
  font-family: var(--Font-Family-Header);
  font-weight: var(--Set-Font-Family-Header-Weight);
}
[data-typography="decorative-overline"] {
  font-family: var(--Font-Family-Display);
}

`;

  // Button bevel is implemented entirely inside the consumer's Button
  // component (reads --Button-Bevel, per-variant Highlight/Lowlight, and
  // the size-specific height token), so styles.css stays empty of button
  // overrides — adding any would win on specificity and break Button.js.
  const stylesCSS = `/* Overrides */\n`;

  // 6. Build typography-tokens.css — the Desktop ramp is generated from the
  //    user's chosen faces; the other three platforms pass through unchanged.
  const { buildTypographyTokensCSS } = await import('./typographyTokens');
  const typographyTokensCSS = buildTypographyTokensCSS(input.typographyStyles);

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
        const figmaPayload = generateFigmaJSON(designSystemJSON, typographyTokensCSS);
        /* What the plugin is about to be handed, by collection. Without this
           the only way to tell "the export omitted it" from "the plugin
           ignored it" is to open the uploaded file by hand — and those two
           have completely different fixes. */
        /* warn, not log: Vite's dev server forwards console.warn and
           console.error to the terminal but NOT console.log, so a diagnostic
           written with log() is invisible to anyone reading the server output
           — which is most of the value of having it. */
        console.warn('📦 [figma.json] collections:',
          Object.keys(figmaPayload).map((k) => {
            const v = (figmaPayload as Record<string, unknown>)[k];
            const n = v && typeof v === 'object' ? Object.keys(v as object).length : 0;
            return `${k}(${n})`;
          }).join(' '));
        // Metadata that the Figma plugin reads to detect updates since its
        // last import. version is monotonic; lastModified is ISO 8601.
        figmaPayload.Metadata = {
          ...(figmaPayload.Metadata || {}),
          dinoId: uuid,
          version: input.version ?? 1,
          lastModified: new Date().toISOString(),
          name: input.designSystemName,
          /* The plugin points Buttons › Outline-Text / Outline-Quiet at the
             surface's own Text / Quiet under Black & White text, and at the
             button's palette under Tonal — the rule outlineFor applies in CSS. */
          textColoring: (input.userSelections as { textColoring?: string } | undefined)?.textColoring ?? 'tonal',
        };
        return JSON.stringify(figmaPayload, null, 2);
      } catch (e) { console.error('❌ figma.json generation failed:', e); return '{}'; }
    })(), type: 'application/json' },
    { name: 'DINO-TOKENS.md', content: buildDesignSystemDoc({
      uuid,
      themeUrl: getPublicFileUrl(uuid, 'theme.json'),
      designSystemName: input.designSystemName,
      colors: input.colorScheme.colors,
      userSelections: input.userSelections,
      componentStyle: input.componentStyle,
    }), type: 'text/markdown' },
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

  /* Every CSS file carries the font imports, not just base + the mode sheets.
   *
   * A consumer picks which files to load, and the imports only lived in
   * base.css / Light-Mode.css / Dark-Mode.css. An app loading, say, foundation
   * + core got the whole token system and NOT ONE FACE — --Font-Family-Display
   * resolved to a real family that nothing had fetched, so the browser
   * substituted silently. That is what happened in a real consumer: two sheets
   * loaded, zero Google requests, Display resolving to 'Raleway' and rendering
   * as something else.
   *
   * Duplicating the @import lines is deliberate and cheap: identical URLs are
   * deduped by the browser, so N files cost one request. The alternative —
   * documenting "you must also load base.css" — is a rule consumers cannot see
   * themselves breaking.
   *
   * @import must precede every other rule in a sheet, so these go at the very
   * top, ahead of the leading comment block. */
  const fontImportBlock = (() => {
    const withImports = uploadFiles.find(f => f.name === 'base.css')?.content ?? '';
    const lines = withImports.split('\n').filter(l => l.trim().startsWith('@import'));
    return lines.join('\n');
  })();
  if (fontImportBlock) {
    for (const file of uploadFiles) {
      if (!file.name.endsWith('.css')) continue;
      if (file.content.includes('@import')) continue;   // base + the mode sheets
      file.content = `${fontImportBlock}\n\n${file.content}`;
    }
    console.log(`Font imports added to every CSS file (${fontImportBlock.split('\n').length} families)`);
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

      // hero.png — the best landscape photograph FROM the board, not the board.
      //
      // A moodboard is a grid of panels on a flat ground, so using it whole as a
      // hero shows gaps, background and type specimens. extractHeroImage finds
      // the panels, scores which are photographs, and crops the best landscape
      // one. Saved alongside rather than replacing the board: the board is still
      // the portrait of the system, this is the one image out of it.
      //
      // Best-effort. A failure here must not fail the export — the design system
      // is complete without a hero, and every consumer already treats the file
      // as optional.
      try {
        const heroSourceUrl = URL.createObjectURL(blob);
        try {
          const hero = await extractHeroImage(heroSourceUrl);
          const heroBlob = await (await fetch(hero.dataUrl)).blob();
          await uploadDesignSystemFile(uuid, 'hero.png', heroBlob, 'image/png');
          console.log(
            `Hero image uploaded (${(heroBlob.size / 1024).toFixed(0)}KB, `
            + `${hero.crop.w}x${hero.crop.h}`
            + (hero.fellBack
              ? ', no panels found — cropped the whole board'
              : `, best of ${hero.candidates.length} panels at ${(hero.candidates[0].score * 100).toFixed(0)}%`)
            + ')',
          );
        } finally {
          URL.revokeObjectURL(heroSourceUrl);
        }
      } catch (e) {
        console.warn('Hero image skipped:', e);
      }
    } catch (e) {
      console.error('Mood board upload error:', e);
    }
  }

  // 8. Upload all files to Firebase Storage — with the header font request
  //    narrowed to the axis values this system pins (~1 MB → ~130 KB).
  const { pinHeaderFontImport } = await import('./moodAxes');
  for (const file of uploadFiles) {
    if (file.type === 'text/css') file.content = pinHeaderFontImport(file.content, typographyTokensCSS);
  }
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
