/**
 * Target Size (Minimum) report — WCAG 2.2 AA, Success Criterion 2.5.8.
 * Minimum target size for pointer input is 24x24 CSS pixels.
 *
 * Two data sources:
 *  - Configurable: button heights per platform, pulled from tokens.json's
 *    Platform.{Platform}.Button-Height.
 *  - Library defaults: intrinsic component sizes set inside @omni-design/components
 *    that aren't individually tokenized. These rows are informational —
 *    the report flags whether the default meets 24x24 so designers can
 *    confirm they haven't customized below it.
 */

const WCAG_22_AA_MIN = 24; // px, each dimension

export interface TargetCheck {
  component: string;            // "Button · Small", "Switch", etc.
  context?: string;             // platform or size qualifier
  source: 'configurable' | 'library-default';
  width: number;                // in px
  height: number;               // in px
  passes: boolean;
  note?: string;                // e.g. "gap/margin ensures separation"
}

export interface TargetSection {
  title: string;                // component family, e.g. "Buttons"
  checks: TargetCheck[];
}

function passes(w: number, h: number) {
  return w >= WCAG_22_AA_MIN && h >= WCAG_22_AA_MIN;
}

function parsePx(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getPlatformButtonHeight(tokens: any, platform: string): number {
  return parsePx(tokens?.Platform?.[platform]?.['Button-Height']?.value);
}

export function buildTargetAreaReport(tokens: any): TargetSection[] {
  const sections: TargetSection[] = [];

  // ── Buttons — per platform × size ────────────────────────────────────
  // The platform Button-Height is the medium size; small/large are library
  // defaults multiplied from medium. These match Button.js's SIZE_HEIGHT map.
  const buttonRows: TargetCheck[] = [];
  for (const platform of ['Desktop', 'IOS-Mobile', 'IOS-Tablet', 'Android']) {
    const medium = getPlatformButtonHeight(tokens, platform) || 32;
    const label = platform.replace('IOS-', 'iOS ');
    // Small = 24 (library minimum), Medium = platform value, Large = 56 default
    buttonRows.push({
      component: `Button · Small`, context: label, source: 'library-default',
      width: 24, height: 24, passes: passes(24, 24),
    });
    buttonRows.push({
      component: `Button · Medium`, context: label, source: 'configurable',
      width: medium, height: medium, passes: passes(medium, medium),
    });
    buttonRows.push({
      component: `Button · Large`, context: label, source: 'library-default',
      width: 56, height: 56, passes: passes(56, 56),
    });
  }
  sections.push({ title: 'Buttons (all sizes × platform)', checks: buttonRows });

  // ── Links & DinoStack ───────────────────────────────────────────────
  // Inline links inherit line-height; the library's Body default line-height
  // is ~24px, which meets the minimum as long as the text size isn't reduced.
  // DinoStack introduces gap between adjacent interactive targets so each
  // qualifies independently under 2.5.8.
  sections.push({
    title: 'Links + DinoStack',
    checks: [
      { component: 'Inline Link (Body line-height)', source: 'library-default',
        width: 24, height: 24, passes: true,
        note: 'Relies on body line-height ≥ 24px; ensure text is not shrunk below 16px' },
      { component: 'DinoStack (inter-link spacing)', source: 'library-default',
        width: 24, height: 24, passes: true,
        note: 'Adds gap between links so each target is independently 24×24; see 2.5.8 "Spacing" exception' },
    ],
  });

  // ── Switch ──────────────────────────────────────────────────────────
  sections.push({
    title: 'Switch',
    checks: [
      { component: 'Switch (thumb + track)', source: 'library-default',
        width: 48, height: 24, passes: passes(48, 24) },
    ],
  });

  // ── Slider Handle ───────────────────────────────────────────────────
  sections.push({
    title: 'Slider Handle',
    checks: [
      { component: 'Slider Thumb', source: 'library-default',
        width: 24, height: 24, passes: passes(24, 24) },
    ],
  });

  // ── Radio & Checkbox ────────────────────────────────────────────────
  // All sizes use a 24×24 parent container as the interactive target area,
  // so pointer events meet 2.5.8 even when the inner control (Small = 20px
  // glyph) is used without a label.
  const radioCheckRows: TargetCheck[] = [];
  for (const size of [
    { label: 'Small',  glyph: 20, target: 24,
      note: 'Parent container padded to 24×24 to meet 2.5.8; inner glyph 20px' },
    { label: 'Medium', glyph: 24, target: 24 },
    { label: 'Large',  glyph: 28, target: 28 },
  ]) {
    radioCheckRows.push({
      component: `Radio · ${size.label}`, source: 'library-default',
      width: size.target, height: size.target, passes: passes(size.target, size.target),
      ...(size.note ? { note: size.note } : {}),
    });
    radioCheckRows.push({
      component: `Checkbox · ${size.label}`, source: 'library-default',
      width: size.target, height: size.target, passes: passes(size.target, size.target),
      ...(size.note ? { note: size.note } : {}),
    });
  }
  radioCheckRows.push({
    component: 'DinoStack (Radio/Checkbox group)', source: 'library-default',
    width: 24, height: 24, passes: true,
    note: 'Enforces row gap so adjacent controls clear 2.5.8 spacing',
  });
  sections.push({ title: 'Radio + Checkbox (all sizes)', checks: radioCheckRows });

  // ── Rating Star ─────────────────────────────────────────────────────
  sections.push({
    title: 'Rating Star',
    checks: [
      { component: 'Star icon (tap area)', source: 'library-default',
        width: 24, height: 24, passes: passes(24, 24) },
      { component: 'Gap between stars', source: 'library-default',
        width: 24, height: 24, passes: true,
        note: 'Gap sized so each star qualifies as independent 24×24 target' },
      { component: 'Margin around component', source: 'library-default',
        width: 24, height: 24, passes: true,
        note: 'Component margin prevents adjacent-target collision' },
    ],
  });

  // ── Pagination ──────────────────────────────────────────────────────
  sections.push({
    title: 'Pagination',
    checks: [
      { component: 'Page button', source: 'library-default',
        width: 32, height: 32, passes: passes(32, 32) },
      { component: 'Next / Prev', source: 'library-default',
        width: 32, height: 32, passes: passes(32, 32) },
    ],
  });

  // ── Stepper ─────────────────────────────────────────────────────────
  sections.push({
    title: 'Stepper',
    checks: [
      { component: 'Step indicator', source: 'library-default',
        width: 32, height: 32, passes: passes(32, 32) },
      { component: 'Connector (non-interactive)', source: 'library-default',
        width: 24, height: 24, passes: true,
        note: 'Decorative; 2.5.8 does not apply to non-interactive regions' },
    ],
  });

  // ── Speed Dial ──────────────────────────────────────────────────────
  sections.push({
    title: 'Speed Dial',
    checks: [
      { component: 'FAB (main)', source: 'library-default',
        width: 56, height: 56, passes: passes(56, 56) },
      { component: 'Child actions', source: 'library-default',
        width: 40, height: 40, passes: passes(40, 40) },
    ],
  });

  // ── Tabs ────────────────────────────────────────────────────────────
  sections.push({
    title: 'Tabs',
    checks: [
      { component: 'Tab (text)', source: 'library-default',
        width: 48, height: 48, passes: passes(48, 48) },
      { component: 'Tab (icon)', source: 'library-default',
        width: 48, height: 48, passes: passes(48, 48) },
    ],
  });

  // ── Breadcrumbs ─────────────────────────────────────────────────────
  sections.push({
    title: 'Breadcrumbs',
    checks: [
      { component: 'Crumb link', source: 'library-default',
        width: 24, height: 24, passes: passes(24, 24),
        note: 'Relies on line-height; confirm ≥24px at current body size' },
      { component: 'Separator (non-interactive)', source: 'library-default',
        width: 24, height: 24, passes: true,
        note: 'Decorative; 2.5.8 does not apply' },
    ],
  });

  // ── Dropdown Lists ──────────────────────────────────────────────────
  sections.push({
    title: 'Dropdown Lists',
    checks: [
      { component: 'Menu item', source: 'library-default',
        width: 40, height: 40, passes: passes(40, 40) },
      { component: 'Select trigger', source: 'library-default',
        width: 32, height: 32, passes: passes(32, 32) },
    ],
  });

  return sections;
}

export const TARGET_AREA_MIN = WCAG_22_AA_MIN;
