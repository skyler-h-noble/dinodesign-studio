import { useState, useEffect, useCallback } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Label, Checkbox, Divider, Link, Modal, RadioGroup, Select, TextField,
} from '@dynodesign/components';
import chroma from 'chroma-js';
import type { StageProps, TypographyStyle, ColorScheme } from '../../types';
import { colorMoodMapping } from '../../data/colorMoodMapping';
import { moodFontMapping, type MoodName } from '../../data/moodFontMapping';
import { getFontsForStyleCategory, loadGoogleFonts, type GoogleFont } from '../../utils/googleFontsManager';
import { detectTextRegions, classifyTextRegions, type DetectedTypography } from '../../utils/textDetection';
import '../../styles/typography.css';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  moodBoardUrl?: string | null;
  onTypographyComplete: (styles: TypographyStyle[]) => void;
  designSystemName?: string;
  savedFontSamples?: FontPair[];
  savedSelectedSample?: number | null;
  onFontSamplesGenerated?: (samples: FontPair[], selected: number | null) => void;
  /** On the edit flow, the user's chosen trio from the previous session. When
   *  set, TypographyStage skips the OCR step, uses savedTypographySettings to
   *  drive the sidebar, and pins this trio as Card #1 of the freshly generated
   *  20-card deck so the user sees their pick first. */
  savedFirstTrio?: TypographyStyle[];
  decorativeMode?: 'surface-components' | 'only-selected';
  onDecorativeModeChange?: (mode: 'surface-components' | 'only-selected') => void;
  /** Persisted left-sidebar settings (font category, weight, letter-spacing,
   *  all-caps for each role). When set, restores on remount instead of
   *  resetting to the hardcoded defaults. */
  savedTypographySettings?: TypographyStyle[] | null;
  onTypographySettingsChange?: (settings: TypographyStyle[]) => void;
}

export interface FontPair {
  id: number;
  header: { family: string; weight: string; letterSpacing: string; allCaps: boolean };
  decorative: { family: string; weight: string; letterSpacing: string; allCaps: boolean };
  body: { family: string; weight: string; letterSpacing: string };
}

const STYLE_CATEGORIES = [
  'Serif, Transitional', 'Serif, Old Style', 'Serif, Slab', 'Serif, Modern',
  'Serif, Scotch', 'Serif, Humanist', 'Serif, Fatface', 'Serif, Didone',
  'Sans Serif, Humanist', 'Sans Serif, Geometric', 'Sans Serif, Neo Grotesque',
  'Sans Serif, Grotesque', 'Sans Serif, Rounded', 'Sans Serif, Superellipse',
  'Sans Serif, Glyphic', 'Calligraphy, Formal', 'Calligraphy, Informal',
  'Calligraphy, Upright', 'Appearance, Techno',
];

const MOOD_NAMES = Object.keys(moodFontMapping) as MoodName[];

const WEIGHT_OPTIONS = [
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semibold (600)' },
  { value: '700', label: 'Bold (700)' },
];

// Detected/arbitrary numeric weights may not land on one of WEIGHT_OPTIONS.
// Snap to the closest supported value so the dropdown always has a selection.
function snapWeight(weight: number | string | null | undefined): string {
  const allowed = WEIGHT_OPTIONS.map(o => Number(o.value));
  const n = Number(weight);
  if (!Number.isFinite(n)) return '400';
  return String(allowed.reduce((best, w) => Math.abs(w - n) < Math.abs(best - n) ? w : best, allowed[0]));
}

const SPACING_OPTIONS = [
  { value: '-0.02em', label: 'Tight' },
  { value: '0em', label: 'Normal' },
  { value: '0.05em', label: 'Wide' },
  { value: '0.15em', label: 'Extra Wide' },
];

function detectMoodFromColor(hex: string) {
  let closestMood = colorMoodMapping[0];
  let minDistance = Infinity;
  for (const mapping of colorMoodMapping) {
    for (const color of mapping.colors) {
      try {
        const dist = chroma.distance(hex, color);
        if (dist < minDistance) {
          minDistance = dist;
          closestMood = mapping;
        }
      } catch { /* skip invalid colors */ }
    }
  }
  return closestMood;
}

const moodToFontMood: Record<string, string> = {
  'Calm': 'Calm', 'Healthy': 'Business', 'Balanced': 'Calm', 'Friendly': 'Happy',
  'Bright': 'Business', 'Wealth': 'Elegant', 'Romantic': 'Elegant', 'Energetic': 'Active',
  'Cute': 'Cute', 'Playful': 'Playful', 'Rebellious': 'Loud', 'Sophisticated': 'Sophisticated',
  'Passionate': 'Loud', 'Feminine': 'Elegant', 'Delicate': 'Elegant', 'Giddy': 'Happy',
  'Sassy': 'Loud', 'Charming': 'Elegant', 'Spirited': 'Happy', 'Determined': 'Business',
  'Pensive': 'Calm', 'Nostalgic': 'Vintage', 'Victorious': 'Business', 'Ambitious': 'Business',
  'Proud': 'Elegant', 'Formal': 'Business', 'Security': 'Business', 'Timeless': 'Business',
};

export default function TypographyStage({
  onNext, onBack, colorScheme, moodBoardUrl, onTypographyComplete, designSystemName,
  savedFontSamples, savedSelectedSample, onFontSamplesGenerated,
  decorativeMode: decorativeModeProp, onDecorativeModeChange,
  savedTypographySettings, onTypographySettingsChange,
  savedFirstTrio,
}: Props) {
  const hasSaved = savedFontSamples && savedFontSamples.length > 0;
  // Edit-flow shortcut: if we have the user's previous trio, skip the OCR
  // detection step — we'll generate fresh alternatives from the saved
  // sidebar settings and pin the previous trio as Card #0.
  const isEditFlow = !hasSaved && savedFirstTrio && savedFirstTrio.length === 3;
  const [step, setStep] = useState<'detecting' | 'review' | 'samples'>(
    hasSaved ? 'samples' : (isEditFlow ? 'review' : 'detecting'),
  );
  // Restore prior sidebar settings on remount; fall back to defaults the
  // first time the user lands here. Persisted via onTypographySettingsChange
  // so they survive navigation between stages.
  const [editedTypography, setEditedTypography] = useState<TypographyStyle[]>(() =>
    savedTypographySettings && savedTypographySettings.length === 3
      ? savedTypographySettings
      : [
        { type: 'header', family: 'Sans Serif, Geometric', weight: '700', letterSpacing: '-0.02em', allCaps: false },
        { type: 'decorative', family: 'Sans Serif, Humanist', weight: '600', letterSpacing: '0.05em', allCaps: true },
        { type: 'body', family: 'Sans Serif, Neo Grotesque', weight: '400', letterSpacing: '0em', allCaps: false },
      ]
  );
  const [fontSamples, setFontSamples] = useState<FontPair[]>(savedFontSamples || []);
  const [selectedSample, setSelectedSample] = useState<number | null>(savedSelectedSample ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useMoodBased, setUseMoodBased] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [customFontsOpen, setCustomFontsOpen] = useState(false);
  const decorativeMode = decorativeModeProp || 'surface-components';
  const setDecorativeMode = (mode: 'surface-components' | 'only-selected') => onDecorativeModeChange?.(mode);
  const [customFonts, setCustomFonts] = useState({
    headerUrl: '',
    headerWeight: '700',
    decorativeUrl: '',
    decorativeWeight: '600',
    bodyUrl: '',
    bodyWeight: '400',
    bodySemiboldWeight: '600',
    bodyBoldWeight: '700',
  });
  // Per-role expanded state for the collapsible settings sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    header: true,
    decorative: false,
    body: false,
  });
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [settingsOpen, setSettingsOpen] = useState(true);

  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];

  const roleLabels: Record<string, string> = {
    header: 'Decorative Header',
    decorative: 'Decorative Subtitle',
    body: 'Body',
  };

  // ─── Phase 1: Detection ───
  useEffect(() => {
    if (step !== 'detecting') return;
    let cancelled = false;

    async function runDetection() {
      if (!moodBoardUrl) {
        // No mood board — go straight to mood-based
        handleMoodFallback();
        return;
      }

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = moodBoardUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
        });

        const regions = await detectTextRegions(img);
        if (cancelled) return;

        if (regions.length > 0) {
          const detected = await classifyTextRegions(img, regions);
          if (cancelled) return;

          if (detected) {
            setEditedTypography([
              { type: 'header', family: detected.headerStyle, weight: snapWeight(detected.headerWeight), letterSpacing: `${detected.headerLetterSpacing}em`, allCaps: detected.headerIsAllCaps },
              { type: 'decorative', family: detected.decorativeStyle || detected.headerStyle, weight: snapWeight(detected.decorativeWeight), letterSpacing: `${detected.decorativeLetterSpacing}em`, allCaps: detected.decorativeIsAllCaps },
              { type: 'body', family: detected.bodyStyle, weight: snapWeight(detected.bodyWeight), letterSpacing: `${detected.bodyLetterSpacing}em`, allCaps: false },
            ]);
            setUseMoodBased(false);
            setStep('review');
            return;
          }
        }
        // No text found — fall back to mood
        handleMoodFallback();
      } catch (err) {
        console.warn('Detection failed, using mood-based:', err);
        if (!cancelled) handleMoodFallback();
      }
    }

    function handleMoodFallback() {
      const primaryMood = detectMoodFromColor(colors[0]);
      const secondaryMood = detectMoodFromColor(colors[1]);
      const headerMood = moodToFontMood[primaryMood.mood.replace(/-\d+$/, '')] || 'Business';
      const decorativeMood = moodToFontMood[secondaryMood.mood.replace(/-\d+$/, '')] || 'Calm';

      setEditedTypography([
        { type: 'header', family: headerMood, weight: '700', letterSpacing: '-0.02em', allCaps: false },
        { type: 'decorative', family: decorativeMood, weight: '600', letterSpacing: '0.05em', allCaps: false },
        { type: 'body', family: 'Sans Serif, Neo Grotesque', weight: '400', letterSpacing: '0em', allCaps: false },
      ]);
      setUseMoodBased(true);
      setStep('review');
    }

    runDetection();
    return () => { cancelled = true; };
  }, []);

  // ─── Generate font options ───
  // `pinTrio` (used only on the first edit-flow render) inserts the user's
  // previously chosen Header / Decorative / Body fonts as Card #0, with
  // 19 fresh alternatives following. Subsequent calls (e.g. when the user
  // tweaks the sidebar) pass undefined and the deck is fully refreshed.
  const handleGenerateOptions = useCallback(async (pinTrio?: TypographyStyle[]) => {
    setIsGenerating(true);
    try {
      const headerFonts = await getFontsForStyleCategory(editedTypography[0].family, 20, useMoodBased);
      const decorativeFonts = await getFontsForStyleCategory(editedTypography[1].family, 20, useMoodBased);
      const bodyFonts = await getFontsForStyleCategory('Sans Serif, Neo Grotesque', 20, useMoodBased);

      const pairs: FontPair[] = [];
      const validPin = pinTrio && pinTrio.length === 3
        && pinTrio.every(t => typeof t.family === 'string' && t.family.length > 0);
      if (validPin) {
        const h = pinTrio![0];
        const d = pinTrio![1];
        const b = pinTrio![2];
        pairs.push({
          id: 0,
          header: { family: h.family, weight: h.weight, letterSpacing: h.letterSpacing, allCaps: h.allCaps },
          decorative: { family: d.family, weight: d.weight, letterSpacing: d.letterSpacing, allCaps: d.allCaps },
          body: { family: b.family, weight: b.weight, letterSpacing: b.letterSpacing },
        });
      }
      const startIndex = pairs.length;
      const targetTotal = 20;
      for (let i = startIndex; i < targetTotal; i++) {
        const offset = validPin ? i : i; // keep deterministic ordering
        pairs.push({
          id: i,
          header: {
            family: headerFonts[offset % headerFonts.length].family,
            weight: editedTypography[0].weight,
            letterSpacing: editedTypography[0].letterSpacing,
            allCaps: editedTypography[0].allCaps,
          },
          decorative: {
            family: decorativeFonts[offset % decorativeFonts.length].family,
            weight: editedTypography[1].weight,
            letterSpacing: editedTypography[1].letterSpacing,
            allCaps: editedTypography[1].allCaps,
          },
          body: {
            family: bodyFonts[offset % bodyFonts.length].family,
            weight: editedTypography[2].weight,
            letterSpacing: editedTypography[2].letterSpacing,
          },
        });
      }

      // Load all fonts
      const allFamilies = [...new Set(pairs.flatMap(p => [p.header.family, p.decorative.family, p.body.family]))];
      await loadGoogleFonts(allFamilies);

      setFontSamples(pairs);
      setSelectedSample(0); // Auto-select Option 1
      onFontSamplesGenerated?.(pairs, 0);
      setStep('samples');
    } catch (err) {
      console.error('Font generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [editedTypography, useMoodBased]);

  // Auto-generate when detection completes. On the edit flow's first run,
  // pin the saved trio as Card #0 so the user immediately sees their
  // previous pick; later regenerations skip the pin.
  useEffect(() => {
    if (step === 'review') {
      handleGenerateOptions(isEditFlow ? savedFirstTrio : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step === 'review']);

  // Auto-regenerate (debounced) when typography settings change after initial samples exist
  useEffect(() => {
    if (step !== 'samples' || fontSamples.length === 0) return;
    const timer = setTimeout(() => {
      handleGenerateOptions();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedTypography]);

  const handleEdit = (index: number, field: keyof TypographyStyle, value: string | boolean) => {
    const updated = [...editedTypography];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTypography(updated);
    onTypographySettingsChange?.(updated);
  };

  const handleSampleEdit = (sampleId: number, role: 'header' | 'decorative' | 'body', field: string, value: string | boolean) => {
    setFontSamples(prev => prev.map(s => {
      if (s.id !== sampleId) return s;
      return { ...s, [role]: { ...s[role], [field]: value } };
    }));
  };

  // Push typography to parent whenever selection or sample edits change
  useEffect(() => {
    if (selectedSample === null) return;
    const sample = fontSamples.find(s => s.id === selectedSample);
    if (!sample) return;

    const finalStyles: TypographyStyle[] = [
      { type: 'header', family: sample.header.family, weight: sample.header.weight, letterSpacing: sample.header.letterSpacing, allCaps: sample.header.allCaps },
      { type: 'decorative', family: sample.decorative.family, weight: sample.decorative.weight, letterSpacing: sample.decorative.letterSpacing, allCaps: sample.decorative.allCaps },
      { type: 'body', family: sample.body.family, weight: sample.body.weight, letterSpacing: sample.body.letterSpacing, allCaps: false },
    ];
    onTypographyComplete(finalStyles);
  }, [selectedSample, fontSamples]);

  const categoryOptions = useMoodBased ? MOOD_NAMES : STYLE_CATEGORIES;

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--Border)',
    borderRadius: 'var(--Style-Border-Radius)',
    background: 'var(--Container-Lowest)',
    color: 'var(--Text)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  };

  // ─── Detecting step ───
  if (step === 'detecting') {
    return (
      <VStack spacing={4} style={{ padding: '64px 24px', maxWidth: 800, margin: '0 auto', alignItems: 'center' }}>
        <H2 style={{ textAlign: 'center' }}>Typography Selection</H2>
        <div className="typo-spinner" />
        <Body style={{ textAlign: 'center' }}>Analyzing mood board for typography...</Body>
        <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>Detecting text regions and classifying styles</BodySmall>
      </VStack>
    );
  }

  // ─── Review step (shown briefly before auto-advance) ───
  // ─── Samples step ───
  // Helper: render one collapsible role section
  const renderRoleSection = (key: 'header' | 'decorative' | 'body', i: number) => {
    const t = editedTypography[i];
    const isOpen = openSections[key];
    const roleCategoryOptions = (key === 'body' && !useMoodBased)
      ? categoryOptions.filter(c => c.startsWith('Sans Serif'))
      : categoryOptions;
    return (
      <div key={key} className="typo-section">
        <div className="typo-section-header" onClick={() => toggleSection(key)}>
          <BodySmall style={{ fontWeight: 700 }}>{roleLabels[key]}</BodySmall>
          <span className={`typo-section-chevron ${isOpen ? 'open' : ''}`}>▶</span>
        </div>
        {isOpen && (
          <div className="typo-section-body">
            <VStack spacing={2}>
              <Select
                label="Font Style"
                labelPosition="top"
                size="small"
                fullWidth
                value={t.family}
                onChange={(val: string) => handleEdit(i, 'family', val)}
                options={roleCategoryOptions.map(cat => ({ value: cat, label: cat }))}
              />
              <Select
                label="Weight"
                labelPosition="top"
                size="small"
                fullWidth
                value={t.weight}
                onChange={(val: string) => handleEdit(i, 'weight', val)}
                options={WEIGHT_OPTIONS}
              />
              <Select
                label="Letter Spacing"
                labelPosition="top"
                size="small"
                fullWidth
                value={t.letterSpacing}
                onChange={(val: string) => handleEdit(i, 'letterSpacing', val)}
                options={SPACING_OPTIONS}
              />
              {key !== 'body' && (
                <Checkbox
                  variant="default-outline"
                  size="small"
                  label="All Caps"
                  checked={t.allCaps}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleEdit(i, 'allCaps', e.target.checked)}
                />
              )}
            </VStack>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="typo-page" style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ─── Left: persistent sidebar ─── */}
      <div data-surface="Surface-Dim" style={{
        width: settingsOpen ? 296 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        borderRight: settingsOpen ? '1px solid var(--Border)' : 'none',
        background: 'var(--Background)',
      }}>
        <div style={{ width: 296, padding: '8px 16px', boxSizing: 'border-box' }}>
          <VStack spacing={2}>
            <H3 style={{ fontSize: '1rem', margin: 0 }}>Typography Settings</H3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              {useMoodBased ? 'Mood-based detection' : 'Text-based detection'}
              {' · '}Changes auto-regenerate
            </BodySmall>

            <div>
              {renderRoleSection('header', 0)}
              {renderRoleSection('decorative', 1)}
              {renderRoleSection('body', 2)}
            </div>

            <RadioGroup
              variant="default-outline"
              size="small"
              label="Apply Decorative Styles:"
              options={[
                { value: 'surface-components', label: 'Surface Components Only' },
                { value: 'only-selected', label: 'Only Where Selected' },
              ]}
              value={decorativeMode}
              onChange={(_e: any, val: string) => setDecorativeMode(val as any)}
            />

            <Link
              onClick={(e: React.MouseEvent) => { e.preventDefault(); setCustomFontsOpen(true); }}
              style={{ fontSize: '0.8rem' }}
            >
              Need to use custom fonts?
            </Link>
          </VStack>
        </div>
      </div>

      {/* ─── Right: main content ─── */}
      <div style={{ flex: 1, minWidth: 0, transition: 'margin 0.2s ease' }}>
        <VStack spacing={3} style={{ maxWidth: 1000, margin: '0 auto', width: '100%', padding: '40px 32px', boxSizing: 'border-box' }}>

          {!settingsOpen && (
            <HStack spacing={2} style={{ justifyContent: 'center' }}>
              <Button variant="outline" size="small" onClick={() => setSettingsOpen(true)}>
                Settings
              </Button>
            </HStack>
          )}

          {/* Loading state */}
          {isGenerating && fontSamples.length === 0 && (
            <VStack spacing={2} style={{ alignItems: 'center', padding: 32 }}>
              <div className="typo-spinner" />
              <Body>Generating font options...</Body>
            </VStack>
          )}

          {/* Font samples grid */}
          {fontSamples.length > 0 && (
            <VStack spacing={2} style={{ width: '100%' }}>
              <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
                Select a font combination ({fontSamples.length} options)
                {isGenerating && ' · regenerating…'}
              </BodySmall>

            <div className="typo-samples-grid">
              {fontSamples.map(sample => {
                const isSelected = selectedSample === sample.id;
                const isExpanded = expandedCard === sample.id;

                return (
                  <Card
                    key={sample.id}
                    clickable
                    selected={isSelected}
                    padding="medium"
                    onClick={() => { setSelectedSample(sample.id); onFontSamplesGenerated?.(fontSamples, sample.id); }}
                  >
                    <div className="typo-sample-header-row">
                      <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600 }}>Option {sample.id + 1}</BodySmall>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => setSelectedSample(sample.id)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        variant="primary"
                      />
                    </div>

                    {/* Header preview */}
                    <div style={{
                      fontFamily: `"${sample.header.family}", serif`,
                      fontWeight: Number(sample.header.weight),
                      fontSize: 28,
                      letterSpacing: sample.header.letterSpacing,
                      textTransform: sample.header.allCaps ? 'uppercase' : 'none',
                      color: 'var(--Header)',
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}>
                      {designSystemName || 'The Quick Brown Fox'}
                    </div>

                    {/* Decorative preview */}
                    <div style={{
                      fontFamily: `"${sample.decorative.family}", sans-serif`,
                      fontWeight: Number(sample.decorative.weight),
                      fontSize: 13,
                      letterSpacing: sample.decorative.letterSpacing,
                      textTransform: sample.decorative.allCaps ? 'uppercase' : 'none',
                      color: 'var(--Quiet)',
                      marginBottom: 4,
                    }}>
                      Adaptive &amp; Accessible
                    </div>

                    {/* Body preview */}
                    <div style={{
                      fontFamily: `"${sample.body.family}", sans-serif`,
                      fontWeight: Number(sample.body.weight),
                      fontSize: 14,
                      letterSpacing: sample.body.letterSpacing,
                      color: 'var(--Text)',
                      lineHeight: 1.5,
                    }}>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.
                    </div>

                    {/* Font family labels */}
                    <div className="typo-font-labels">
                      <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                        H: {sample.header.family} &bull; D: {sample.decorative.family} &bull; B: {sample.body.family}
                      </BodySmall>
                    </div>

                    {/* Expand/collapse more info */}
                    <Button
                      variant="primary-outline"
                      size="small"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setExpandedCard(isExpanded ? null : sample.id);
                      }}
                      style={{ marginTop: 8, fontSize: '0.75rem' }}
                    >
                      {isExpanded ? 'Hide Details' : 'Customize'}
                    </Button>

                    {isExpanded && (
                      <>
                      <Divider style={{ marginTop: 12, width: '100%' }} />
                      <VStack spacing={3} onClick={e => e.stopPropagation()} style={{ paddingTop: 12, width: '100%' }}>
                        {/* Role headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          {(['header', 'decorative', 'body'] as const).map(role => (
                            <Label key={role} style={{ fontSize: '0.75rem', textTransform: 'capitalize', fontWeight: 600 }}>{role}</Label>
                          ))}
                        </div>
                        {/* Weight row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          {(['header', 'decorative', 'body'] as const).map(role => (
                            <Select
                              key={role}
                              label="Weight"
                              labelPosition="top"
                              size="small"
                              fullWidth
                              value={sample[role].weight}
                              onChange={(val: string) => handleSampleEdit(sample.id, role, 'weight', val)}
                              options={WEIGHT_OPTIONS.map(w => ({ value: w.value, label: w.label }))}
                            />
                          ))}
                        </div>
                        {/* Spacing row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          {(['header', 'decorative', 'body'] as const).map(role => (
                            <Select
                              key={role}
                              label="Spacing"
                              labelPosition="top"
                              size="small"
                              fullWidth
                              value={sample[role].letterSpacing}
                              onChange={(val: string) => handleSampleEdit(sample.id, role, 'letterSpacing', val)}
                              options={SPACING_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
                            />
                          ))}
                        </div>
                        {/* All Caps row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          {(['header', 'decorative', 'body'] as const).map(role => (
                            <div key={role}>
                              {role !== 'body' ? (
                                <Checkbox
                                  label="All Caps"
                                  checked={(sample[role] as any).allCaps || false}
                                  onChange={(e: any) => handleSampleEdit(sample.id, role, 'allCaps', e.target.checked)}
                                  variant="primary"
                                  size="small"
                                />
                              ) : <div />}
                            </div>
                          ))}
                        </div>
                      </VStack>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </VStack>
        )}
        </VStack>
      </div>

      {/* Navigation handled by CreationTopBar/BottomBar */}

      {/* Custom Fonts Modal */}
      <Modal
        open={customFontsOpen}
        onClose={() => setCustomFontsOpen(false)}
        title="Custom Fonts"
      >
        <VStack spacing={3}>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Provide URLs to your custom font files (WOFF2, WOFF, or TTF). These will be used instead of the suggested Google Fonts.
          </BodySmall>

          {/* Header Font */}
          <VStack spacing={1}>
            <TextField label="Header Font URL" placeholder="https://example.com/fonts/header.woff2" value={customFonts.headerUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, headerUrl: e.target.value })} size="small" />
            <TextField label="Weight" placeholder="700" value={customFonts.headerWeight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, headerWeight: e.target.value })} size="small" />
          </VStack>

          {/* Decorative Font */}
          <VStack spacing={1}>
            <TextField label="Decorative Font URL" placeholder="https://example.com/fonts/decorative.woff2" value={customFonts.decorativeUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, decorativeUrl: e.target.value })} size="small" />
            <TextField label="Weight" placeholder="600" value={customFonts.decorativeWeight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, decorativeWeight: e.target.value })} size="small" />
          </VStack>

          {/* Body Font */}
          <VStack spacing={1}>
            <TextField label="Body Font URL" placeholder="https://example.com/fonts/body.woff2" value={customFonts.bodyUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, bodyUrl: e.target.value })} size="small" />
            <HStack spacing={2}>
              <TextField label="Body Weight" placeholder="400" value={customFonts.bodyWeight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, bodyWeight: e.target.value })} size="small" />
              <TextField label="Semibold Weight" placeholder="600" value={customFonts.bodySemiboldWeight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, bodySemiboldWeight: e.target.value })} size="small" />
              <TextField label="Bold Weight" placeholder="700" value={customFonts.bodyBoldWeight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFonts({ ...customFonts, bodyBoldWeight: e.target.value })} size="small" />
            </HStack>
          </VStack>

          {/* Figma note */}
          <Card padding="small" style={{ background: 'var(--Container-Low)', border: '1px solid var(--Border)' }}>
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.75rem' }}>
              <strong>Note for Figma:</strong> Custom fonts must be installed on your computer for them to render properly in the Figma Design System Library. Figma does not support loading fonts from URLs — fonts must be locally installed.
            </BodySmall>
          </Card>

          <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary-outline" onClick={() => setCustomFontsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                // Apply custom fonts as typography styles
                const styles: TypographyStyle[] = [
                  { type: 'header', family: customFonts.headerUrl || 'Custom Header', weight: customFonts.headerWeight, letterSpacing: '0em', allCaps: false },
                  { type: 'decorative', family: customFonts.decorativeUrl || 'Custom Decorative', weight: customFonts.decorativeWeight, letterSpacing: '0em', allCaps: false },
                  { type: 'body', family: customFonts.bodyUrl || 'Custom Body', weight: customFonts.bodyWeight, letterSpacing: '0em', allCaps: false },
                ];
                onTypographyComplete(styles);
                setCustomFontsOpen(false);
              }}
            >
              Apply Custom Fonts
            </Button>
          </HStack>
        </VStack>
      </Modal>
    </div>
  );
}
