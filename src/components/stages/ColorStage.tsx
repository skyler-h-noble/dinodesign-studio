import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
  CircularProgress, Checkbox, Link,
} from '@dynodesign/components';
import StarIcon from '@mui/icons-material/Star';
import { useState, useEffect, useCallback } from 'react';
import { extractColorsFromImage } from '../../utils/imageAnalysis';
import { generateColorSchemes } from '../../utils/colorSchemes';
import { getLightness, getChroma, toneToColorNumber, generateSemanticLightModeScale, generateSemanticDarkModeScale } from '../../utils/colorScale';
import { getColorDescription } from '../../utils/colorNaming';
import type { StageProps, ColorScheme } from '../../types';
import type { ExtractedColorData, ExtractedColor } from '../../utils/imageAnalysis';

type ColorStep = 'extraction' | 'theme';

interface Props extends StageProps {
  moodBoardUrl: string | null;
  onSchemeSelected: (scheme: ColorScheme) => void;
  selectedScheme: ColorScheme | null;
}

export default function ColorStage({
  onNext,
  onBack,
  moodBoardUrl,
  onSchemeSelected,
  selectedScheme,
}: Props) {
  const [step, setStep] = useState<ColorStep>('extraction');
  const [colorData, setColorData] = useState<ExtractedColorData | null>(null);
  const [topColors, setTopColors] = useState<ExtractedColor[]>([]);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [schemes, setSchemes] = useState<ColorScheme[]>([]);
  const [showChromaSettings, setShowChromaSettings] = useState(false);
  const [chromaPerColor, setChromaPerColor] = useState<number[]>([62, 62, 62, 62, 62, 62]);
  const [darkChromaPerColor, setDarkChromaPerColor] = useState<number[]>([36, 36, 36, 36, 36, 36]);
  const [chromaEditIndex, setChromaEditIndex] = useState<number | null>(null);
  const [customEditing, setCustomEditing] = useState(false);
  const [toneMode, setToneMode] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Initialize chroma per color from natural chroma values
        const naturalChromas = data.topColors.map(c => Math.round(getChroma(c.hex)));
        setChromaPerColor(naturalChromas.map(c => Math.min(c, 70)));
        setDarkChromaPerColor(naturalChromas.map(c => Math.min(c, 42)));
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
    // Use the primary color's chroma for scheme generation
    const generated = generateColorSchemes(reordered, lc[pIdx], dc[pIdx]);
    setSchemes(generated);
    if (selectedScheme) {
      const updated = generated.find(s => s.name === selectedScheme.name);
      onSchemeSelected(updated || generated[0]);
    } else {
      onSchemeSelected(generated[0]);
    }
  }, [selectedScheme, onSchemeSelected, chromaPerColor, darkChromaPerColor]);

  const handleGenerateThemes = useCallback(() => {
    regenerateSchemes(topColors, primaryIndex);
    setStep('theme');
  }, [topColors, primaryIndex, regenerateSchemes]);

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
        <H2>Color Extraction</H2>
        <Body style={{ color: 'var(--Buttons-Error-Button)' }}>{error || 'No data'}</Body>
        <Button variant="outline" color="default" onClick={onBack}>Back</Button>
      </VStack>
    );
  }

  // ─── Step 1: Color Extraction ───
  if (step === 'extraction') {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '40px 24px' }}>
        <H2>Color Extraction</H2>

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
            <HStack spacing={1} alignItems="baseline">
              <H3 style={{ fontSize: '1rem' }}>Top Seed Colors</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                ({colorData.totalSwatches} swatches detected)
              </BodySmall>
            </HStack>
            <VStack spacing={0}>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Colors sorted by dominance (most to least)</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Color swatches are prioritized</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Click on a color to swap it</BodySmall>
            </VStack>

            <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'flex-start' }}>
              {topColors.map((color, i) => {
                const isSwapActive = swapIndex === i;
                return (
                  <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                    <div
                      onClick={() => setSwapIndex(isSwapActive ? null : i)}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 'var(--Style-Border-Radius)',
                        background: color.hex,
                        cursor: 'pointer',
                        outline: isSwapActive
                          ? '3px solid var(--Buttons-Default-Border)'
                          : 'none',
                        outlineOffset: isSwapActive ? 2 : 0,
                        transition: 'all 0.15s ease',
                      }}
                      title={`${color.hex} — click to swap`}
                    />
                    {color.isSwatch && (
                      <HStack spacing={0} alignItems="center">
                        <StarIcon style={{ fontSize: 14, color: 'var(--Buttons-Primary-Button)' }} />
                        <BodySmall style={{ color: 'var(--Buttons-Primary-Button)', fontSize: '0.65rem', fontWeight: 600 }}>
                          Swatch
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
              <HStack spacing={1} alignItems="baseline">
                <H3 style={{ fontSize: '1rem' }}>Additional Seed Colors</H3>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
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
                    <div
                      onClick={() => { if (swapIndex !== null) handleSwap(color); }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--Style-Border-Radius)',
                        background: color.hex,
                        cursor: swapIndex !== null ? 'pointer' : 'default',
                        border: swapIndex !== null ? '2px solid var(--Buttons-Primary-Button)' : '1px solid var(--Border)',
                        opacity: swapIndex !== null ? 1 : 0.7,
                        transition: 'all 0.15s ease',
                        boxShadow: swapIndex !== null ? '0 0 0 1px var(--Buttons-Primary-Button)' : 'none',
                      }}
                      title={swapIndex !== null ? `Click to swap with top color #${swapIndex + 1}` : color.hex}
                    />
                    {color.isSwatch && (
                      <StarIcon style={{ fontSize: 10, color: 'var(--Buttons-Primary-Button)' }} />
                    )}
                  </VStack>
                ))}
              </div>
            </VStack>
          </Card>
        )}

        <Button color="default" fullWidth style={{ maxWidth: 500 }} onClick={handleGenerateThemes}>
          Generate Themes
        </Button>
        <Button variant="outline" color="default" onClick={onBack}>Back</Button>
      </VStack>
    );
  }

  // ─── Step 2: Theme Selection ───
  const selectedName = selectedScheme?.name;

  return (
    <VStack spacing={4} style={{ padding: '40px 24px', maxWidth: 500, margin: '0 auto' }}>
      <VStack spacing={1}>
        <H2>Theme</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Select a primary color and a color scheme below.
        </Body>
      </VStack>

      {/* Core Colors + Settings */}
      <Card padding="medium" style={{ maxWidth: 500, width: '100%', borderRadius: 'var(--Card-Radius, 14px)' }}>
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
                  <div
                    onClick={() => {
                      setPrimaryIndex(i);
                      regenerateSchemes(topColors, i);
                    }}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 'var(--Style-Border-Radius)',
                      background: color.hex,
                      cursor: 'pointer',
                      outline: isPrimary
                        ? '3px solid var(--Buttons-Default-Button)'
                        : 'none',
                      outlineOffset: isPrimary ? 2 : 0,
                      transition: 'all 0.15s ease',
                    }}
                  />
                  {isPrimary && (
                    <BodySmall style={{ color: 'var(--Buttons-Default-Button)', fontWeight: 700, fontSize: '0.65rem', textAlign: 'center' }}>
                      Primary
                    </BodySmall>
                  )}
                  <input
                    type="radio"
                    name="primaryColor"
                    checked={isPrimary}
                    onChange={() => {
                      setPrimaryIndex(i);
                      regenerateSchemes(topColors, i);
                    }}
                    style={{ accentColor: 'var(--Buttons-Default-Button)', cursor: 'pointer' }}
                  />
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
                  variant={toneMode === 'light' ? 'solid' : 'outline'}
                  color="default"
                  size="small"
                  onClick={() => setToneMode('light')}
                >
                  Light Mode
                </Button>
                <Button
                  variant={toneMode === 'dark' ? 'solid' : 'outline'}
                  color="default"
                  size="small"
                  onClick={() => setToneMode('dark')}
                >
                  Dark Mode
                </Button>
              </HStack>

              <BodySmall style={{ fontSize: '0.75rem' }}>
                <strong>Click any tone</strong> to update which tone represents each color.
              </BodySmall>

              {topColors.map((color, colorIdx) => {
                const lc = chromaPerColor[colorIdx] || 62;
                const dc = darkChromaPerColor[colorIdx] || 36;
                const palette = toneMode === 'light'
                  ? generateSemanticLightModeScale(color.hex, lc)
                  : generateSemanticDarkModeScale(color.hex, dc);
                const currentTone = Math.round(getLightness(color.hex));
                const currentColorN = toneToColorNumber(currentTone);
                const naturalChroma = Math.round(getChroma(color.hex));
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
                              minWidth: 24,
                              height: 24,
                              flex: 1,
                              background: step.hex,
                              cursor: 'pointer',
                              borderRadius: 4,
                              outline: isCurrentTone ? '2px solid var(--Focus-Visible)' : 'none',
                              outlineOffset: isCurrentTone ? 1 : 0,
                            }}
                            title={`Color-${step.colorNumber}: ${step.hex}`}
                            onClick={() => {
                              const updated = [...topColors];
                              updated[colorIdx] = { ...updated[colorIdx], hex: step.hex };
                              setTopColors(updated);
                              regenerateSchemes(updated, primaryIndex);
                            }}
                          />
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
                        <input
                          type="range"
                          min={20}
                          max={toneMode === 'light' ? 70 : 42}
                          value={toneMode === 'light' ? lc : dc}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (toneMode === 'light') {
                              const updatedChroma = [...chromaPerColor];
                              updatedChroma[colorIdx] = val;
                              setChromaPerColor(updatedChroma);
                              regenerateSchemes(topColors, primaryIndex, updatedChroma, undefined);
                            } else {
                              const updatedChroma = [...darkChromaPerColor];
                              updatedChroma[colorIdx] = val;
                              setDarkChromaPerColor(updatedChroma);
                              regenerateSchemes(topColors, primaryIndex, undefined, updatedChroma);
                            }
                          }}
                          style={{ width: '100%', accentColor: 'var(--Buttons-Default-Button)' }}
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
                          Reset to Natural ({naturalChroma})
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
      <VStack spacing={2} style={{ maxWidth: 500, width: '100%' }}>
        {schemes.map((scheme) => {
          const isSelected = selectedName === scheme.name;
          const isCustom = scheme.name === 'Custom';

          return (
            <Card
              key={scheme.name}
              padding="medium"
              style={{
                borderRadius: 'var(--Card-Radius, 14px)',
                outline: isSelected
                  ? '2px solid var(--Buttons-Default-Button)'
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
                    const activePalettes = toneMode === 'light' ? scheme.tonePalettes : scheme.darkModeTonePalettes;
                    const tone = Math.round(getLightness(scheme.colors[i]));
                    const colorN = toneToColorNumber(tone);
                    const displayColor = activePalettes[role]?.[colorN - 1]?.hex || scheme.colors[i];
                    const label = ['Primary', 'Secondary', 'Tertiary'][i];
                    return (
                      <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                        <div style={{
                          width: '100%',
                          height: 56,
                          borderRadius: 'var(--Style-Border-Radius)',
                          background: displayColor,
                          border: '1px solid var(--Border)',
                        }} />
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

      <HStack spacing={2}>
        <Button variant="outline" color="default" onClick={() => setStep('extraction')}>Back</Button>
        <Button color="default" onClick={onNext} disabled={!selectedScheme}>Next</Button>
      </HStack>
    </VStack>
  );
}
