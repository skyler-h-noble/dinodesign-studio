import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
  CircularProgress, Checkbox,
} from '@dynodesign/components';
import { useState, useEffect, useCallback } from 'react';
import { extractColorsFromImage } from '../../utils/imageAnalysis';
import { generateColorSchemes } from '../../utils/colorSchemes';
import { getLightness } from '../../utils/colorScale';
import type { StageProps, ColorScheme } from '../../types';
import type { ExtractedColorData } from '../../utils/imageAnalysis';

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
  const [topColors, setTopColors] = useState<string[]>([]);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [schemes, setSchemes] = useState<ColorScheme[]>([]);
  const [expandedScheme, setExpandedScheme] = useState<string | null>(null);
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

  // Handle swapping a top color with an additional color
  const handleSwap = useCallback((replacementColor: string) => {
    if (swapIndex === null) return;
    setTopColors(prev => {
      const next = [...prev];
      next[swapIndex] = replacementColor;
      return next;
    });
    setSwapIndex(null);
  }, [swapIndex]);

  // Generate themes from top colors with selected primary
  const handleGenerateThemes = useCallback(() => {
    // Reorder: primary first, then remaining top colors for secondary/tertiary
    const primary = topColors[primaryIndex];
    const others = topColors.filter((_, i) => i !== primaryIndex);
    const reordered = [primary, ...others];
    const generated = generateColorSchemes(reordered);
    setSchemes(generated);
    if (!selectedScheme) {
      onSchemeSelected(generated[0]);
    }
    setStep('theme');
  }, [topColors, primaryIndex, selectedScheme, onSchemeSelected]);

  if (isLoading) {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
        <CircularProgress color="primary" />
        <Body>Extracting colors from your mood board...</Body>
      </VStack>
    );
  }

  if (error || !colorData) {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
        <H2>Color Extraction</H2>
        <Body style={{ color: 'var(--Buttons-Error-Button)' }}>{error || 'No data'}</Body>
        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
      </VStack>
    );
  }

  // ─── Step 1: Color Extraction ───
  if (step === 'extraction') {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '40px 24px' }}>
        <H2>Color Extraction</H2>

        {/* Top Seed Colors */}
        <Card padding="medium" style={{ maxWidth: 640, width: '100%' }}>
          <VStack spacing={2}>
            <HStack spacing={1} alignItems="baseline">
              <H3 style={{ fontSize: '1rem' }}>Top Seed Colors</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                ({colorData.totalSwatches} swatches detected)
              </BodySmall>
            </HStack>
            <VStack spacing={0}>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Colors sorted by dominance (most to least)</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Click on a color to swap it</BodySmall>
            </VStack>

            <HStack spacing={2} style={{ flexWrap: 'wrap' }}>
              {topColors.map((color, i) => {
                const isSwapActive = swapIndex === i;
                return (
                  <VStack key={i} spacing={1} alignItems="center">
                    <div
                      onClick={() => setSwapIndex(isSwapActive ? null : i)}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 'var(--Style-Border-Radius)',
                        background: color,
                        cursor: 'pointer',
                        outline: isSwapActive
                          ? '3px solid var(--Buttons-Primary-Button)'
                          : '1px solid var(--Border)',
                        outlineOffset: isSwapActive ? 2 : 0,
                        transition: 'all 0.15s ease',
                      }}
                      title={`${color} — click to swap`}
                    />
                    <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.6rem' }}>
                      Swatch
                    </BodySmall>
                  </VStack>
                );
              })}
            </HStack>
          </VStack>
        </Card>

        {/* Additional Seed Colors */}
        {colorData.additionalColors.length > 0 && (
          <Card padding="medium" style={{ maxWidth: 640, width: '100%' }}>
            <VStack spacing={2}>
              <HStack spacing={1} alignItems="baseline">
                <H3 style={{ fontSize: '1rem' }}>Additional Seed Colors</H3>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  ({colorData.additionalColors.length} available)
                </BodySmall>
              </HStack>
              {swapIndex !== null && (
                <BodySmall style={{ color: 'var(--Buttons-Primary-Button)' }}>
                  Click any color above, then select from these to swap
                </BodySmall>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                  gap: 8,
                }}
              >
                {colorData.additionalColors.map((color, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (swapIndex !== null) handleSwap(color);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--Style-Border-Radius)',
                      background: color,
                      cursor: swapIndex !== null ? 'pointer' : 'default',
                      border: '1px solid var(--Border)',
                      opacity: swapIndex !== null ? 1 : 0.7,
                      transition: 'all 0.15s ease',
                    }}
                    title={color}
                  />
                ))}
              </div>
            </VStack>
          </Card>
        )}

        <Button color="primary" fullWidth style={{ maxWidth: 640 }} onClick={handleGenerateThemes}>
          Generate Themes
        </Button>

        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
      </VStack>
    );
  }

  // ─── Step 2: Theme Selection ───
  const selectedName = selectedScheme?.name;

  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '40px 24px' }}>
      <VStack spacing={1} alignItems="center">
        <H2>Theme</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Select a primary color and a color scheme below.
        </Body>
      </VStack>

      {/* Primary Color selector - top 6 */}
      <Card padding="medium" style={{ maxWidth: 640, width: '100%' }}>
        <VStack spacing={2}>
          <HStack spacing={1} alignItems="baseline">
            <BodySmall style={{ fontWeight: 600 }}>Primary Color</BodySmall>
            <BodySmall style={{ color: 'var(--Quiet)' }}>(Click to change)</BodySmall>
          </HStack>
          <HStack spacing={2}>
            {topColors.map((color, i) => {
              const isPrimary = i === primaryIndex;
              return (
                <VStack key={i} spacing={1} alignItems="center">
                  <div
                    onClick={() => {
                      setPrimaryIndex(i);
                      // Regenerate schemes with new primary
                      const primary = topColors[i];
                      const others = topColors.filter((_, idx) => idx !== i);
                      const reordered = [primary, ...others];
                      const generated = generateColorSchemes(reordered);
                      setSchemes(generated);
                      // Keep same scheme name selected
                      if (selectedScheme) {
                        const updated = generated.find(s => s.name === selectedScheme.name);
                        onSchemeSelected(updated || generated[0]);
                      } else {
                        onSchemeSelected(generated[0]);
                      }
                    }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 'var(--Style-Border-Radius)',
                      background: color,
                      cursor: 'pointer',
                      outline: isPrimary
                        ? '3px solid var(--Buttons-Primary-Button)'
                        : '1px solid var(--Border)',
                      outlineOffset: isPrimary ? 2 : 0,
                      transition: 'all 0.15s ease',
                    }}
                  />
                  <input
                    type="radio"
                    name="primaryColor"
                    checked={isPrimary}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--Buttons-Primary-Button)', cursor: 'pointer' }}
                  />
                </VStack>
              );
            })}
          </HStack>
        </VStack>
      </Card>

      {/* Color Scheme cards */}
      <VStack spacing={2} style={{ maxWidth: 640, width: '100%' }}>
        <H3>Color Saturation</H3>

        {schemes.map((scheme) => {
          const isSelected = selectedName === scheme.name;
          const isExpanded = expandedScheme === scheme.name;

          return (
            <Card
              key={scheme.name}
              padding="medium"
              style={{
                outline: isSelected
                  ? '2px solid var(--Buttons-Primary-Button)'
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
                    color="primary"
                    size="small"
                  />
                  <Body style={{ fontWeight: 600 }}>{scheme.name}</Body>
                </HStack>

                {/* 3 color swatches with labels */}
                <HStack spacing={3} justifyContent="flex-start">
                  {scheme.colors.map((color, i) => {
                    const tone = Math.round(getLightness(color));
                    const label = ['Primary', 'Secondary', 'Tertiary'][i];
                    return (
                      <VStack key={i} spacing={1} alignItems="center">
                        <div
                          style={{
                            width: 80,
                            height: 56,
                            borderRadius: 'var(--Style-Border-Radius)',
                            background: color,
                            border: '1px solid var(--Border)',
                          }}
                        />
                        <BodySmall style={{ fontWeight: 600, fontSize: '0.7rem' }}>
                          {label}
                        </BodySmall>
                        <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
                          {tone}
                        </BodySmall>
                      </VStack>
                    );
                  })}
                </HStack>

                {/* Show tones toggle */}
                <BodySmall
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setExpandedScheme(isExpanded ? null : scheme.name);
                  }}
                  style={{
                    color: 'var(--Hotlink)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {isExpanded ? 'Hide tones' : 'Show tones'}
                </BodySmall>

                {/* Expanded tone palettes */}
                {isExpanded && (
                  <VStack spacing={1}>
                    {(['primary', 'secondary', 'tertiary'] as const).map((role) => (
                      <VStack key={role} spacing={0}>
                        <BodySmall style={{ textTransform: 'capitalize', fontSize: '0.65rem', fontWeight: 600 }}>
                          {role}
                        </BodySmall>
                        <HStack spacing={0}>
                          {scheme.tonePalettes[role].map((step, i) => (
                            <div
                              key={i}
                              title={`Color-${step.colorNumber}: ${step.hex}`}
                              style={{
                                flex: 1,
                                height: 24,
                                background: step.hex,
                                borderRadius:
                                  i === 0 ? '3px 0 0 3px'
                                    : i === 13 ? '0 3px 3px 0'
                                      : 0,
                              }}
                            />
                          ))}
                        </HStack>
                      </VStack>
                    ))}
                  </VStack>
                )}
              </VStack>
            </Card>
          );
        })}
      </VStack>

      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={() => setStep('extraction')}>
          Back
        </Button>
        <Button color="primary" onClick={onNext} disabled={!selectedScheme}>
          Next
        </Button>
      </HStack>
    </VStack>
  );
}
