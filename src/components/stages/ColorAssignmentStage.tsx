import {
  Button, H2, H3, Body, BodySmall, Overline, Divider, VStack, HStack, Card, ToggleButtonGroup, Select, Link, Modal, Checkbox,
} from '@omni-design/components';
import chroma from 'chroma-js';
import { resolveButtonChoice, type ButtonColor, type ButtonTone } from '../../utils/buttonChoice';
import { ButtonToneGrid } from '../ButtonToneGrid';
import ExpandMoreIcon from '@omni-design/icons/ExpandMore';
import ExpandLessIcon from '@omni-design/icons/ExpandLess';
import { useState, useRef } from 'react';
import { toneToColorNumber } from '../../utils/colorScale';
import {
  BACKGROUND_THEMES, BAR_THEMES, SURFACE_LEVELS, parseBackground, formatBackground,
  parseBar,
  legacyName, toneFor, type BackgroundSelection,
  barToneFor,
} from '../../utils/backgroundSelection';
import PhonePreview from '../PhonePreview';
import '../../styles/assign-colors.css';

import type { StageProps, UserSelections, ColorScheme, TypographyStyle } from '../../types';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  /** The picked faces. Without them the phone preview renders the Display in
   *  a fallback face — ReviewStage passed these and this stage did not, so the
   *  same system showed Anton on one screen and a plain sans on the other. */
  typographyStyles?: TypographyStyle[];
  onSelectionsChanged: (selections: UserSelections) => void;
  onColorsReordered: (colors: [string, string, string]) => void;
  userSelections: UserSelections;
  moodBoardUrl?: string | null;
  designSystemName?: string;
}

/** A bar's stored value: a legacy string, or 'Theme/Surface-Level'. */
type NavOption = string;
/* The Default button is a COLOR plus a TONE (utils/buttonChoice.ts). Tonal
   used to sit in this row as a fifth color; it is a tone, and Primary,
   Secondary and Laddered each take it. */
const BUTTON_MODES: { value: ButtonColor; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'match', label: 'Match' },
  { value: 'laddered', label: 'Laddered' },
  { value: 'black-white', label: 'Black/White' },
];

const BUTTON_TONES: { value: ButtonTone; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'tonal', label: 'Tonal' },
];

/** Short labels for the surface row. The stored names are long enough that
 *  five of them do not fit across the card. */
const SURFACE_LABEL: Record<string, string> = {
  'Surface-Dimmest': 'Dimmest',
  'Surface-Dim': 'Dim',
  'Surface': 'Base',
  'Surface-Bright': 'Bright',
  'Surface-Brightest': 'Brightest',
};

/**
 * Status, App and Nav bars: ANY theme at ANY surface level.
 *
 * The four strings this replaces could only say Primary or Neutral, so a
 * Secondary app bar over a Primary page was not expressible at all. A bar is a
 * band ON the page rather than the page itself, so an accent reads as intended
 * there — it has the background to sit against. (The BACKGROUND picker takes
 * the opposite view and stays Primary or Neutral; see backgroundSelection.ts.)
 */
const NAV_OPTIONS: { value: NavOption; label: string }[] =
  BAR_THEMES.flatMap(theme =>
    SURFACE_LEVELS.map(surface => ({
      value: `${theme}/${surface}`,
      label: `${theme} · ${SURFACE_LABEL[surface]}`,
    })),
  );

const CARD_OPTIONS = [
  { value: 'tonal' as const, label: 'Tonal' },
  { value: 'white' as const, label: 'White' },
  { value: 'black' as const, label: 'Black' },
];

const TEXT_OPTIONS = [
  { value: 'tonal' as const, label: 'Tonal' },
  { value: 'black-white' as const, label: 'Black & White' },
];

export default function ColorAssignmentStage({
  onNext,
  onBack,
  colorScheme,
  onSelectionsChanged,
  onColorsReordered,
  userSelections,
  moodBoardUrl,
  designSystemName,
  typographyStyles,
}: Props) {
  const [activeTab, setActiveTab] = useState<'preview' | 'customize'>('customize');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [showButtonInfo, setShowButtonInfo] = useState(false);
  const [showButtonAdvanced, setShowButtonAdvanced] = useState(Boolean(userSelections.buttonCellTones && Object.keys(userSelections.buttonCellTones).length));
  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];
  const palettes = colorScheme?.tonePalettes;
  const PC = toneToColorNumber(colorScheme?.extractedTones?.primary || 60);
  // Secondary and Tertiary anchor on their OWN core tone — a chromatic theme's
  // Surface level IS the brand color, so each ramp needs its own centre.
  const SC = toneToColorNumber(colorScheme?.extractedTones?.secondary || 60);
  const TC = toneToColorNumber(colorScheme?.extractedTones?.tertiary || 60);
  const mediumIndex = PC >= 11 ? 8 : 7;

  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // When on, Status / App / Navigation bars move together — changing one sets all.
  const [syncNav, setSyncNav] = useState<boolean>(
    () => userSelections.status === userSelections.appBar && userSelections.appBar === userSelections.navBar,
  );

  const buttonChoice = resolveButtonChoice(userSelections.button, userSelections.buttonTone);
  const update = (partial: Partial<UserSelections>) => {
    onSelectionsChanged({ ...userSelections, ...partial });
  };

  /** The page background, read back as theme + surface whichever form it was
   *  stored in. The four legacy strings resolve to the same tones they always
   *  did, so an existing system opens on the pair it was saved as. */
  const bgSelection = parseBackground(userSelections.background);

  /**
   * Write a background choice.
   *
   * Keeps storing the LEGACY string for the four combinations that have one, so
   * a system saved today still opens in an older build and the ~40 consumers
   * that branch on 'white' / 'black' / 'primary-base' / 'primary-light' keep
   * matching. The other sixteen store the `Theme/Surface` form, which every
   * consumer already handles through the backgroundTheme + backgroundN
   * fallback.
   */
  const setBackground = (sel: BackgroundSelection) => {
    update({
      background: legacyName(sel) ?? formatBackground(sel),
      backgroundTheme: sel.theme,
      backgroundN: toneFor(sel.theme, sel.surface, PC),
    });
  };

  // Resolve the current surface palette and Color-N for nav color previews
  // NonNullable, because `palettes` is colorScheme?.tonePalettes and the body
  // already guards with `palettes?.primary || []`. Writing `typeof
  // palettes.primary` in the annotation dereferenced the very value the body
  // is careful not to.
  const getSurfaceInfo = (): { palette: NonNullable<typeof palettes>['primary']; n: number } => {
    const p = palettes?.primary || [];
    // The fallback ramp needs EVERY field a real palette entry has — tone,
    // lightness, hex and colorNumber. It supplied two, so anything downstream
    // reading .lightness or .colorNumber off a black or white background got
    // undefined, and the switch below returns this array for both of those.
    const neutral: NonNullable<typeof palettes>['primary'] = Array.from({ length: 12 }, (_, i) => ({
      hex: ['#050505','#1a1a1a','#2e2e2e','#434343','#585858','#8e8e8e','#a3a3a3','#b8b8b8','#cccccc','#e0e0e0','#f0f0f0','#fafafa'][i],
      tone: [1,10,19,28,37,58,71,81,90,95,98,99][i],
      lightness: [1,10,19,28,37,58,71,81,90,95,98,99][i],
      colorNumber: i + 1,
    }));
    switch (userSelections.background) {
      case 'black': return { palette: neutral, n: 1 };
      case 'primary-base': return { palette: p, n: PC };
      case 'primary-light': return { palette: p, n: 11 };
      default: break;
    }
    // Only four of the ten background combinations have a legacy name; the
    // rest are stored as 'Theme/Surface' and used to fall through to white
    // here, so the stage previewed the wrong page color for six of them.
    const sel = parseBackground(userSelections.background);
    const n = toneFor(sel.theme, sel.surface, PC);
    return sel.theme === 'Neutral' ? { palette: neutral, n } : { palette: p, n };
  };

  const getNavColor = (opt: string) => {
    const p = palettes?.primary || [];
    const neutral = (n: number) => ['#050505','#1a1a1a','#2e2e2e','#434343','#585858','#8e8e8e','#a3a3a3','#b8b8b8','#cccccc','#e0e0e0','#f0f0f0','#fafafa'][n - 1] || '#ccc';
    switch (opt) {
      case 'white': return '#ffffff';
      case 'black': return neutral(1);
      case 'primary-light': return p[10]?.hex || '#ccc';           // Primary Color-11
      case 'primary-light-bright': return p[11]?.hex || '#ccc';    // Primary Color-12
      case 'primary-light-dim': return p[9]?.hex || '#ccc';        // Primary Color-10
      case 'primary': return p[PC - 1]?.hex || '#ccc';             // Primary Color-PC
      case 'primary-bright': return p[Math.min(PC, 12) - 1]?.hex || '#ccc'; // Primary Color-PC+1
      case 'primary-dim': return p[Math.max(PC - 2, 0)]?.hex || '#ccc';     // Primary Color-PC-1
      default: break;
    }
    // 'Secondary/Surface-Bright'. Each chromatic theme anchors on its OWN core
    // tone, the same way toneFor does for the background.
    const sel = parseBar(opt);
    const ramp = sel.theme === 'Secondary' ? (palettes?.secondary || [])
      : sel.theme === 'Tertiary' ? (palettes?.tertiary || [])
        : sel.theme === 'Neutral' ? null
          : p;
    const core = sel.theme === 'Secondary' ? SC : sel.theme === 'Tertiary' ? TC : PC;
    const n = barToneFor(sel.theme, sel.surface, core);
    return ramp === null ? neutral(n) : (ramp[n - 1]?.hex || '#ccc');
  };

  const cardStyle = {
    width: '100%' as const,
    borderRadius: 'var(--Card-Radius, 14px)',
    boxSizing: 'border-box' as const,
    maxWidth: '100%',
    overflow: 'visible' as const,
  };

  const getBgColor = () => {
    switch (userSelections.background) {
      case 'white': return '#ffffff';
      case 'black': return '#1a1a1a';
      case 'primary-base': return colors[0];
      case 'primary-light': return palettes?.primary?.[12]?.hex || '#f0f0f0';
      default: break;
    }
    // Same gap as getSurfaceInfo: the six unnamed combinations previewed white.
    return getNavColor(userSelections.background);
  };

  return (
    <div className="assign-colors-page">
      <H2>Assign Colors</H2>

      {/* Mobile tab toggle */}
      <div className="assign-colors-tabs">
        <Button
          variant={activeTab === 'preview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('preview')}
          style={{ flex: 1, borderRadius: 0 }}
        >
          Preview
        </Button>
        <Button
          variant={activeTab === 'customize' ? 'default' : 'outline'}
          onClick={() => setActiveTab('customize')}
          style={{ flex: 1, borderRadius: 0 }}
        >
          Customize
        </Button>
      </div>

      <div className="assign-colors-grid">
        {/* ─── Left: Preview ─── */}
        <div className={`assign-colors-preview ${activeTab !== 'preview' ? 'hidden' : ''}`}>
          <div className="assign-preview-toggle">
            <ToggleButtonGroup
              size="small"
              value={previewMode}
              onChange={(val: 'light' | 'dark') => val && setPreviewMode(val)}
            >
              <Button value="light" size="small">Light</Button>
              <Button value="dark" size="small">Dark</Button>
            </ToggleButtonGroup>
          </div>

          <div className="assign-preview-container">
            <div className="assign-preview-scaler">
              <PhonePreview
                colorScheme={colorScheme}
                userSelections={userSelections}
                componentStyle="modern"
                mode={previewMode}
                moodBoardUrl={moodBoardUrl}
                designSystemName={designSystemName}
                typographyStyles={typographyStyles}
              />
            </div>
          </div>

          <BodySmall className="assign-preview-label" color="quiet" style={{ fontSize: '0.7rem' }}>Preview</BodySmall>
        </div>

        {/* ─── Right: Controls ─── */}
        <div className={`assign-colors-controls ${activeTab !== 'customize' ? 'hidden' : ''}`}>

      {/* Theme Order */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={2}>
          <H3 style={{ fontSize: '1rem' }}>Theme Order</H3>
          <BodySmall color="quiet">Drag to reorder theme colors</BodySmall>
          <div className="assign-theme-order-row">
            {['Primary', 'Secondary', 'Tertiary'].map((label, i) => (
              <Card
                key={label}
                draggable
                size="small"
                onDragStart={() => { dragItem.current = i; setDragIndex(i); }}
                onDragEnter={() => { dragOver.current = i; }}
                onDragOver={(e: React.DragEvent) => e.preventDefault()}
                onDragEnd={() => {
                  if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
                    const reordered = [...colors] as [string, string, string];
                    const dragged = reordered[dragItem.current];
                    reordered.splice(dragItem.current, 1);
                    reordered.splice(dragOver.current, 0, dragged);
                    onColorsReordered(reordered);
                  }
                  dragItem.current = null;
                  dragOver.current = null;
                  setDragIndex(null);
                }}
                sx={{
                  flex: 1,
                  opacity: dragIndex === i ? 0.5 : 1,
                }}
              >
                <HStack spacing={1} alignItems="center">
                  <BodySmall color="quiet" style={{ cursor: 'grab', width: 24, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⠿</BodySmall>
                  <div
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--Style-Border-Radius, 4px)',
                      background: colors[i] || '#ccc',
                      border: '1px solid var(--Border, #d4d4d4)',
                      flexShrink: 0,
                    }}
                  />
                  <BodySmall style={{ fontWeight: 600 }}>{label}</BodySmall>
                </HStack>
              </Card>
            ))}
          </div>
        </VStack>
      </Card>

      {/* Navigational Elements */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={3}>
          <H3 style={{ fontSize: '1rem' }}>Navigational Elements</H3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, width: '100%' }}>
            {([
              { key: 'status' as const, label: 'Status Bar', options: NAV_OPTIONS },
              { key: 'appBar' as const, label: 'App Bar', options: NAV_OPTIONS },
              { key: 'navBar' as const, label: 'Navigation Bar', options: NAV_OPTIONS },
            ]).map(nav => (
              <VStack key={nav.key} spacing={1} alignItems="flex-start" style={{ width: '100%' }}>
                <BodySmall style={{ color: 'var(--Text)', fontWeight: 600 }}>
                  {nav.label}
                </BodySmall>
                <Select
                  mode="color"
                  color="default"
                  size="small"
                  fullWidth
                  className="dino-color-select"
                  style={{ ['--select-trigger-color' as any]: getNavColor(userSelections[nav.key]) }}
                  value={userSelections[nav.key]}
                  onChange={(val: string) => {
                    const v = val as NavOption;
                    if (syncNav) update({ status: v, appBar: v, navBar: v });
                    else update({ [nav.key]: v });
                  }}
                  options={nav.options.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    color: getNavColor(opt.value),
                  }))}
                />
              </VStack>
            ))}
          </div>

          <Checkbox
            label="Sync Status, App & Navigation bars"
            checked={syncNav}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const on = (e.target as HTMLInputElement).checked;
              setSyncNav(on);
              // Turning sync on unifies all three to the Status Bar's value.
              if (on) update({ appBar: userSelections.status, navBar: userSelections.status });
            }}
          />
        </VStack>
      </Card>

      {/* Background */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={2}>
          <H3 style={{ fontSize: '1rem' }}>Background</H3>
          <BodySmall color="quiet">Theme</BodySmall>
          <div className="assign-bg-buttons">
            {BACKGROUND_THEMES.map(t => (
              <Button
                key={t}
                variant={bgSelection.theme === t ? 'default' : 'outline'}
                size="small"
                onClick={() => setBackground({ theme: t, surface: bgSelection.surface })}
                style={{ flex: 1 }}
              >
                {t}
              </Button>
            ))}
          </div>
          <BodySmall color="quiet">Surface</BodySmall>
          <div className="assign-bg-buttons">
            {SURFACE_LEVELS.map(level => (
              <Button
                key={level}
                variant={bgSelection.surface === level ? 'default' : 'outline'}
                size="small"
                onClick={() => setBackground({ theme: bgSelection.theme, surface: level })}
                style={{ flex: 1 }}
              >
                {SURFACE_LABEL[level]}
              </Button>
            ))}
          </div>
        </VStack>
      </Card>

      {/* Card Coloring + Text Coloring side by side */}
      <div className="assign-card-text-row">
        <Card padding="medium" style={{ flex: 1, borderRadius: 'var(--Card-Radius, 14px)' }}>
          <VStack spacing={2}>
            <H3 style={{ fontSize: '1rem' }}>Card Coloring</H3>
            <div className="assign-buttons-row">
              {CARD_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  variant={userSelections.cardColoring === opt.value ? 'default' : 'outline'}
                  size="small"
                  onClick={() => update({ cardColoring: opt.value })}
                  style={{ flex: 1 }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </VStack>
        </Card>

        <Card padding="medium" style={{ flex: 1, borderRadius: 'var(--Card-Radius, 14px)' }}>
          <VStack spacing={2}>
            <H3 style={{ fontSize: '1rem' }}>Text Coloring</H3>
            <div className="assign-buttons-row">
              {TEXT_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  variant={userSelections.textColoring === opt.value ? 'default' : 'outline'}
                  size="small"
                  onClick={() => update({ textColoring: opt.value })}
                  style={{ flex: 1 }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </VStack>
        </Card>
      </div>

      {/* Default Buttons */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={2}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <H3 style={{ fontSize: '1rem' }}>Default Buttons</H3>
            <Link style={{ fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setShowButtonInfo(true)}>Learn more</Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
            {BUTTON_MODES.map(mode => (
              <Button
                key={mode.value}
                variant={buttonChoice.color === mode.value ? 'default' : 'outline'}
                size="small"
                onClick={() => update({ button: mode.value, buttonTone: buttonChoice.tone })}
                style={{ flex: '1 1 100px', minWidth: 0 }}
              >
                {mode.label}
              </Button>
            ))}
          </div>
          {buttonChoice.color !== 'black-white' && (
            <ToggleButtonGroup
              value={buttonChoice.tone}
              onChange={(v: ButtonTone) => v && update({ button: buttonChoice.color, buttonTone: v })}
              size="small"
            >
              {BUTTON_TONES.map(tone => (
                <Button key={tone.value} value={tone.value} size="small">{tone.label}</Button>
              ))}
            </ToggleButtonGroup>
          )}

          {/* Advanced: the tone on every background at every surface level,
              shown as the real button on the real background. Color stays
              the main choice; a cell can change only its tone. */}
          <Button
            variant="ghost"
            size="small"
            onClick={() => setShowButtonAdvanced(!showButtonAdvanced)}
            aria-expanded={showButtonAdvanced}
            startIcon={showButtonAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            style={{ alignSelf: 'flex-start' }}
          >
            {showButtonAdvanced ? 'Hide advanced' : 'Advanced: tone per background'}
          </Button>
          {showButtonAdvanced && colorScheme && (
            <VStack spacing={2} style={{ width: '100%' }}>
              <BodySmall color="quiet">
                Every background at every surface level, with the button it gets. The color comes from your choice above; change the tone in any cell where it does not look right.
              </BodySmall>
              <ButtonToneGrid
                colorScheme={colorScheme}
                userSelections={userSelections}
                onChange={(buttonCellTones) => update({ buttonCellTones })}
              />
            </VStack>
          )}
        </VStack>
      </Card>

      {/* Button Modes Info Modal */}
      <Modal open={showButtonInfo} onClose={() => setShowButtonInfo(false)} title="Default Buttons">
        <VStack spacing={3} style={{ maxWidth: 520 }}>
          <BodySmall color="quiet">
            Default buttons are two choices: a color, then a tone. The color decides which palette the button uses on each background. The tone decides how the button meets the 3:1 contrast it needs against that background.
          </BodySmall>
          <Overline>Color</Overline>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Primary</H3>
            <BodySmall color="quiet">Buttons use your primary color on every background.</BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Secondary</H3>
            <BodySmall color="quiet">Buttons use your secondary color on every background, an accent against primary surfaces and navigation.</BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Match</H3>
            <BodySmall color="quiet">
              The button takes the background's own color: primary buttons on primary backgrounds, secondary on secondary, tertiary on tertiary, and primary on neutral.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Laddered</H3>
            <BodySmall color="quiet">
              The color steps one along from the background: secondary buttons on primary backgrounds, tertiary on secondary, and primary on tertiary and neutral.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Black/White</H3>
            <BodySmall color="quiet">
              Black buttons on light backgrounds and white buttons on dark ones, in both light and dark mode. There is no tone to pick.
            </BodySmall>
          </VStack>
          <Divider />
          <Overline>Tone</Overline>
          <BodySmall color="quiet">
            Primary, Secondary, Match and Laddered each come in Fixed or Tonal.
          </BodySmall>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Fixed</H3>
            <BodySmall color="quiet">
              The button keeps your brand tone everywhere, so it looks the same on every background. Its border changes tone to keep 3:1 contrast with the background.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Tonal</H3>
            <BodySmall color="quiet">
              The same color, but the button moves to the tone that has 3:1 contrast with the background it sits on, so the button itself stands out, not just its border. It gets lighter on dark backgrounds and darker on light ones.
            </BodySmall>
          </VStack>
          <Button variant="outline" size="small" onClick={() => setShowButtonInfo(false)} style={{ alignSelf: 'flex-end' }}>
            Close
          </Button>
        </VStack>
      </Modal>

        </div>
      </div>

      {/* Navigation handled by CreationTopBar/BottomBar */}
    </div>
  );
}
