import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
  CircularProgress, Checkbox, Link, Radio, Modal, TextField, Alert, Slider,
} from '@dynodesign/components';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useState, useEffect, useCallback, useRef } from 'react';
import chroma from 'chroma-js';
import { extractColorsFromImage } from '../../utils/imageAnalysis';
import { generateColorSchemes } from '../../utils/colorSchemes';
import { getLightness, toneToColorNumber, generateSemanticLightModeScale, generateSemanticDarkModeScale, getNaturalPeakChroma } from '../../utils/colorScale';
import { getColorDescription } from '../../utils/colorNaming';
import type { StageProps, ColorScheme } from '../../types';
import type { ExtractedColorData, ExtractedColor } from '../../utils/imageAnalysis';

type ColorStep = 'extraction' | 'theme';

interface Props extends StageProps {
  moodBoardUrl: string | null;
  onSchemeSelected: (scheme: ColorScheme) => void;
  selectedScheme: ColorScheme | null;
  savedSchemes?: ColorScheme[];
  onSchemesGenerated?: (schemes: ColorScheme[]) => void;
  savedTopColors?: ExtractedColor[];
  onTopColorsExtracted?: (colors: ExtractedColor[]) => void;
  onCustomBackChange?: (handler: (() => void) | null) => void;
  onCustomNextChange?: (handler: (() => void) | null) => void;
  onNextLabelChange?: (label: string | null) => void;
}

export default function ColorStage({
  onNext,
  onBack,
  moodBoardUrl,
  onSchemeSelected,
  selectedScheme,
  savedSchemes,
  onSchemesGenerated,
  savedTopColors,
  onTopColorsExtracted,
  onCustomBackChange,
  onCustomNextChange,
  onNextLabelChange,
}: Props) {
  const [step, setStep] = useState<ColorStep>(selectedScheme ? 'theme' : 'extraction');
  const [colorData, setColorData] = useState<ExtractedColorData | null>(null);
  const [topColors, setTopColors] = useState<ExtractedColor[]>(savedTopColors || []);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [schemes, setSchemes] = useState<ColorScheme[]>(savedSchemes || []);
  const [showChromaSettings, setShowChromaSettings] = useState(false);
  const [chromaPerColor, setChromaPerColor] = useState<number[]>([62, 62, 62, 62, 62, 62]);
  const [darkChromaPerColor, setDarkChromaPerColor] = useState<number[]>([36, 36, 36, 36, 36, 36]);
  const [chromaEditIndex, setChromaEditIndex] = useState<number | null>(null);
  const [customEditing, setCustomEditing] = useState(false);
  const [toneMode, setToneMode] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hex editor modal
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which top colors are locked (index → exact hex)
  const [lockedColorMap, setLockedColorMap] = useState<Record<number, string>>({});
  const [hexEditIndex, setHexEditIndex] = useState<number | null>(null);
  const [hexEditValue, setHexEditValue] = useState('');
  const [hexEditSource, setHexEditSource] = useState<'top' | 'additional'>('top');
  const [hexLocked, setHexLocked] = useState(false);
  const [hexError, setHexError] = useState<string | null>(null);

  const openHexEditor = (hex: string, index: number, source: 'top' | 'additional') => {
    setHexEditValue(hex);
    setHexEditIndex(index);
    setHexEditSource(source);
    setHexLocked(source === 'top' && !!lockedColorMap[index]);
    setHexError(null);
  };

  const validateHexForLock = (hex: string): { error: string | null; suggested: string | null } => {
    try {
      const [l, c, h] = chroma(hex).lch();
      const blackContrast = chroma.contrast(hex, '#000000');
      const whiteContrast = chroma.contrast(hex, '#ffffff');
      if (blackContrast < 4.5 && whiteContrast < 4.5) {
        return { error: `Neither black (${blackContrast.toFixed(1)}:1) nor white (${whiteContrast.toFixed(1)}:1) text meets WCAG AA contrast (4.5:1) on this color. Consider adjusting the lightness.`, suggested: null };
      }
      const peakChroma = getNaturalPeakChroma(hex);
      if (c > peakChroma) {
        const suggested = chroma.lch(l, peakChroma, h).hex();
        return { error: `Chroma ${c.toFixed(0)} exceeds the safe maximum (${peakChroma.toFixed(0)}) for this hue. Try ${suggested} instead.`, suggested };
      }
      return { error: null, suggested: null };
    } catch {
      return { error: 'Invalid color value.', suggested: null };
    }
  };

  const applyHexEdit = () => {
    if (!hexEditValue.match(/^#[0-9a-fA-F]{6}$/)) {
      setHexError('Enter a valid 6-digit hex (e.g. #A1B2C3)');
      return;
    }
    if (hexLocked) {
      const { error: lockErr } = validateHexForLock(hexEditValue);
      if (lockErr) { setHexError(lockErr); return; }
    }
    if (hexEditSource === 'top' && hexEditIndex !== null) {
      setTopColors(prev => {
        const next = [...prev];
        next[hexEditIndex] = { ...next[hexEditIndex], hex: hexEditValue };
        return next;
      });
      // Track lock state
      if (hexLocked) {
        setLockedColorMap(prev => ({ ...prev, [hexEditIndex]: hexEditValue }));
      } else {
        setLockedColorMap(prev => { const n = { ...prev }; delete n[hexEditIndex]; return n; });
      }
    }
    setHexEditIndex(null);
  };

  // Extract colors on mount
  useEffect(() => {
    if (!moodBoardUrl) {
      setError('No mood board uploaded');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function extract() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await extractColorsFromImage(moodBoardUrl!);
        if (cancelled) return;
        setColorData(data);
        setTopColors([...data.topColors]);
        onTopColorsExtracted?.([...data.topColors]);
        // Initialize chroma per color from natural peak chroma across all tones
        const peakChromas = data.topColors.map(c => getNaturalPeakChroma(c.hex));
        setChromaPerColor(peakChromas.map(c => Math.min(c, 70)));
        setDarkChromaPerColor(peakChromas.map(c => Math.min(c, 42)));
      } catch (err) {
        if (!cancelled) {
          setError('Failed to extract colors. Try a different image.');
          console.error(err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    extract();
    return () => { cancelled = true; };
  }, [moodBoardUrl]);

  const handleSwap = useCallback((replacement: ExtractedColor) => {
    if (swapIndex === null) return;
    setTopColors(prev => {
      const next = [...prev];
      next[swapIndex] = replacement;
      return next;
    });
    setSwapIndex(null);
  }, [swapIndex]);

  const regenerateSchemes = useCallback((
    tops: ExtractedColor[],
    pIdx: number,
    lChroma?: number[],
    dChroma?: number[],
  ) => {
    const lc = lChroma || chromaPerColor;
    const dc = dChroma || darkChromaPerColor;
    const primary = tops[pIdx].hex;
    const others = tops.filter((_, i) => i !== pIdx).map(c => c.hex);
    const reordered = [primary, ...others];
    // Build locked colors array: [primary locked hex, secondary locked hex, ...]
    const locked: (string | undefined)[] = [
      lockedColorMap[pIdx],
      ...tops.filter((_, i) => i !== pIdx).map((_, i) => {
        const origIdx = i >= pIdx ? i + 1 : i;
        return lockedColorMap[origIdx];
      }),
    ];
    const generated = generateColorSchemes(reordered, lc[pIdx], dc[pIdx], locked);
    setSchemes(generated);
    onSchemesGenerated?.(generated);
    if (selectedScheme) {
      const updated = generated.find(s => s.name === selectedScheme.name);
      onSchemeSelected(updated || generated[0]);
    } else {
      onSchemeSelected(generated[0]);
    }
  }, [selectedScheme, onSchemeSelected, chromaPerColor, darkChromaPerColor, lockedColorMap]);

  const handleGenerateThemes = useCallback(() => {
    regenerateSchemes(topColors, primaryIndex);
    setStep('theme');
  }, [topColors, primaryIndex, regenerateSchemes]);

  // Register custom back handler: theme step → extraction, extraction → previous stage
  useEffect(() => {
    if (step === 'theme') {
      onCustomBackChange?.(() => setStep('extraction'));
    } else {
      onCustomBackChange?.(null);
    }
    return () => onCustomBackChange?.(null);
  }, [step, onCustomBackChange]);

  // Register custom next handler: extraction → generate themes, theme → next stage
  useEffect(() => {
    if (step === 'extraction') {
      onCustomNextChange?.(() => {
        regenerateSchemes(topColors, primaryIndex);
        setStep('theme');
      });
      onNextLabelChange?.('Generate Themes');
    } else {
      onCustomNextChange?.(null);
      onNextLabelChange?.(null);
    }
    return () => { onCustomNextChange?.(null); onNextLabelChange?.(null); };
  }, [step, topColors, primaryIndex, regenerateSchemes, onCustomNextChange, onNextLabelChange]);

  if (isLoading) {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
        <CircularProgress color="default" />
        <Body>Extracting colors from your mood board...</Body>
      </VStack>
    );
  }

  if (error || !colorData) {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
        <H2 style={{ textAlign: 'center' }}>Color Extraction</H2>
        <Body style={{ color: 'var(--Buttons-Error-Button)' }}>{error || 'No data'}</Body>
        <Button variant="outline" color="default" onClick={onBack}>Back</Button>
      </VStack>
    );
  }

  // ─── Step 1: Color Extraction ───
  if (step === 'extraction') {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '40px 24px' }}>
        <H2 style={{ textAlign: 'center' }}>Color Extraction</H2>

        {/* Mood board image */}
        {moodBoardUrl && (
          <img
            src={moodBoardUrl}
            alt="Mood board"
            style={{
              maxWidth: 500,
              width: '100%',
              maxHeight: 240,
              objectFit: 'cover',
              borderRadius: 'var(--Card-Radius, 14px)',
            }}
          />
        )}

        {/* Top Seed Colors */}
        <Card padding="medium" style={{ maxWidth: 500, width: '100%', borderRadius: 'var(--Card-Radius, 14px)' }}>
          <VStack spacing={2}>
            <HStack spacing={1} alignItems="baseline" style={{ justifyContent: 'space-between', width: '100%' }}>
              <H3 sx={{ fontSize: '1rem', flex: 1, width: 'auto' }}>Top Seed Colors</H3>
              <BodySmall sx={{ color: 'var(--Quiet)', flexShrink: 0, whiteSpace: 'nowrap', width: 'auto' }}>
                ({colorData.totalSwatches} swatches detected)
              </BodySmall>
            </HStack>
            <VStack spacing={0}>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Colors sorted by dominance (most to least)</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Color swatches are prioritized</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Click to edit hex · Double-click to select for swap</BodySmall>
            </VStack>

            <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'flex-start' }}>
              {topColors.map((color, i) => {
                const isSwapActive = swapIndex === i;
                return (
                  <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                    <Button
                      swatch
                      swatchColor={color.hex}
                      size="large"
                      onClick={() => {
                        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
                        clickTimer.current = setTimeout(() => { clickTimer.current = null; openHexEditor(color.hex, i, 'top'); }, 250);
                      }}
                      onDoubleClick={() => {
                        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                        setSwapIndex(isSwapActive ? null : i);
                      }}
                      sx={{
                        width: '100%',
                        aspectRatio: '1',
                        height: 'auto',
                        ...(isSwapActive ? { border: '2px solid var(--Buttons-Default-Border)' } : {}),
                      }}
                      title={`${color.hex} — click to edit · double-click to swap`}
                    />
                    {color.isSwatch && (
                      <HStack spacing={0} alignItems="center">
                        <StarIcon style={{ fontSize: 14, color: 'var(--Text-Primary)' }} />
                        <BodySmall style={{ color: 'var(--Text-Primary)', fontSize: '0.65rem', fontWeight: 600 }}>
                          Swatch
                        </BodySmall>
                      </HStack>
                    )}
                    {lockedColorMap[i] && (
                      <HStack spacing={0} alignItems="center">
                        <LockIcon style={{ fontSize: 12, color: 'var(--Text)' }} />
                        <BodySmall style={{ color: 'var(--Text)', fontSize: '0.6rem', fontWeight: 600 }}>
                          Locked
                        </BodySmall>
                      </HStack>
                    )}
                  </VStack>
                );
              })}
            </div>
          </VStack>
        </Card>

        {/* Additional Seed Colors */}
        {colorData.additionalColors.length > 0 && (
          <Card padding="medium" style={{ maxWidth: 500, width: '100%', borderRadius: 'var(--Card-Radius, 14px)' }}>
            <VStack spacing={2}>
              <HStack spacing={1} alignItems="baseline" style={{ justifyContent: 'space-between', width: '100%' }}>
                <H3 sx={{ fontSize: '1rem', flex: 1, width: 'auto' }}>Additional Seed Colors</H3>
                <BodySmall sx={{ color: 'var(--Quiet)', flexShrink: 0, whiteSpace: 'nowrap', width: 'auto' }}>
                  ({colorData.additionalColors.length} available)
                </BodySmall>
              </HStack>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Click any color above, then select from these to swap
              </BodySmall>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
                gap: 8,
              }}>
                {colorData.additionalColors.map((color, i) => (
                  <VStack key={i} spacing={0} alignItems="center">
                    <Button
                      swatch
                      swatchColor={color.hex}
                      size="large"
                      onClick={() => {
                        if (swapIndex !== null) handleSwap(color);
                        else openHexEditor(color.hex, i, 'additional');
                      }}
                      title={swapIndex !== null ? `Click to swap with top color #${swapIndex + 1}` : `${color.hex} — click to view`}
                    />
                    {color.isSwatch && (
                      <StarIcon style={{ fontSize: 10, color: 'var(--Text-Primary)' }} />
                    )}
                  </VStack>
                ))}
              </div>
            </VStack>
          </Card>
        )}

        {/* Generate Themes handled by bottom bar */}

        {/* Hex Editor Modal */}
        <Modal open={hexEditIndex !== null} onClose={() => setHexEditIndex(null)} title="Edit Color">
          <VStack spacing={3} style={{ minWidth: 300 }}>
            {/* Color preview */}
            <div style={{
              width: '100%',
              height: 80,
              borderRadius: 'var(--Style-Border-Radius)',
              background: hexEditValue.match(/^#[0-9a-fA-F]{6}$/) ? hexEditValue : '#ccc',
              border: '1px solid var(--Border)',
            }} />

            {/* Hex input */}
            <TextField
              label="Hex Color"
              value={hexEditValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                let v = e.target.value;
                if (!v.startsWith('#')) v = '#' + v;
                setHexEditValue(v);
                setHexError(null);
              }}
              placeholder="#A1B2C3"
              size="medium"
            />

            {/* LCH info */}
            {hexEditValue.match(/^#[0-9a-fA-F]{6}$/) && (() => {
              const [l, c, h] = chroma(hexEditValue).lch();
              return (
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  L: {l.toFixed(0)} · C: {c.toFixed(0)} · H: {(h || 0).toFixed(0)}°
                </BodySmall>
              );
            })()}

            {/* Lock toggle */}
            {(() => {
              const isValidHex = !!hexEditValue.match(/^#[0-9a-fA-F]{6}$/);
              const validation = isValidHex ? validateHexForLock(hexEditValue) : { error: null, suggested: null };
              const canLock = isValidHex && !validation.error;
              return (
                <>
                  <HStack spacing={1} alignItems="center">
                    <Button
                      variant={hexLocked ? 'default' : 'outline'}
                      size="small"
                      disabled={!canLock && !hexLocked}
                      onClick={() => {
                        if (hexLocked) { setHexLocked(false); setHexError(null); }
                        else { setHexLocked(true); setHexError(null); }
                      }}
                      startIcon={hexLocked ? <LockIcon style={{ fontSize: 14 }} /> : <LockOpenIcon style={{ fontSize: 14 }} />}
                    >
                      {hexLocked ? 'Locked' : 'Lock Color'}
                    </Button>
                    <BodySmall style={{ color: 'var(--Quiet)', flex: 1 }}>
                      Lock ensures this exact hex is used in the generated tones, in light mode
                    </BodySmall>
                  </HStack>

                  {validation.error && (
                    <VStack spacing={1}>
                      <Alert variant="solid" severity="error" size="small">
                        {validation.error}
                      </Alert>
                      {validation.suggested && (
                        <HStack spacing={2} alignItems="center">
                          <div style={{
                            width: 32, height: 32, borderRadius: 'var(--Style-Border-Radius)',
                            backgroundColor: validation.suggested, border: '1px solid var(--Border)', flexShrink: 0,
                          }} />
                          <BodySmall style={{ color: 'var(--Quiet)' }}>Suggested: {validation.suggested}</BodySmall>
                          <Button size="small" variant="outline" onClick={() => setHexEditValue(validation.suggested!)}>
                            Use
                          </Button>
                        </HStack>
                      )}
                    </VStack>
                  )}
                </>
              );
            })()}

            {/* Hex input error */}
            {hexError && (
              <Alert variant="solid" severity="error" size="small">
                {hexError}
              </Alert>
            )}

            {/* Actions */}
            <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
              <Button variant="outline" size="small" onClick={() => setHexEditIndex(null)}>Cancel</Button>
              <Button variant="primary" size="small" onClick={applyHexEdit}>
                {hexEditSource === 'top' ? 'Apply' : 'Close'}
              </Button>
            </HStack>
          </VStack>
        </Modal>
      </VStack>
    );
  }

  // ─── Step 2: Theme Selection ───
  const selectedName = selectedScheme?.name;

  return (
    <VStack spacing={4} style={{ padding: '40px 24px', maxWidth: 500, margin: '0 auto' }}>
      <VStack spacing={1} alignItems="center">
        <H2 style={{ textAlign: 'center' }}>Theme</H2>
        <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
          Select a primary color and a color scheme below.
        </Body>
      </VStack>

      {/* Core Colors + Settings */}
      <Card padding="medium" style={{ width: '100%', borderRadius: 'var(--Card-Radius, 14px)' }}>
        <VStack spacing={3}>
          <VStack spacing={1}>
            <BodySmall style={{ fontWeight: 600 }}>Core Colors</BodySmall>
            <BodySmall style={{ color: 'var(--Quiet)' }}>Click to change</BodySmall>
          </VStack>

          {/* Primary color swatches with radio buttons */}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {topColors.map((color, i) => {
              const isPrimary = i === primaryIndex;
              return (
                <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                  <Button
                    swatch
                    swatchColor={color.hex}
                    size="large"
                    onClick={() => {
                      setPrimaryIndex(i);
                      regenerateSchemes(topColors, i);
                    }}
                    sx={isPrimary ? { border: '2px solid var(--Buttons-Default-Border)' } : {}}
                  />
                  <Radio
                    variant="default-outline"
                    size="small"
                    name="primaryColor"
                    checked={isPrimary}
                    onChange={() => {
                      setPrimaryIndex(i);
                      regenerateSchemes(topColors, i);
                    }}
                  />
                  {isPrimary && (
                    <BodySmall style={{ color: 'var(--Text)', fontWeight: 700, fontSize: '0.65rem', textAlign: 'center' }}>
                      Primary
                    </BodySmall>
                  )}
                </VStack>
              );
            })}
          </div>

          {/* Divider + Show/Hide Settings toggle */}
          <div style={{ borderTop: '1px solid var(--Border)', width: '100%', paddingTop: 12 }}>
            <div
              onClick={() => setShowChromaSettings(!showChromaSettings)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            >
              <span style={{ color: 'var(--Hotlink)', fontSize: '0.8rem', transform: showChromaSettings ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform 0.2s', display: 'inline-block' }}>⌃</span>
              <Link onClick={(e: React.MouseEvent) => e.preventDefault()} style={{ fontSize: '0.875rem' }}>
                {showChromaSettings ? 'Hide Settings' : 'Show Settings'}
              </Link>
            </div>
          </div>

          {/* Expanded: per-color tones + chroma */}
          {showChromaSettings && (
            <VStack spacing={3}>
              <HStack spacing={2}>
                <Button
                  variant={toneMode === 'light' ? 'default' : 'outline'}
                  color="default"
                  size="small"
                  onClick={() => setToneMode('light')}
                >
                  Light Mode
                </Button>
                <Button
                  variant={toneMode === 'dark' ? 'default' : 'outline'}
                  color="default"
                  size="small"
                  onClick={() => setToneMode('dark')}
                >
                  Dark Mode
                </Button>
              </HStack>

              <BodySmall style={{ fontSize: '0.75rem' }}>
                <strong>Click any tone</strong> to update which tone represents each color.
                {' '}(Mode: {toneMode}, Max Chroma: {toneMode === 'light' ? chromaPerColor[0] : darkChromaPerColor[0]})
              </BodySmall>

              {topColors.map((color, colorIdx) => {
                const lc = chromaPerColor[colorIdx] || 62;
                const dc = darkChromaPerColor[colorIdx] || 36;
                const palette = toneMode === 'light'
                  ? generateSemanticLightModeScale(color.hex, lc)
                  : generateSemanticDarkModeScale(color.hex, dc);
                const currentTone = Math.round(getLightness(color.hex));
                const currentColorN = toneToColorNumber(currentTone);
                const naturalChroma = getNaturalPeakChroma(color.hex);
                const colorName = colorIdx === primaryIndex
                  ? `Primary – ${getColorDescription(color.hex)}`
                  : getColorDescription(color.hex);
                const isChromaOpen = chromaEditIndex === colorIdx;

                return (
                  <VStack key={colorIdx} spacing={1}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <Body style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>
                        {colorName}
                      </Body>
                      <Link
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          setChromaEditIndex(isChromaOpen ? null : colorIdx);
                        }}
                        style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                      >
                        {isChromaOpen ? 'Close' : 'Adjust Chroma'}
                      </Link>
                    </div>

                    {/* Tone palette */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {palette.map((step, i) => {
                        const isCurrentTone = step.colorNumber === currentColorN;
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <div
                              style={{
                                width: '100%',
                                height: 24,
                                background: step.hex,
                                cursor: toneMode === 'light' ? 'pointer' : 'default',
                                borderRadius: 4,
                                outline: isCurrentTone ? '2px solid var(--Focus-Visible)' : 'none',
                                outlineOffset: isCurrentTone ? 1 : 0,
                              }}
                              title={`Color-${step.colorNumber}: ${step.hex}`}
                              onClick={() => {
                                if (toneMode === 'dark') return;
                                const updated = [...topColors];
                                updated[colorIdx] = { ...updated[colorIdx], hex: step.hex };
                                setTopColors(updated);
                                regenerateSchemes(updated, primaryIndex);
                              }}
                            />
                            {isCurrentTone && (
                              <span style={{ fontSize: '0.55rem', color: 'var(--Quiet)', whiteSpace: 'nowrap' }}>
                                {colorIdx === primaryIndex ? 'Primary' : ['Secondary', 'Tertiary'][colorIdx - (primaryIndex < colorIdx ? 1 : 0)] || `Color ${colorIdx + 1}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-color chroma editor */}
                    {isChromaOpen && (
                      <VStack spacing={2} style={{
                        padding: 12,
                        border: '1px solid var(--Border)',
                        borderRadius: 'var(--Style-Border-Radius)',
                        width: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <BodySmall style={{ fontWeight: 600 }}>
                            Max Chroma ({toneMode === 'light' ? 'Light' : 'Dark'}) ({toneMode === 'light' ? lc : dc})
                          </BodySmall>
                          <span style={{ color: 'var(--Icons-Info)', fontSize: '0.85rem', cursor: 'help', flexShrink: 0 }} title="Chroma controls color saturation. This color's natural chroma is the maximum it can reach.">ⓘ</span>
                          <Link onClick={(e: React.MouseEvent) => e.preventDefault()} style={{ fontSize: '0.7rem' }}>
                            What is Chroma?
                          </Link>
                        </div>
                        <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
                          Natural chroma: {naturalChroma}. Colors above the max will be desaturated.
                        </BodySmall>
                        <Slider
                          min={20}
                          max={toneMode === 'light' ? 70 : 42}
                          value={toneMode === 'light' ? lc : dc}
                          onChange={(_: any, val: number | number[]) => {
                            const v = val as number;
                            if (toneMode === 'light') {
                              const updatedChroma = [...chromaPerColor];
                              updatedChroma[colorIdx] = v;
                              setChromaPerColor(updatedChroma);
                              regenerateSchemes(topColors, primaryIndex, updatedChroma, undefined);
                            } else {
                              const updatedChroma = [...darkChromaPerColor];
                              updatedChroma[colorIdx] = v;
                              setDarkChromaPerColor(updatedChroma);
                              regenerateSchemes(topColors, primaryIndex, undefined, updatedChroma);
                            }
                          }}
                          size="small"
                          valueLabelDisplay="auto"
                        />
                        <HStack justifyContent="space-between">
                          <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>20</BodySmall>
                          <BodySmall style={{ color: 'var(--Buttons-Default-Button)', fontSize: '0.65rem' }}>
                            {naturalChroma} (natural)
                          </BodySmall>
                          <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
                            {toneMode === 'light' ? '70' : '42'}
                          </BodySmall>
                        </HStack>
                        <Button
                          variant="outline"
                          color="default"
                          size="small"
                          onClick={() => {
                            if (toneMode === 'light') {
                              const updatedChroma = [...chromaPerColor];
                              updatedChroma[colorIdx] = Math.min(naturalChroma, 70);
                              setChromaPerColor(updatedChroma);
                              regenerateSchemes(topColors, primaryIndex, updatedChroma, undefined);
                            } else {
                              const updatedChroma = [...darkChromaPerColor];
                              updatedChroma[colorIdx] = Math.min(naturalChroma, 42);
                              setDarkChromaPerColor(updatedChroma);
                              regenerateSchemes(topColors, primaryIndex, undefined, updatedChroma);
                            }
                          }}
                        >
                          Reset to Natural
                        </Button>
                      </VStack>
                    )}
                  </VStack>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Card>

      {/* Scheme cards */}
      <VStack spacing={2} style={{ width: '100%' }}>
        {schemes.map((scheme) => {
          const isSelected = selectedName === scheme.name;
          const isCustom = scheme.name === 'Custom';

          return (
            <Card
              key={scheme.name}
              padding="medium"
              style={{
                width: '100%',
                borderRadius: 'var(--Card-Radius, 14px)',
                outline: isSelected
                  ? '2px solid var(--Buttons-Default-Border)'
                  : '1px solid var(--Border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onSchemeSelected(scheme)}
            >
              <VStack spacing={2}>
                <HStack spacing={2} alignItems="center">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onSchemeSelected(scheme)}
                    color="default"
                    size="small"
                  />
                  <Body style={{ fontWeight: 600 }}>{scheme.name}</Body>
                </HStack>

                {/* 3 color swatches */}
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  {(['primary', 'secondary', 'tertiary'] as const).map((role, i) => {
                    const displayColor = scheme.colors[i];
                    const label = ['Primary', 'Secondary', 'Tertiary'][i];
                    return (
                      <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                        <Button
                          swatch
                          swatchColor={displayColor}
                          size="large"
                          sx={{ width: '100%', height: 56 }}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (isCustom) setCustomEditing(true);
                          }}
                        />
                        <BodySmall style={{ fontWeight: 600, fontSize: '0.7rem' }}>{label}</BodySmall>
                      </VStack>
                    );
                  })}
                </div>

                {/* Custom: edit toggle to pick colors */}
                {isCustom && (
                  <VStack spacing={2}>
                    <Link
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCustomEditing(!customEditing);
                      }}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {customEditing ? 'Done' : 'Edit Colors'}
                    </Link>

                    {customEditing && (
                      <VStack spacing={2}>
                        <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                          Pick from your core colors for each role.
                        </BodySmall>
                        {(['Primary', 'Secondary', 'Tertiary']).map((roleLabel, roleIdx) => (
                          <VStack key={roleLabel} spacing={1}>
                            <BodySmall style={{ fontWeight: 600, fontSize: '0.7rem' }}>{roleLabel}</BodySmall>
                            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                              {topColors.map((tc, tcIdx) => {
                                const isChosen = scheme.colors[roleIdx] === tc.hex;
                                return (
                                  <div
                                    key={tcIdx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newColors = [...scheme.colors] as [string, string, string];
                                      newColors[roleIdx] = tc.hex;
                                      const updated: ColorScheme = {
                                        ...scheme,
                                        colors: newColors,
                                        extractedTones: {
                                          primary: getLightness(newColors[0]),
                                          secondary: getLightness(newColors[1]),
                                          tertiary: getLightness(newColors[2]),
                                        },
                                        tonePalettes: {
                                          primary: generateSemanticLightModeScale(newColors[0], chromaPerColor[0]),
                                          secondary: generateSemanticLightModeScale(newColors[1], chromaPerColor[1]),
                                          tertiary: generateSemanticLightModeScale(newColors[2], chromaPerColor[2]),
                                        },
                                        darkModeTonePalettes: {
                                          primary: generateSemanticDarkModeScale(newColors[0], darkChromaPerColor[0]),
                                          secondary: generateSemanticDarkModeScale(newColors[1], darkChromaPerColor[1]),
                                          tertiary: generateSemanticDarkModeScale(newColors[2], darkChromaPerColor[2]),
                                        },
                                      };
                                      onSchemeSelected(updated);
                                      setSchemes(prev => prev.map(s => s.name === 'Custom' ? updated : s));
                                    }}
                                    style={{
                                      flex: 1,
                                      height: 36,
                                      borderRadius: 'var(--Style-Border-Radius)',
                                      background: tc.hex,
                                      cursor: 'pointer',
                                      outline: isChosen ? '2px solid var(--Focus-Visible)' : 'none',
                                      outlineOffset: isChosen ? 1 : 0,
                                    }}
                                    title={tc.hex}
                                  />
                                );
                              })}
                            </div>
                          </VStack>
                        ))}
                      </VStack>
                    )}
                  </VStack>
                )}
              </VStack>
            </Card>
          );
        })}
      </VStack>

      {/* Navigation handled by CreationTopBar — Back goes to extraction step first */}
    </VStack>
  );
}
