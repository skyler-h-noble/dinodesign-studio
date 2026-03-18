import { useState, useEffect, useCallback } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Label, Checkbox,
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
}: Props) {
  const hasSaved = savedFontSamples && savedFontSamples.length > 0;
  const [step, setStep] = useState<'detecting' | 'review' | 'samples'>(hasSaved ? 'samples' : 'detecting');
  const [editedTypography, setEditedTypography] = useState<TypographyStyle[]>([
    { type: 'header', family: 'Sans Serif, Geometric', weight: '700', letterSpacing: '-0.02em', allCaps: false },
    { type: 'decorative', family: 'Sans Serif, Humanist', weight: '600', letterSpacing: '0.05em', allCaps: true },
    { type: 'body', family: 'Sans Serif, Neo Grotesque', weight: '400', letterSpacing: '0em', allCaps: false },
  ]);
  const [fontSamples, setFontSamples] = useState<FontPair[]>(savedFontSamples || []);
  const [selectedSample, setSelectedSample] = useState<number | null>(savedSelectedSample ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useMoodBased, setUseMoodBased] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];

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
              { type: 'header', family: detected.headerStyle, weight: String(detected.headerWeight), letterSpacing: `${detected.headerLetterSpacing}em`, allCaps: detected.headerIsAllCaps },
              { type: 'decorative', family: detected.decorativeStyle || detected.headerStyle, weight: String(detected.decorativeWeight), letterSpacing: `${detected.decorativeLetterSpacing}em`, allCaps: detected.decorativeIsAllCaps },
              { type: 'body', family: detected.bodyStyle, weight: String(detected.bodyWeight), letterSpacing: `${detected.bodyLetterSpacing}em`, allCaps: false },
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
        { type: 'body', family: 'Business', weight: '400', letterSpacing: '0em', allCaps: false },
      ]);
      setUseMoodBased(true);
      setStep('review');
    }

    runDetection();
    return () => { cancelled = true; };
  }, []);

  // ─── Generate font options ───
  const handleGenerateOptions = useCallback(async () => {
    setIsGenerating(true);
    try {
      const headerFonts = await getFontsForStyleCategory(editedTypography[0].family, 20, useMoodBased);
      const decorativeFonts = await getFontsForStyleCategory(editedTypography[1].family, 20, useMoodBased);
      const bodyFonts = await getFontsForStyleCategory(editedTypography[2].family, 20, useMoodBased);

      const pairs: FontPair[] = [];
      for (let i = 0; i < 20; i++) {
        pairs.push({
          id: i,
          header: {
            family: headerFonts[i % headerFonts.length].family,
            weight: editedTypography[0].weight,
            letterSpacing: editedTypography[0].letterSpacing,
            allCaps: editedTypography[0].allCaps,
          },
          decorative: {
            family: decorativeFonts[i % decorativeFonts.length].family,
            weight: editedTypography[1].weight,
            letterSpacing: editedTypography[1].letterSpacing,
            allCaps: editedTypography[1].allCaps,
          },
          body: {
            family: bodyFonts[i % bodyFonts.length].family,
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

  // Auto-generate when detection completes
  useEffect(() => {
    if (step === 'review') {
      handleGenerateOptions();
    }
  }, [step === 'review']);

  const handleEdit = (index: number, field: keyof TypographyStyle, value: string | boolean) => {
    const updated = [...editedTypography];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTypography(updated);
  };

  const handleSampleEdit = (sampleId: number, role: 'header' | 'decorative' | 'body', field: string, value: string | boolean) => {
    setFontSamples(prev => prev.map(s => {
      if (s.id !== sampleId) return s;
      return { ...s, [role]: { ...s[role], [field]: value } };
    }));
  };

  const handleComplete = () => {
    if (selectedSample === null) return;
    const sample = fontSamples.find(s => s.id === selectedSample);
    if (!sample) return;

    const finalStyles: TypographyStyle[] = [
      { type: 'header', family: sample.header.family, weight: sample.header.weight, letterSpacing: sample.header.letterSpacing, allCaps: sample.header.allCaps },
      { type: 'decorative', family: sample.decorative.family, weight: sample.decorative.weight, letterSpacing: sample.decorative.letterSpacing, allCaps: sample.decorative.allCaps },
      { type: 'body', family: sample.body.family, weight: sample.body.weight, letterSpacing: sample.body.letterSpacing, allCaps: false },
    ];
    onTypographyComplete(finalStyles);
    onNext();
  };

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
        <H2>Typography Selection</H2>
        <div className="typo-spinner" />
        <Body>Analyzing mood board for typography...</Body>
        <BodySmall style={{ color: 'var(--Quiet)' }}>Detecting text regions and classifying styles</BodySmall>
      </VStack>
    );
  }

  // ─── Review step (shown briefly before auto-advance) ───
  // ─── Samples step ───
  return (
    <div className="typo-page">
      <VStack spacing={4} style={{ maxWidth: 900, margin: '0 auto' }}>
        <H2>Typography Selection</H2>

        {/* Color palette preview */}
        <HStack spacing={1}>
          {colors.slice(0, 3).map((c, i) => (
            <div key={i} style={{ width: 32, height: 32, borderRadius: 6, background: c, border: '1px solid var(--Border)' }} />
          ))}
          <BodySmall style={{ color: 'var(--Quiet)', marginLeft: 8 }}>
            {useMoodBased ? 'Mood-based detection (no text found)' : 'Text-based detection'}
          </BodySmall>
        </HStack>

        {/* Collapsible typography settings */}
        <Card padding="medium" style={{ width: '100%', borderRadius: 'var(--Card-Radius, 14px)' }}>
          <VStack spacing={2}>
            <HStack spacing={2} style={{ justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <H3 style={{ fontSize: '1rem' }}>Typography Settings</H3>
              <Button variant="outline" color="default" size="small" onClick={() => setShowSettings(!showSettings)}>
                {showSettings ? 'Hide' : 'Edit'}
              </Button>
            </HStack>

            {!showSettings && (
              <HStack spacing={4} style={{ flexWrap: 'wrap' }}>
                {editedTypography.map((t, i) => (
                  <BodySmall key={i} style={{ color: 'var(--Quiet)' }}>
                    <strong>{t.type}:</strong> {t.family}
                  </BodySmall>
                ))}
              </HStack>
            )}

            {showSettings && (
              <VStack spacing={4} style={{ width: '100%' }}>
                {editedTypography.map((t, i) => (
                  <VStack key={i} spacing={2} style={{ width: '100%', paddingBottom: i < 2 ? 16 : 0, borderBottom: i < 2 ? '1px solid var(--Border)' : 'none' }}>
                    <H3 style={{ fontSize: '1rem' }}>{t.type.charAt(0).toUpperCase() + t.type.slice(1)}</H3>

                    <div className="typo-field-header">
                      <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600 }}>Font Style</BodySmall>
                    </div>
                    <select value={t.family} onChange={e => handleEdit(i, 'family', e.target.value)} style={selectStyle}>
                      {categoryOptions.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <div className="typo-two-col">
                      <VStack spacing={1} style={{ flex: 1 }}>
                        <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600 }}>Weight</BodySmall>
                        <select value={t.weight} onChange={e => handleEdit(i, 'weight', e.target.value)} style={selectStyle}>
                          {WEIGHT_OPTIONS.map(w => (
                            <option key={w.value} value={w.value}>{w.label}</option>
                          ))}
                        </select>
                      </VStack>
                      <VStack spacing={1} style={{ flex: 1 }}>
                        <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600 }}>Letter Spacing</BodySmall>
                        <select value={t.letterSpacing} onChange={e => handleEdit(i, 'letterSpacing', e.target.value)} style={selectStyle}>
                          {SPACING_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </VStack>
                    </div>

                    {t.type !== 'body' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={t.allCaps}
                          onChange={e => handleEdit(i, 'allCaps', e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: 'var(--Buttons-Primary-Button)' }}
                        />
                        <BodySmall>All Caps</BodySmall>
                      </label>
                    )}
                  </VStack>
                ))}

                <Button
                  variant="solid"
                  color="default"
                  onClick={handleGenerateOptions}
                  disabled={isGenerating}
                  style={{ width: '100%' }}
                >
                  {isGenerating ? 'Generating...' : 'Regenerate Typography Options'}
                </Button>
              </VStack>
            )}
          </VStack>
        </Card>

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
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Select a font combination ({fontSamples.length} options)
            </BodySmall>

            <div className="typo-samples-grid">
              {fontSamples.map(sample => {
                const isSelected = selectedSample === sample.id;
                const isExpanded = expandedCard === sample.id;

                return (
                  <div
                    key={sample.id}
                    className={`typo-sample-card ${isSelected ? 'selected' : ''}`}
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
                      variant="outline"
                      color="default"
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
                      <div className="typo-expanded-controls" onClick={e => e.stopPropagation()}>
                        {(['header', 'decorative', 'body'] as const).map(role => (
                          <VStack key={role} spacing={1}>
                            <Label style={{ fontSize: '0.75rem', textTransform: 'capitalize', fontWeight: 600 }}>{role}</Label>
                            <div className="typo-control-row">
                              <BodySmall style={{ fontSize: '0.7rem' }}>Weight</BodySmall>
                              <select
                                value={sample[role].weight}
                                onChange={e => handleSampleEdit(sample.id, role, 'weight', e.target.value)}
                                style={{ ...selectStyle, fontSize: '0.75rem', padding: '4px 8px' }}
                              >
                                {WEIGHT_OPTIONS.map(w => (
                                  <option key={w.value} value={w.value}>{w.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="typo-control-row">
                              <BodySmall style={{ fontSize: '0.7rem' }}>Spacing</BodySmall>
                              <select
                                value={sample[role].letterSpacing}
                                onChange={e => handleSampleEdit(sample.id, role, 'letterSpacing', e.target.value)}
                                style={{ ...selectStyle, fontSize: '0.75rem', padding: '4px 8px' }}
                              >
                                {SPACING_OPTIONS.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                            </div>
                            {role !== 'body' && (
                              <div className="typo-control-row">
                                <BodySmall style={{ fontSize: '0.7rem' }}>All Caps</BodySmall>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={(sample[role] as any).allCaps || false}
                                    onChange={e => handleSampleEdit(sample.id, role, 'allCaps', e.target.checked)}
                                  />
                                </label>
                              </div>
                            )}
                          </VStack>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </VStack>
        )}

        {/* Navigation */}
        <HStack spacing={2} style={{ marginTop: 16 }}>
          <Button variant="outline" color="default" onClick={onBack}>Back</Button>
          <Button
            variant="solid"
            color="default"
            onClick={handleComplete}
            disabled={selectedSample === null}
          >
            Next
          </Button>
        </HStack>
      </VStack>
    </div>
  );
}
