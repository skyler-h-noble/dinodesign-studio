// TypeRoles — the four role panels and the pinned specimen, ported from
// omni-type-studio's RoleAccordions.jsx + Preview.jsx.
//
// This replaces the trio cards. A trio asked "which of these three-font sets do
// you want?", which is the wrong question once the Header stopped being a
// picked family: there are only two faces to choose (Display and Body), and the
// Header is dialled in on its axes. So the panel is per ROLE, each with its own
// controls, and one specimen stays visible beside them.
//
// Roles in the order omni shows them — Display first because it is the decision
// everything else is set against.

import { Body, Caption, Card, Checkbox, Button, Link, VStack, HStack, Slider, Divider } from '@dynodesign/components';
import { AXES, HEADER_FAMILY, type AxisValues } from '../../utils/moodAxes';
import type { FontMatchState } from '../../hooks/useFontMatch';
import type { FontScore } from '../../utils/fontMatch';
import { FontChip } from './FontChip';
import { italicAvailability } from '../../utils/googleFontsManager';
import { NOISE_FILTER_ID, noiseParams, bounceChars, SYSTEM_UI_STACK, displayLeadingFor, displayLineHeight } from '../../utils/typeScale';

export type TextCase = 'normal' | 'uppercase';
export type BodyBranch = 'sans' | 'serif';

export interface DisplayRole {
  family: string;
  category: string;
  /** Leading ratio for the Display ramp. Every computed line height still
   *  snaps to the 4px grid, so the rhythm survives whatever is chosen. */
  leading: number;
  /** Display-Large's size in px. Medium and Small scale from it, and every
   *  computed line height re-lands on the 4px grid. Reaches the CSS and Figma
   *  exports, not just the preview. */
  size: number;
  weight: string;
  letterSpacing: string;
  allCaps: boolean;
  /** Render the Display in its italic face. Only meaningful when the family
   *  ships one — Figma has no synthetic oblique, and on the web a synthesised
   *  one shears a script face that is already cursive. Gated on availability. */
  italic?: boolean;
  /** 0–100 grain. A font file can't be roughened, so it renders as SVG turbulence. */
  noise: number;
  /** 0–100 hand-lettering rise and fall. Web only — see the note in the panel. */
  bounce: number;
  /** What the matcher measured off the image, shown next to the control it
   *  explains rather than in a separate report. */
  detectedWeight?: string;
  detectedAllCaps?: boolean;
}

export interface HeaderRole {
  axes: AxisValues;
  letterSpacing: string;
  allCaps: boolean;
  /** Why the axes landed where they did — omni shows this so the
   *  recommendation reads as a decision rather than magic. */
  rationale: string;
}

export interface EyebrowRole {
  weight: string;
  letterSpacing: string;
}

export interface BodyRole {
  family: string;
  branch: BodyBranch;
}

export interface TypeSystem {
  display: DisplayRole;
  header: HeaderRole;
  eyebrow: EyebrowRole;
  body: BodyRole;
}

/** One selectable font, grouped under its category. */
export interface FontChoice {
  family: string;
  category: string;
  label: string;
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

const emToNum = (v: string) => parseFloat(String(v)) || 0;

const fallbackFor = (family: string, branch?: string) =>
  branch === 'serif' ? 'serif'
    : /script|hand|caveat|sacramento|dancing/i.test(family) ? 'cursive'
      : 'sans-serif';

/** Axes → font-variation-settings. wght is omitted — font-weight carries it. */
const axesToCss = (axes: AxisValues) =>
  Object.entries(axes).filter(([t]) => t !== 'wght').map(([t, v]) => `"${t}" ${v}`).join(', ');

/** The hidden SVG that generates the Display grain. A font file can't be
 *  roughened, so the effect has to be a filter over the rendered glyphs. */
export function NoiseFilter({ noise }: { noise: number }) {
  if (!noise) return null;
  const { scale, baseFrequency } = noiseParams(noise);
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <filter id={NOISE_FILTER_ID}>
        <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={3} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale}
          xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/** Per-character rise and fall. Every glyph in a face is identical, so the
 *  variation has to live on individual characters — which needs one element
 *  each. Offsets are fixed, not random, so it looks the same on every render. */
export function BouncyText({ text, amount }: { text: string; amount: number }) {
  if (!amount) return <>{text}</>;
  const chars = bounceChars(text.length, amount);
  return (
    <>
      {[...text].map((c, i) => c === ' ' ? ' ' : (
        <span
          key={i}
          style={{
            display: 'inline-block',
            transformOrigin: '50% 60%',
            transform: `translateY(${chars[i].dy}em) rotate(${chars[i].rot}deg) scale(${chars[i].scale})`,
          }}
        >
          {c}
        </span>
      ))}
    </>
  );
}

/** Inline style for one role, so the specimen and the panel previews agree. */
function roleCss(role: 'Display' | 'Header' | 'Eyebrow' | 'Body', sys: TypeSystem, fontSize: number): React.CSSProperties {
  if (role === 'Header') {
    return {
      fontFamily: `"${HEADER_FAMILY}", sans-serif`,
      fontVariationSettings: axesToCss(sys.header.axes),
      fontWeight: sys.header.axes.wght,
      fontSize,
      lineHeight: 1.2,
      letterSpacing: sys.header.letterSpacing,
      textTransform: sys.header.allCaps ? 'uppercase' : 'none',
      color: 'var(--Header)',
    };
  }
  if (role === 'Eyebrow') {
    return {
      fontFamily: SYSTEM_UI_STACK,
      fontSize,
      lineHeight: 1.5,
      fontWeight: Number(sys.eyebrow.weight),
      letterSpacing: sys.eyebrow.letterSpacing,
      textTransform: 'uppercase',
      color: 'var(--Quiet)',
    };
  }
  if (role === 'Body') {
    return {
      fontFamily: `"${sys.body.family}", ${fallbackFor(sys.body.family, sys.body.branch)}`,
      fontSize,
      lineHeight: 1.5,
      color: 'var(--Text)',
    };
  }
  const d = sys.display;
  return {
    fontFamily: `"${d.family}", ${fallbackFor(d.family)}`,
    fontSize,
    fontWeight: Number(d.weight),
    lineHeight: 1.1,
    letterSpacing: d.letterSpacing,
    textTransform: d.allCaps ? 'uppercase' : 'none',
    color: 'var(--Header)',
    ...(d.noise > 0 ? { filter: `url(#${NOISE_FILTER_ID})` } : {}),
  };
}

// ─── Controls ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <VStack spacing={0} style={{ width: '100%' }}>
      <Caption color="quiet">{label}</Caption>
      {children}
    </VStack>
  );
}

function RangeField({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        size="small"
        aria-label={label}
        onChange={(_e: unknown, v: number | number[]) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </Field>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The top of the ranking, pulled out above the pool. Everything it shows is
 * measured locally from the crop — stroke fingerprint and ink overlay — so a
 * ranking can be argued with rather than taken on faith.
 */
/** True when Italic is on AND this family is known to lack one. Unknown
 *  families (cache cold, or absent from it) are NOT disabled — an italic gate
 *  reading an empty cache would grey out every font, which looks like a bug
 *  rather than a limit. */
function italicBlocks(family: string, italicOn: boolean | undefined): boolean {
  if (!italicOn) return false;
  const avail = italicAvailability();
  if (!avail) return false;
  return avail.get(family) === false;
}

function ClosestMatches({
  match, current, categoryOf, onApply, italicOn,
}: {
  match: FontMatchState;
  current: string;
  categoryOf: Record<string, string>;
  onApply: (family: string, category: string) => void;
  /** When on, families with no italic render disabled rather than vanishing. */
  italicOn?: boolean;
}) {
  if (match.status === 'working') {
    return (
      <VStack spacing={1} style={{ width: '100%' }}>
        <Caption color="quiet">Closest to your image</Caption>
        <Caption color="quiet">Measuring the suggestions against the crop…</Caption>
      </VStack>
    );
  }
  if (match.status !== 'done' || match.ranked.length === 0) return null;

  return (
    <Card padding="small">
      <VStack spacing={1} style={{ width: '100%' }}>
        <Caption color="quiet">Closest to your image</Caption>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, width: '100%' }}>
          {match.ranked.slice(0, 3).map((m) => (
            <FontChip
              key={m.family}
              preview={<span style={{ fontFamily: `"${m.family}", sans-serif` }}>Ag</span>}
              label={m.family}
              meta={pct(m.score)}
              best={m.rank === 0}
              selected={m.family === current}
              disabled={italicBlocks(m.family, italicOn)}
              title={`${m.family} — ${pct(m.score)} match${m.metric != null ? ` · strokes ${pct(m.metric)}` : ''}${m.overlay != null ? ` · shape ${pct(m.overlay)}` : ''}`}
              onClick={() => onApply(m.family, categoryOf[m.family] ?? '')}
            />
          ))}
        </div>
        <Caption color="quiet">Applied to the Display — pick any other to override.</Caption>
      </VStack>
    </Card>
  );
}

/** Grouped font chips. Each chip shows the family set in itself, so the choice
 *  is made by looking rather than by reading a name. */
function FontGroups({
  choices, current, onApply, scores,
}: {
  choices: FontChoice[];
  current: string;
  onApply: (family: string, category: string) => void;
  /** Local match scores, when they have been measured. */
  scores?: Record<string, FontScore>;
}) {
  const groups: { category: string; items: FontChoice[] }[] = [];
  for (const c of choices) {
    const g = groups.find((x) => x.category === c.category);
    if (g) g.items.push(c); else groups.push({ category: c.category, items: [c] });
  }
  if (!groups.length) return null;

  return (
    <VStack spacing={2} style={{ width: '100%' }}>
      {groups.map((g) => (
        <VStack key={g.category} spacing={1} style={{ width: '100%' }}>
          <Caption color="quiet">{g.category}</Caption>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, width: '100%' }}>
            {g.items.map((c) => (
              <FontChip
                key={`${c.category}-${c.family}-${c.label}`}
                preview={<span style={{ fontFamily: `"${c.family}", sans-serif` }}>Ag</span>}
                label={c.family}
                meta={scores?.[c.family] ? pct(scores[c.family].score) : undefined}
                best={scores?.[c.family]?.rank === 0}
                selected={c.family === current}
                title={`${c.family} — ${c.category}${scores?.[c.family] ? ` · ${pct(scores[c.family].score)} match` : ''}`}
                onClick={() => onApply(c.family, c.category)}
              />
            ))}
          </div>
        </VStack>
      ))}
    </VStack>
  );
}

/** Header axis presets. Google Sans Flex only, so they live with the Header. */
function HeaderPresets({
  presets, current, onApply,
}: {
  presets: { label: string; group: string; axes: AxisValues }[];
  current: AxisValues;
  onApply: (axes: AxisValues) => void;
}) {
  const groups: { group: string; items: typeof presets }[] = [];
  for (const p of presets) {
    const g = groups.find((x) => x.group === p.group);
    if (g) g.items.push(p); else groups.push({ group: p.group, items: [p] });
  }
  const currentCss = axesToCss(current);
  if (!groups.length) return null;

  return (
    <VStack spacing={2} style={{ width: '100%' }}>
      {groups.map((g) => (
        <VStack key={g.group} spacing={1} style={{ width: '100%' }}>
          <Caption color="quiet">{g.group}</Caption>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, width: '100%' }}>
            {g.items.map((p) => (
              <FontChip
                key={p.label}
                preview={<span style={{
                  fontFamily: `"${HEADER_FAMILY}", sans-serif`,
                  fontVariationSettings: axesToCss(p.axes),
                  fontWeight: p.axes.wght,
                }}>Ag</span>}
                label={p.label}
                selected={axesToCss(p.axes) === currentCss}
                onClick={() => onApply(p.axes)}
              />
            ))}
          </div>
        </VStack>
      ))}
    </VStack>
  );
}

// ─── The role panels ─────────────────────────────────────────────────────────

/** One line on what each role is FOR, shown on the preview highlight so the
 *  connection between a panel and the text it moves is never a guess. */
const ROLE_TOOLTIPS: Record<string, string> = {
  Display: 'hero and section openers',
  Eyebrow: 'small label above a heading',
  Header: 'H1 through H6',
  Body: 'reading copy and UI text',
};

/** The usage rule for each role, shown at the top of its panel — the same text
 *  that travels into the Figma text-style description. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  Display: 'Only use in Header or Hero areas, not inside components.',
  Eyebrow: 'A small tracked label that sits above a heading.',
  Header: 'H1 through H6. Always Google Sans Flex, tuned against the Display.',
  Body: 'Reading copy and interface text.',
};

const ROLES = ['Display', 'Eyebrow', 'Header', 'Body'] as const;
export type RoleName = typeof ROLES[number];

export interface RolePanelsProps {
  system: TypeSystem;
  displayChoices: FontChoice[];
  bodyChoices: FontChoice[];
  /** Local ranking of the Display pool against the sampled crop. */
  match: FontMatchState;
  headerPresets: { label: string; group: string; axes: AxisValues }[];
  open: Set<RoleName>;
  onToggle: (role: RoleName) => void;
  advanced: boolean;
  onToggleAdvanced: () => void;
  onDisplayChange: (patch: Partial<DisplayRole>) => void;
  onDisplayFont: (family: string, category: string) => void;
  onHeaderAxis: (tag: string, value: number) => void;
  onHeaderAxes: (axes: AxisValues) => void;
  onHeaderChange: (patch: Partial<HeaderRole>) => void;
  onEyebrowChange: (patch: Partial<EyebrowRole>) => void;
  onBodyBranch: (branch: BodyBranch) => void;
  onBodyFont: (family: string, category: string) => void;
  /** Fires as the pointer or focus enters/leaves a panel, so the preview can
   *  outline the line that panel controls. */
  onActiveRole?: (role: RoleName | null) => void;
  /** Viewport offset a panel header stops at — below the top bar AND the
   *  sticky preview. 0 means "not measured yet", so the header stays in flow
   *  rather than sticking somewhere it would hide behind the preview. */
  stickTop?: number;
}

/**
 * What Italic costs, in families.
 *
 * Returns null-safe copy: when the Google Fonts cache has not resolved yet
 * italicAvailability() gives null, and saying "0 unavailable" then would be a
 * confident lie. Say it is still checking instead.
 */
function italicNote(match: FontMatchState | undefined): string {
  const avail = italicAvailability();
  if (!avail) return 'Checking which families ship an italic…';
  const families = match?.status === 'done' ? match.ranked.map(m => m.family) : [];
  if (!families.length) return 'Families without an italic are shown but cannot be picked.';
  const without = families.filter(f => avail.get(f) === false).length;
  if (!without) return 'Every suggested family ships an italic.';
  return `${without} of ${families.length} suggested families have no italic and are disabled.`;
}

export function RolePanels(p: RolePanelsProps) {
  const { system: s } = p;

  const summaryText = (role: RoleName) =>
    role === 'Display' ? <BouncyText text="Aa Gg" amount={s.display.bounce} />
      : role === 'Eyebrow' ? 'EYEBROW'
        : role === 'Body' ? 'Quick brown fox'
          : 'Aa Gg';

  return (
    // The four roles run side by side. Each column holds its own controls, so
    // an open Display panel doesn't push Header and Body off the screen the
    // way a stacked accordion group did.
    <>
      {ROLES.map((role) => {
        const isOpen = p.open.has(role);
        return (
          <div
            key={role}
            style={{ flex: '1 1 300px', minWidth: 280, maxWidth: 420 }}
            onMouseEnter={() => p.onActiveRole?.(role)}
            onMouseLeave={() => p.onActiveRole?.(null)}
            // Focus-within covers keyboard users, who never fire mouseenter.
            onFocusCapture={() => p.onActiveRole?.(role)}
            onBlurCapture={() => p.onActiveRole?.(null)}
          >
          <Card padding="medium">
            <VStack spacing={2}>
              {/* The lib Accordion renders none of its children while collapsed,
                  which is how a panel's controls can silently not exist. The
                  open state is ours so the panel body is always in the tree
                  when it should be. */}
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`role-panel-${role.toLowerCase()}`}
                onClick={() => p.onToggle(role)}
                // A plain button rather than the lib Accordion: that component
                // renders NONE of its children while collapsed, so a panel's
                // sliders can silently not exist in the DOM. Driving `open`
                // ourselves has no such failure mode.
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  // Sticks below the preview so the column keeps its label while
                  // you scroll a long chip list. z-index 1 — under the preview
                  // (2), so it slides beneath rather than over it.
                  //
                  // Until the preview has been measured this stays in normal
                  // flow: sticking at a guessed offset parks the header behind
                  // the preview, where it is invisible AND appears not to stick.
                  position: p.stickTop ? 'sticky' : 'static',
                  top: p.stickTop || undefined,
                  zIndex: 1,
                  // Opaque, and pulled out to the card's edges, so chips scroll
                  // under the header instead of through it.
                  background: 'var(--Background)',
                  margin: '-4px -16px 0',
                  padding: '4px 16px 8px',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* The toggle sits WITH the label it controls, not hugging the
                    card's right edge — at column width the two ended up an
                    inch apart with the specimen stranded between them. */}
                <Body style={{ fontWeight: 700, margin: 0, flexShrink: 0, lineHeight: 1 }}>{role}</Body>
                {/* The +/- sits on the SAME optical line as the label. As a
                    Caption it rendered at caption size with its own line-height,
                    so it read as a stray character floating beside the heading
                    rather than a control belonging to it. Fixed box, centred both
                    ways, and large enough to be an obvious target. */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    lineHeight: 1,
                    color: 'var(--Quiet)',
                  }}
                >
                  {isOpen ? '\u2212' : '+'}
                </span>
                <div style={{
                  ...roleCss(role, s, role === 'Body' ? 14 : 20),
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  textAlign: 'right',
                }}>
                  {summaryText(role)}
                </div>
              </button>

              {isOpen && (
                <div id={`role-panel-${role.toLowerCase()}`}>
                  <VStack spacing={2} style={{ width: '100%' }}>
                  <Divider />
                  {ROLE_DESCRIPTIONS[role] && (
                    <Caption color="quiet">{ROLE_DESCRIPTIONS[role]}</Caption>
                  )}

                  {role === 'Display' && (
                    <VStack spacing={2} style={{ width: '100%' }}>
                      <RangeField
                        label={`Size (${s.display.size}px)`}
                        value={s.display.size} min={32} max={120} step={4}
                        onChange={(v) => p.onDisplayChange({ size: v })}
                      />
                      <RangeField
                        label={`Weight (${s.display.weight})${s.display.detectedWeight ? ` · measured ${s.display.detectedWeight}` : ''}`}
                        value={Number(s.display.weight)} min={100} max={900} step={100}
                        onChange={(v) => p.onDisplayChange({ weight: String(v) })}
                      />
                      <RangeField
                        label={`Letter spacing (${s.display.letterSpacing})`}
                        value={emToNum(s.display.letterSpacing)} min={-0.08} max={0.3} step={0.005}
                        onChange={(v) => p.onDisplayChange({ letterSpacing: `${v}em` })}
                      />
                      {/* Line height is calculated, not set. It slides from 1.3
                          at 32px to 1.1 at 120px, because a ratio that reads as
                          comfortable on small type opens a gap on a hero — and
                          each of the three steps gets its own, rather than the
                          whole ramp sharing Large's. Shown, not offered. */}
                      <Caption color="quiet">
                        {`Line height ${displayLeadingFor(s.display.size).toFixed(2)} `
                          + `— ${displayLineHeight(s.display.size)}px, calculated from the size`}
                      </Caption>
                      <RangeField
                        label={`Noise / grain (${s.display.noise})`}
                        value={s.display.noise} min={0} max={100}
                        onChange={(v) => p.onDisplayChange({ noise: v })}
                      />
                      <RangeField
                        label={`Bounce — rise & fall (${s.display.bounce})`}
                        value={s.display.bounce} min={0} max={100}
                        onChange={(v) => p.onDisplayChange({ bounce: v })}
                      />
                      <Caption color="quiet">
                        <strong>Bounce is web only.</strong> A Figma text style applies one
                        setting to the whole run, so a per-character rise and fall can&apos;t be
                        reproduced there. It survives the CSS export, not the Figma one.
                      </Caption>
                      <Checkbox
                        checked={s.display.allCaps}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          p.onDisplayChange({ allCaps: e?.target?.checked ?? !s.display.allCaps })}
                        label="All caps"
                      />
                      <Checkbox
                        checked={!!s.display.italic}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          p.onDisplayChange({ italic: e?.target?.checked ?? !s.display.italic })}
                        label="Italic"
                      />
                      {/* Names the cost rather than quietly shrinking the list.
                          Families without an italic stay VISIBLE and disabled, so
                          the count and the greyed chips say the same thing. */}
                      {s.display.italic && (
                        <Caption color="quiet">
                          {italicNote(p.match)}
                        </Caption>
                      )}
                      <ClosestMatches
                        italicOn={s.display.italic}
                        match={p.match}
                        current={s.display.family}
                        categoryOf={Object.fromEntries(p.displayChoices.map((c) => [c.family, c.category]))}
                        onApply={p.onDisplayFont}
                      />
                      <FontGroups
                        choices={p.displayChoices}
                        current={s.display.family}
                        onApply={p.onDisplayFont}
                        scores={p.match.scores}
                      />
                    </VStack>
                  )}

                  {role === 'Eyebrow' && (
                    <VStack spacing={2} style={{ width: '100%' }}>
                      <RangeField
                        label={`Weight (${s.eyebrow.weight})`}
                        value={Number(s.eyebrow.weight)} min={100} max={900} step={100}
                        onChange={(v) => p.onEyebrowChange({ weight: String(v) })}
                      />
                      <RangeField
                        label={`Letter spacing (${s.eyebrow.letterSpacing})`}
                        value={emToNum(s.eyebrow.letterSpacing)} min={-0.02} max={0.3} step={0.01}
                        onChange={(v) => p.onEyebrowChange({ letterSpacing: `${v}em` })}
                      />
                      <Caption color="quiet">
                        Uses the OS UI font — nothing to download, and it always matches the
                        platform. Size and line height come from the Eyebrow scale.
                      </Caption>
                    </VStack>
                  )}

                  {role === 'Header' && (
                    <VStack spacing={2} style={{ width: '100%' }}>
                      <HeaderPresets presets={p.headerPresets} current={s.header.axes} onApply={p.onHeaderAxes} />
                      <Link onClick={p.onToggleAdvanced}>
                        {p.advanced ? 'Hide advanced settings' : 'Advanced settings'}
                      </Link>
                      {p.advanced && (
                        <Caption color="quiet">
                          The Header runs on <strong>Google Sans Flex</strong>, Material&apos;s
                          variable typeface. Six axes — weight, width, optical size, slant,
                          grade and roundness — cover everything from a thin wide headline to a
                          heavy condensed one in a single file, so the Header can be tuned
                          against your Display instead of swapping it for another font.
                        </Caption>
                      )}
                      {p.advanced && Object.entries(AXES).map(([tag, spec]) => (
                        <RangeField
                          key={tag}
                          label={`${spec.label} (${s.header.axes[tag]})`}
                          value={s.header.axes[tag]}
                          min={spec.min}
                          max={spec.max}
                          onChange={(v) => p.onHeaderAxis(tag, v)}
                        />
                      ))}
                      {/* Letter spacing is not an axis, so it sits outside the
                          axis loop and stays available without opening Advanced
                          — you reach for it while setting a headline. */}
                      <RangeField
                        label={`Letter spacing (${s.header.letterSpacing})`}
                        value={emToNum(s.header.letterSpacing)} min={-0.05} max={0.3} step={0.005}
                        onChange={(v) => p.onHeaderChange({ letterSpacing: `${v}em` })}
                      />
                      <Checkbox
                        checked={s.header.allCaps}
                        disabled={s.display.allCaps}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          p.onHeaderChange({ allCaps: e?.target?.checked ?? !s.header.allCaps })}
                        label="All caps"
                      />
                      {s.display.allCaps && (
                        <Caption color="quiet">
                          Off because the Display is set in caps. Two roles shouting at once read
                          as one voice — the Display is the loud one, so the Header stays in
                          sentence case.
                        </Caption>
                      )}
                      <Caption color="quiet">{s.header.rationale}</Caption>
                    </VStack>
                  )}

                  {role === 'Body' && (
                    <VStack spacing={2} style={{ width: '100%' }}>
                      <Field label="Style">
                        <HStack spacing={1}>
                          {([['sans', 'Sans serif'], ['serif', 'Serif']] as const).map(([b, label]) => (
                            <Button
                              key={b}
                              size="small"
                              variant={s.body.branch === b ? 'primary' : 'default-outline'}
                              onClick={() => p.onBodyBranch(b)}
                            >
                              {label}
                            </Button>
                          ))}
                        </HStack>
                      </Field>
                      <Caption color="quiet">
                        Size, weight and line height come from the Body scale — 14/16/18px in
                        Regular, Semibold and Bold, all at 1.5.
                      </Caption>
                      <FontGroups choices={p.bodyChoices} current={s.body.family} onApply={p.onBodyFont} />
                    </VStack>
                  )}
                  </VStack>
                </div>
              )}
            </VStack>
          </Card>
          </div>
        );
      })}
    </>
  );
}

// ─── The specimen ────────────────────────────────────────────────────────────

/**
 * The specimen shows the case the SETTING implies, not the case OCR happened to
 * read.
 *
 * The headline is the sampled lettering verbatim, so a moodboard whose words are
 * set in caps yields an all-caps string — which renders as caps even with All
 * caps off, because no transform is involved. The preview then contradicts the
 * checkbox sitting next to it. Folding a shouting string back to title case
 * makes the control honest in both positions.
 */
function casedHeadline(text: string, allCaps: boolean): string {
  if (allCaps) return text;
  const isShouting = text === text.toUpperCase() && /[A-Z]{2,}/.test(text);
  if (!isShouting) return text;
  return text.replace(/([A-Z])([A-Z]*)/g, (_m, head: string, tail: string) => head + tail.toLowerCase());
}

/**
 * The specimen, pinned above the panels so it stays visible while you work.
 *
 * When a role panel is being used, the line it controls is outlined and named —
 * the same idea as a browser inspector highlight. Without it the panels are
 * four boxes of sliders and you have to guess which text each one moves.
 */
export function TypeSpecimen({
  system, headline, activeRole, onHoverRole,
}: {
  system: TypeSystem;
  headline: string;
  /** The role currently being edited or hovered, outlined in the preview. */
  activeRole?: RoleName | null;
  /** Hovering a line in the preview highlights it from this side too. */
  onHoverRole?: (role: RoleName | null) => void;
}) {
  const line = (role: RoleName, size: number, children: React.ReactNode) => {
    const active = activeRole === role;
    return (
      <div
        onMouseEnter={() => onHoverRole?.(role)}
        onMouseLeave={() => onHoverRole?.(null)}
        style={{
          position: 'relative',
          // Outline rather than border so the highlight never reflows the text.
          outline: active ? '2px solid var(--Buttons-Primary-Button)' : '2px solid transparent',
          outlineOffset: 4,
          // Fixed 4px, NOT --Style-Border-Radius: this is inspector chrome, not
          // brand surface. On a playful brand that token is 100 and the
          // highlight wrapped the copy in a stadium.
          borderRadius: 4,
          transition: 'outline-color 120ms ease',
        }}
      >
        {active && (
          <span
            style={{
              position: 'absolute',
              bottom: -10,
              left: 0,
              transform: 'translateY(100%)',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--Buttons-Primary-Button)',
              color: 'var(--Buttons-Primary-Text)',
              fontFamily: SYSTEM_UI_STACK,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {role} — {ROLE_TOOLTIPS[role]}
          </span>
        )}
        <div style={roleCss(role, system, size)}>{children}</div>
      </div>
    );
  };

  return (
    // The Card's content box paints `padding: var(--Card-Padding)`, and the
    // size prop only moves gap and font size — so the specimen's own padding is
    // set by overriding that token locally. sx lands on the outer Box and the
    // variable inherits into the content box, which is the element that reads
    // it. A two-value padding is a legal custom-property value.
    <Card padding="medium" sx={{ '--Card-Padding': '32px 16px' }}>
      <VStack spacing={2}>
        {/* The real size, not a clamped one. This used to be
            `Math.min(size, 64)` to keep the sticky preview short, which meant
            the slider looked broken past 64 — the label counted up to 120 while
            the specimen sat still. A preview that lies about the size is worse
            than a tall preview; the region is measured with a ResizeObserver,
            so the panels below reflow to whatever height this comes out at. */}
        {line('Display', system.display.size, (
          <BouncyText
            text={casedHeadline(headline, system.display.allCaps)}
            amount={system.display.bounce}
          />
        ))}
        {line('Eyebrow', 12, 'Typography preview')}
        {line('Header', 32, 'A header that complements the display')}
        {line('Body', 16,
          'Body copy carries the reading. It pairs a calm, legible family with the '
          + 'expressive display and the variable Google Sans Flex header so the whole '
          + 'system feels like one voice — set from the mood and the lettering found '
          + 'in your image.')}
      </VStack>
    </Card>
  );
}
