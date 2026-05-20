import {
  Button, ButtonGroup, H2, H3, Body, BodySmall, VStack, HStack, Card,
  CircularProgress, Checkbox, Divider, Link, Radio, Modal, TextField, Alert, SliderInput,
} from '@dynodesign/components';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useState, useEffect, useCallback, useRef } from 'react';
import chroma from 'chroma-js';
import { extractColorsFromImage } from '../../utils/imageAnalysis';
import { generateColorSchemes } from '../../utils/colorSchemes';
import { getLightness, toneToColorNumber, generateSemanticLightModeScale, generateSemanticDarkModeScale, getNaturalPeakChroma, getMatchingPeakChroma, findClosestColorN } from '../../utils/colorScale';
import { getColorDescription } from '../../utils/colorNaming';
import type { StageProps, ColorScheme } from '../../types';
import type { ExtractedColorData, ExtractedColor } from '../../utils/imageAnalysis';
import '../../styles/color-stage.css';

type ColorStep = 'extraction' | 'theme';

/** Bundle of per-color customisations that should survive an edit cycle.
 *  Lives outside `colorScheme` because chroma/locks are per-topColor-index
 *  (not per palette role), and the scheme can be regenerated from any of
 *  these without losing the user's tweaks. */
export interface ColorEdits {
  chromaPerColor?: number[];
  darkChromaPerColor?: number[];
  /** Map of topColors index → exact hex the user locked. */
  lockedColorMap?: Record<number, string>;
}

interface Props extends StageProps {
  moodBoardUrl: string | null;
  onSchemeSelected: (scheme: ColorScheme) => void;
  selectedScheme: ColorScheme | null;
  savedSchemes?: ColorScheme[];
  onSchemesGenerated?: (schemes: ColorScheme[]) => void;
  savedTopColors?: ExtractedColor[];
  onTopColorsExtracted?: (colors: ExtractedColor[]) => void;
  /** Restored on /create?id=<uuid> so chroma sliders, locked hexes, and
   *  edited Core Color hexes (already in savedTopColors) survive editing. */
  savedColorEdits?: ColorEdits;
  onColorEditsChange?: (edits: ColorEdits) => void;
  onCustomBackChange?: (handler: (() => void) | null) => void;
  onCustomNextChange?: (handler: (() => void) | null) => void;
  onNextLabelChange?: (label: string | null) => void;
  /** Re-export edit flow: skip image re-analysis, pin to theme step,
   *  and keep the user out of the extraction sub-step. */
  editMode?: boolean;
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
  savedColorEdits,
  onColorEditsChange,
  onCustomBackChange,
  onCustomNextChange,
  onNextLabelChange,
  editMode = false,
}: Props) {
  // Edit flow always lands on the theme step. Otherwise honor the existing
  // rule: theme if a scheme has already been selected, extraction otherwise.
  const [step, setStep] = useState<ColorStep>(
    editMode || selectedScheme ? 'theme' : 'extraction',
  );
  const [colorData, setColorData] = useState<ExtractedColorData | null>(null);
  // Edit flow seeds topColors/anchorColors from the saved scheme's
  // originalColors so the theme step has swatches to render without
  // re-running image analysis.
  const seededFromScheme = (): ExtractedColor[] => {
    if (savedTopColors && savedTopColors.length) return savedTopColors;
    if (editMode && selectedScheme?.originalColors?.length) {
      return selectedScheme.originalColors.map(hex => ({ hex, isSwatch: false }));
    }
    return [];
  };
  const [topColors, setTopColors] = useState<ExtractedColor[]>(seededFromScheme);
  // Anchor colors = the original extracted hexes used for palette generation.
  // topColors[i].hex may shift when the user clicks a different tone, but
  // anchorColors[i] stays put so the generated palette remains stable.
  const [anchorColors, setAnchorColors] = useState<ExtractedColor[]>(seededFromScheme);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [schemes, setSchemes] = useState<ColorScheme[]>(savedSchemes || []);
  const [showChromaSettings, setShowChromaSettings] = useState(false);
  const [chromaPerColor, setChromaPerColor] = useState<number[]>(
    savedColorEdits?.chromaPerColor && savedColorEdits.chromaPerColor.length
      ? savedColorEdits.chromaPerColor
      : [62, 62, 62, 62, 62, 62],
  );
  const [darkChromaPerColor, setDarkChromaPerColor] = useState<number[]>(
    savedColorEdits?.darkChromaPerColor && savedColorEdits.darkChromaPerColor.length
      ? savedColorEdits.darkChromaPerColor
      : [36, 36, 36, 36, 36, 36],
  );
  const [customEditing, setCustomEditing] = useState(false);
  const [toneMode, setToneMode] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hex editor modal
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (clickTimer.current) clearTimeout(clickTimer.current); };
  }, []);
  // Track which top colors are locked (index → exact hex)
  const [lockedColorMap, setLockedColorMap] = useState<Record<number, string>>(
    savedColorEdits?.lockedColorMap || {},
  );
  const [hexEditIndex, setHexEditIndex] = useState<number | null>(null);
  const [hexEditValue, setHexEditValue] = useState('');
  const [hexEditSource, setHexEditSource] = useState<'top' | 'additional'>('top');
  const [hexLocked, setHexLocked] = useState(false);
  const [hexError, setHexError] = useState<string | null>(null);

  // Hue easing overrides per topColors index (separate light/dark mode)
  // hueOverridesByTop[colorIdx] = { light: { darkHue?, lightHue? }, dark: { ... } }
  const [hueOverridesByTop, setHueOverridesByTop] = useState<Record<number, { light?: { darkHue?: number; lightHue?: number }; dark?: { darkHue?: number; lightHue?: number } }>>({});

  // Track narrow viewport for responsive swatch sizing
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Edit modal state — adjusts max chroma + dark hue + light hue for one color
  const [hueEditTopIdx, setHueEditTopIdx] = useState<number | null>(null);
  const [hueEditDarkHue, setHueEditDarkHue] = useState<number>(0);
  const [hueEditLightHue, setHueEditLightHue] = useState<number>(0);
  // Which endpoint is currently being edited (focused), for highlighting in preview
  const [hueEditFocus, setHueEditFocus] = useState<'dark' | 'light' | null>(null);
  // Local slider value during drag — committed to chromaPerColor on release for smooth dragging
  const [chromaDragValue, setChromaDragValue] = useState<number | null>(null);

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
      // Editing the hex explicitly = setting a new anchor for palette generation
      setAnchorColors(prev => {
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

  // Edit flow bootstrap: skip image analysis, populate the scheme list
  // from the seeded topColors so the user has theme variants to choose
  // between immediately. If a previous edit cycle persisted per-color
  // chroma values in savedColorEdits, use those; otherwise re-derive from
  // each color's natural peak so the initial scheme matches what the
  // Settings preview shows.
  useEffect(() => {
    if (!editMode) return;
    setIsLoading(false);
    if (topColors.length === 0) return;
    const hasSavedLight = !!(savedColorEdits?.chromaPerColor && savedColorEdits.chromaPerColor.length === topColors.length);
    const hasSavedDark = !!(savedColorEdits?.darkChromaPerColor && savedColorEdits.darkChromaPerColor.length === topColors.length);
    const lightValues = hasSavedLight
      ? savedColorEdits!.chromaPerColor!
      : topColors.map(c => Math.min(Math.round(getMatchingPeakChroma(c.hex, false)), 70));
    const darkValues = hasSavedDark
      ? savedColorEdits!.darkChromaPerColor!
      : topColors.map(c => Math.min(Math.round(getMatchingPeakChroma(c.hex, true)), 42));
    if (!hasSavedLight) setChromaPerColor(lightValues);
    if (!hasSavedDark) setDarkChromaPerColor(darkValues);
    // Restore primaryIndex from the saved scheme's primary hex. Without
    // this, regeneration uses topColors[0] as primary and the user's "I
    // picked the brown one" intent gets clobbered on every edit cycle.
    const primaryHex = selectedScheme?.colors?.[0]?.toLowerCase();
    let restoredPrimaryIndex = primaryIndex;
    if (primaryHex) {
      const idx = topColors.findIndex(c => c.hex?.toLowerCase() === primaryHex);
      if (idx >= 0 && idx !== primaryIndex) {
        restoredPrimaryIndex = idx;
        setPrimaryIndex(idx);
      }
    }
    if (schemes.length === 0) {
      regenerateSchemes(topColors, restoredPrimaryIndex, lightValues, darkValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push customisation state up so App.tsx can persist it in the next
  // export snapshot (chroma sliders, hex locks). Hex edits to Core Colors
  // are propagated separately via onTopColorsExtracted below.
  useEffect(() => {
    onColorEditsChange?.({
      chromaPerColor,
      darkChromaPerColor,
      lockedColorMap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromaPerColor, darkChromaPerColor, lockedColorMap]);

  // Fire onTopColorsExtracted whenever topColors changes — covers both the
  // initial image extraction AND inline hex edits via the modal — so the
  // edited swatch list is what gets persisted to the snapshot.
  useEffect(() => {
    if (topColors.length === 0) return;
    onTopColorsExtracted?.([...topColors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topColors]);

  // Extract colors on mount
  useEffect(() => {
    // Edit flow: skip image re-analysis. Colors are seeded from the saved
    // scheme's originalColors and the user is locked to the theme step.
    if (editMode) {
      setIsLoading(false);
      return;
    }
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
        setAnchorColors([...data.topColors]);
        // onTopColorsExtracted is fired by the [topColors] effect above
        // whenever topColors changes — no need to call it inline here.
        // Initialize chroma per color so the extracted color sits at its natural
        // chroma in its own palette. User can boost via the edit modal slider.
        const lightPeaks = data.topColors.map(c => getMatchingPeakChroma(c.hex, false));
        const darkPeaks = data.topColors.map(c => getMatchingPeakChroma(c.hex, true));
        setChromaPerColor(lightPeaks.map(c => Math.min(Math.round(c), 70)));
        setDarkChromaPerColor(darkPeaks.map(c => Math.min(Math.round(c), 42)));
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
    anchors?: ExtractedColor[],
  ) => {
    const lc = lChroma || chromaPerColor;
    const dc = dChroma || darkChromaPerColor;
    const anchorsArr = anchors || anchorColors;
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
    // Translate hueOverridesByTop (keyed by topColors index) to reordered scheme indices
    // Reordered: [primary=tops[pIdx], ...tops without pIdx] → indices 0/1/2 in scheme
    const orderedTopIndices = [pIdx, ...tops.map((_, i) => i).filter(i => i !== pIdx)];
    const hueOverridesForScheme: Record<number, { light?: { darkHue?: number; lightHue?: number }; dark?: { darkHue?: number; lightHue?: number } }> = {};
    orderedTopIndices.forEach((origIdx, schemeIdx) => {
      if (hueOverridesByTop[origIdx]) {
        hueOverridesForScheme[schemeIdx] = hueOverridesByTop[origIdx];
      }
    });
    const generated = generateColorSchemes(reordered, lc[pIdx], dc[pIdx], locked, hueOverridesForScheme);

    // Post-process: regenerate each scheme's tonePalettes/darkModeTonePalettes
    // from anchorColors[topIdx] + chromaPerColor[topIdx] + per-color hue easing —
    // exactly the inputs the Settings panel uses to render its tone palettes.
    // Otherwise the same maxChroma (primary's) gets applied to all 3 roles, and
    // the picked-tone hex (which may have shifted away from anchor) drives
    // hue/chroma toward saturated palettes that don't match the visible tones.
    const refined = generated.map(scheme => {
      const roles = scheme.colors.map(colorHex => {
        const topIdx = tops.findIndex(t => t.hex === colorHex);
        if (topIdx < 0) return null;
        const anchorHex = anchorsArr[topIdx]?.hex || colorHex;
        const lightC = lc[topIdx] ?? 62;
        const darkC = dc[topIdx] ?? 36;
        const lockedHex = lockedColorMap[topIdx];
        const easing = hueOverridesByTop[topIdx];
        return {
          light: generateSemanticLightModeScale(anchorHex, lightC, lockedHex, easing?.light),
          dark: generateSemanticDarkModeScale(anchorHex, darkC, easing?.dark),
        };
      });
      if (!roles[0] || !roles[1] || !roles[2]) return scheme;
      return {
        ...scheme,
        tonePalettes: {
          primary: roles[0].light,
          secondary: roles[1].light,
          tertiary: roles[2].light,
        },
        darkModeTonePalettes: {
          primary: roles[0].dark,
          secondary: roles[1].dark,
          tertiary: roles[2].dark,
        },
      };
    });

    setSchemes(refined);
    onSchemesGenerated?.(refined);
    if (selectedScheme) {
      const updated = refined.find(s => s.name === selectedScheme.name);
      onSchemeSelected(updated || refined[0]);
    } else {
      onSchemeSelected(refined[0]);
    }
  }, [selectedScheme, onSchemeSelected, chromaPerColor, darkChromaPerColor, anchorColors, lockedColorMap, hueOverridesByTop]);

  const handleGenerateThemes = useCallback(() => {
    regenerateSchemes(topColors, primaryIndex);
    setStep('theme');
  }, [topColors, primaryIndex, regenerateSchemes]);

  // Register custom back handler: theme step → extraction, extraction → previous stage.
  // In edit mode the extraction sub-step is unreachable, so leave the back
  // handler unset and let App.tsx route Back to /my-designs/{dinoId}.
  useEffect(() => {
    if (step === 'theme' && !editMode) {
      onCustomBackChange?.(() => setStep('extraction'));
    } else {
      onCustomBackChange?.(null);
    }
    return () => onCustomBackChange?.(null);
  }, [step, editMode, onCustomBackChange]);

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

  // Bail with "No data" only when the extraction step actually needs
  // colorData. The theme step is reachable in edit mode from a saved snapshot
  // that has topColors/anchorColors/scheme but no colorData, so don't block it.
  if (error || (!colorData && step === 'extraction')) {
    return (
      <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
        <H2 style={{ textAlign: 'center' }}>Color Extraction</H2>
        <Body style={{ color: 'var(--Buttons-Error-Button)' }}>{error || 'No data'}</Body>
        <Button variant="primary-outline" onClick={onBack}>Back</Button>
      </VStack>
    );
  }

  // Renders the unified Edit modal — used by both extraction and theme steps
  const renderEditModal = () => (
    <Modal
      open={hueEditTopIdx !== null}
      onClose={() => setHueEditTopIdx(null)}
      title={
        hueEditTopIdx !== null && anchorColors[hueEditTopIdx]
          ? `Edit ${
              hueEditTopIdx === primaryIndex
                ? `Primary – ${getColorDescription(anchorColors[hueEditTopIdx].hex)}`
                : getColorDescription(anchorColors[hueEditTopIdx].hex)
            }`
          : 'Edit Color'
      }
    >
      {hueEditTopIdx !== null && (() => {
        const idx = hueEditTopIdx;
        // Use the stable anchor color, NOT the user's currently chosen tone
        const baseColor = anchorColors[idx] || topColors[idx];
        if (!baseColor) return null;
        // Default peak = the one that preserves extracted chroma at its own tone
        const lightDefault = Math.min(Math.round(getMatchingPeakChroma(baseColor.hex, false)), 70);
        const darkDefault = Math.min(Math.round(getMatchingPeakChroma(baseColor.hex, true)), 42);
        const storedLight = chromaPerColor[idx];
        const storedDark = darkChromaPerColor[idx];
        const currentChroma = toneMode === 'light'
          ? (storedLight !== undefined ? storedLight : lightDefault)
          : (storedDark !== undefined ? storedDark : darkDefault);
        const baseHue = (() => {
          const h = chroma(baseColor.hex).get('lch.h');
          return isNaN(h) ? 0 : Math.round(h);
        })();

        const previewEasing = { darkHue: hueEditDarkHue, lightHue: hueEditLightHue };
        const previewPalette = toneMode === 'light'
          ? generateSemanticLightModeScale(baseColor.hex, currentChroma, lockedColorMap[idx], previewEasing)
          : generateSemanticDarkModeScale(baseColor.hex, currentChroma, previewEasing);

        // Effective peak chroma = the highest LCH chroma actually present in the rendered palette
        const effectivePeak = Math.round(Math.max(
          ...previewPalette.map((p) => {
            const c = chroma(p.hex).get('lch.c');
            return isNaN(c) ? 0 : c;
          })
        ));

        // Natural ceiling = the highest peak this color CAN reach (ignoring current input).
        // Generated once with a very high input to find the gamut limit.
        const naturalCeilingPalette = toneMode === 'light'
          ? generateSemanticLightModeScale(baseColor.hex, 200, lockedColorMap[idx], previewEasing)
          : generateSemanticDarkModeScale(baseColor.hex, 200, previewEasing);
        const naturalCeiling = Math.round(Math.max(
          ...naturalCeilingPalette.map((p) => {
            const c = chroma(p.hex).get('lch.c');
            return isNaN(c) ? 0 : c;
          })
        ));

        // Find which Color-N the user's exact color sits at (by lightness match)
        const baseLightness = chroma(baseColor.hex).get('lch.l');
        let lockedColorN = 1;
        let lockedDist = Infinity;
        previewPalette.forEach((step) => {
          const d = Math.abs(step.tone - baseLightness);
          if (d < lockedDist) { lockedDist = d; lockedColorN = step.colorNumber; }
        });

        const hasOverrides = hueOverridesByTop[idx]?.[toneMode] !== undefined;

        const applyEdit = () => {
          setHueOverridesByTop(prev => {
            const next = { ...prev };
            const colorEntry = { ...(next[idx] || {}) };
            colorEntry[toneMode] = { darkHue: hueEditDarkHue, lightHue: hueEditLightHue };
            next[idx] = colorEntry;
            return next;
          });
          setHueEditTopIdx(null);
          setTimeout(() => regenerateSchemes(topColors, primaryIndex), 0);
        };

        const resetEdit = () => {
          setHueOverridesByTop(prev => {
            const next = { ...prev };
            if (!next[idx]) return prev;
            const colorEntry = { ...next[idx] };
            delete colorEntry[toneMode];
            if (Object.keys(colorEntry).length === 0) delete next[idx];
            else next[idx] = colorEntry;
            return next;
          });
          setHueEditTopIdx(null);
          setTimeout(() => regenerateSchemes(topColors, primaryIndex), 0);
        };

        const onChromaChange = (v: number) => {
          if (toneMode === 'light') {
            const updated = [...chromaPerColor];
            updated[idx] = v;
            setChromaPerColor(updated);
            regenerateSchemes(topColors, primaryIndex, updated, undefined);
          } else {
            const updated = [...darkChromaPerColor];
            updated[idx] = v;
            setDarkChromaPerColor(updated);
            regenerateSchemes(topColors, primaryIndex, undefined, updated);
          }
        };

        return (
          <VStack spacing={3} style={{ minWidth: 380, maxWidth: 480 }}>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Adjust the lightest and darkest hues to correct perceived color shifts
              (yellows turning green when dark, navy turning purple when light).
              The user&apos;s exact color stays fixed; hues interpolate from the endpoints toward it.
            </BodySmall>

            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Editing <strong>{toneMode}</strong> mode (switch above to edit the other mode)
            </BodySmall>

            <VStack spacing={1}>
              <BodySmall style={{ fontWeight: 600 }}>Preview</BodySmall>
              <div style={{ display: 'flex', gap: 4 }}>
                {previewPalette.map((step) => {
                  const isExtracted = step.colorNumber === lockedColorN;
                  const isHexLocked = isExtracted && !!lockedColorMap[idx];
                  const isDarkEnd = step.colorNumber === 1;
                  const isLightEnd = step.colorNumber === previewPalette.length;
                  const isFocusedEndpoint =
                    (isDarkEnd && hueEditFocus === 'dark') ||
                    (isLightEnd && hueEditFocus === 'light');
                  let outline: string = 'none';
                  if (isFocusedEndpoint) outline = '2px solid var(--Focus-Visible)';
                  else if (isExtracted) outline = '2px dashed var(--Quiet)';
                  // Choose contrasting icon color based on swatch luminance
                  const iconColor = (() => {
                    try { return chroma(step.hex).luminance() > 0.5 ? '#000' : '#fff'; }
                    catch { return '#fff'; }
                  })();
                  return (
                    <div
                      key={step.colorNumber}
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
                          position: 'relative',
                          width: '100%',
                          height: 28,
                          background: step.hex,
                          borderRadius: 4,
                          outline,
                          outlineOffset: 1,
                          cursor: (isDarkEnd || isLightEnd) ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={`Color-${step.colorNumber}: ${step.hex}${isExtracted ? ' (extracted)' : ''}${isHexLocked ? ' — locked' : ''}`}
                        onClick={() => {
                          if (isDarkEnd) setHueEditFocus('dark');
                          else if (isLightEnd) setHueEditFocus('light');
                        }}
                      >
                        {isHexLocked && (
                          <LockIcon style={{ fontSize: 14, color: iconColor }} />
                        )}
                      </div>
                      {isExtracted && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--Quiet)', whiteSpace: 'nowrap' }}>
                          Color-{step.colorNumber}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Dashed = your extracted color
              </BodySmall>
            </VStack>

            {(() => {
              const isLocked = !!lockedColorMap[idx];
              const sliderMin = 0;
              const sliderMax = Math.min(70, Math.max(1, naturalCeiling));
              // Bell-curve peak multiplier: yellow hues peak at 1.0, others at 0.90.
              const isYellow = baseHue >= 60 && baseHue <= 100;
              const bellMax = isYellow ? 1.00 : 0.90;
              // Resting slider value = the effective peak in the rendered palette
              const resting = Math.max(sliderMin, Math.min(sliderMax, effectivePeak));
              const sliderValue = chromaDragValue !== null ? chromaDragValue : resting;
              const colorName = getColorDescription(baseColor.hex);
              return (
                <VStack spacing={1}>
                  <BodySmall style={{ fontWeight: 600 }}>
                    {colorName} Max Chroma: {sliderValue}
                  </BodySmall>
                  <SliderInput
                    variant="primary"
                    min={sliderMin}
                    max={sliderMax}
                    value={sliderValue}
                    onChange={(_: any, val: number | number[]) => {
                      setChromaDragValue(val as number);
                      // Update chromaPerColor during drag so the preview updates live
                      const target = Math.min(sliderMax, val as number);
                      const scaledInput = Math.floor(target / bellMax);
                      onChromaChange(scaledInput);
                    }}
                    onChangeCommitted={() => {
                      setChromaDragValue(null);
                    }}
                    size="small"
                    disabled={isLocked}
                    marks={[
                      { value: sliderMin, label: String(sliderMin) },
                      { value: sliderMax, label: String(sliderMax) },
                    ]}
                  />
                  {isLocked ? (
                    <BodySmall style={{ color: 'var(--Quiet)' }}>
                      Chroma is locked because this color is locked to its exact hex.
                    </BodySmall>
                  ) : sliderMax < 70 ? (
                    <BodySmall style={{ color: 'var(--Quiet)' }}>
                      This color's gamut peaks at {sliderMax}.{' '}
                      <Link
                        style={{ cursor: 'pointer' }}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          window.open('/faq#chroma-limit', '_blank');
                        }}
                      >
                        Why can't I increase the chroma?
                      </Link>
                    </BodySmall>
                  ) : null}
                </VStack>
              );
            })()}

            {(() => {
              const hueGradient = 'linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))';
              const hueSliderSx = {
                '& .MuiSlider-rail': {
                  background: hueGradient,
                  opacity: 1,
                  border: 'none',
                },
                '& .MuiSlider-track': {
                  background: 'transparent',
                  border: 'none',
                },
                '& .MuiSlider-thumb': {
                  border: '2px solid var(--Background)',
                  boxShadow: '0 0 0 1px var(--Border), var(--Effect-Level-2)',
                },
              };
              return (
                <VStack spacing={2}>
                  <Card padding="small" style={{ width: '100%' }}>
                    <div onMouseEnter={() => setHueEditFocus('dark')} onClick={() => setHueEditFocus('dark')}>
                      <VStack spacing={1}>
                        <BodySmall style={{ fontWeight: 600 }}>
                          Darkest Hue: {Math.round(hueEditDarkHue)}°
                        </BodySmall>
                        <SliderInput
                          variant="primary"
                          min={0}
                          max={360}
                          step={1}
                          value={hueEditDarkHue}
                          onChange={(_: any, v: number | number[]) => {
                            setHueEditDarkHue(v as number);
                            setHueEditFocus('dark');
                          }}
                          size="small"
                          sx={hueSliderSx}
                        />
                        {Math.round(hueEditDarkHue) !== baseHue && (
                          <Link
                            style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHueEditDarkHue(baseHue);
                              setHueEditFocus('dark');
                            }}
                          >
                            Reset to {baseHue}°
                          </Link>
                        )}
                      </VStack>
                    </div>
                  </Card>

                  <Card padding="small" style={{ width: '100%' }}>
                    <div onMouseEnter={() => setHueEditFocus('light')} onClick={() => setHueEditFocus('light')}>
                      <VStack spacing={1}>
                        <BodySmall style={{ fontWeight: 600 }}>
                          Lightest Hue: {Math.round(hueEditLightHue)}°
                        </BodySmall>
                        <SliderInput
                          variant="primary"
                          min={0}
                          max={360}
                          step={1}
                          value={hueEditLightHue}
                          onChange={(_: any, v: number | number[]) => {
                            setHueEditLightHue(v as number);
                            setHueEditFocus('light');
                          }}
                          size="small"
                          sx={hueSliderSx}
                        />
                        {Math.round(hueEditLightHue) !== baseHue && (
                          <Link
                            style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHueEditLightHue(baseHue);
                              setHueEditFocus('light');
                            }}
                          >
                            Reset to {baseHue}°
                          </Link>
                        )}
                      </VStack>
                    </div>
                  </Card>
                </VStack>
              );
            })()}

            <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
              {hasOverrides && (
                <Button variant="outline" size="small" onClick={resetEdit}>
                  Reset Hues
                </Button>
              )}
              <Button variant="primary-outline" size="small" onClick={() => setHueEditTopIdx(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="small"
                onClick={applyEdit}
                sx={{
                  backgroundColor: 'var(--Text)',
                  color: 'var(--Background)',
                  borderColor: 'var(--Text)',
                  '&:hover': { backgroundColor: 'var(--Text)', opacity: 0.85, borderColor: 'var(--Text)' },
                }}
              >
                Apply
              </Button>
            </HStack>
          </VStack>
        );
      })()}
    </Modal>
  );

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
                      className="dino-swatch"
                      style={{ ['--swatch-color' as any]: color.hex }}
                      onClick={() => {
                        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
                        clickTimer.current = setTimeout(() => { clickTimer.current = null; openHexEditor(color.hex, i, 'top'); }, 350);
                      }}
                      onDoubleClick={() => {
                        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                        setSwapIndex(isSwapActive ? null : i);
                      }}
                      sx={{
                        borderRadius: 'var(--Button-Icon-Radius, 50%)',
                        width: '100%',
                        aspectRatio: '1',
                        height: 'auto',
                        outline: isSwapActive ? '3px solid var(--Focus-Visible)' : 'none',
                        outlineOffset: isSwapActive ? 2 : 0,
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
                gridTemplateColumns: 'repeat(auto-fill, 42px)',
                gap: 6,
                justifyContent: 'start',
              }}>
                {colorData.additionalColors.map((color, i) => (
                  <VStack key={i} spacing={0} alignItems="center">
                    <Button
                      swatch
                      swatchColor={color.hex}
                      size="large"
                      className="dino-swatch"
                      style={{ ['--swatch-color' as any]: color.hex }}
                      onClick={() => {
                        if (swapIndex !== null) handleSwap(color);
                        else openHexEditor(color.hex, i, 'additional');
                      }}
                      title={swapIndex !== null ? `Click to swap with top color #${swapIndex + 1}` : `${color.hex} — click to view`}
                      sx={{
                        borderRadius: 'var(--Button-Icon-Radius, 50%)',
                        width: 42,
                        height: 42,
                        minWidth: 42,
                        minHeight: 42,
                      }}
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
                          <Button size="small" variant="primary-outline" onClick={() => setHexEditValue(validation.suggested!)}>
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
              <Button variant="primary-outline" size="small" onClick={() => setHexEditIndex(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="small"
                onClick={applyHexEdit}
                sx={{
                  backgroundColor: 'var(--Text)',
                  color: 'var(--Background)',
                  borderColor: 'var(--Text)',
                  '&:hover': { backgroundColor: 'var(--Text)', opacity: 0.85, borderColor: 'var(--Text)' },
                }}
              >
                {hexEditSource === 'top' ? 'Apply' : 'Close'}
              </Button>
            </HStack>
          </VStack>
        </Modal>
        {renderEditModal()}
      </VStack>
    );
  }


  // ─── Step 2: Theme Selection ───
  const selectedName = selectedScheme?.name;

  return (
    <div className="color-theme-stage">
      <VStack spacing={1} alignItems="center">
        <H2 style={{ textAlign: 'center' }}>Theme</H2>
        <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
          Select a primary color and a color scheme below.
        </Body>
      </VStack>

      {/* Core Colors + Settings */}
      <Card padding="medium" className="color-theme-core-card" style={{ width: '100%', borderRadius: 'var(--Card-Radius, 14px)' }}>
        <VStack spacing={3}>
          <VStack spacing={1}>
            <BodySmall style={{ fontWeight: 600 }}>Core Colors</BodySmall>
            <BodySmall style={{ color: 'var(--Quiet)' }}>Click to change</BodySmall>
          </VStack>

          {/* Primary color swatches with radio buttons. We use a plain
              <button> here instead of the lib's <Button swatch> because the
              lib variant hardcodes its corner radius — when the brand sets
              a large --Button-Radius the swatches stayed square. */}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {topColors.map((color, i) => {
              const isPrimary = i === primaryIndex;
              const swatchSize = isNarrow ? 40 : 56;
              return (
                <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                  <button
                    type="button"
                    aria-label={`Set Core Color ${i + 1} as Primary`}
                    onClick={() => {
                      setPrimaryIndex(i);
                      regenerateSchemes(topColors, i);
                    }}
                    style={{
                      width: swatchSize,
                      height: swatchSize,
                      borderRadius: 'var(--Button-Radius, 6px)',
                      background: color.hex,
                      border: isPrimary
                        ? '2px solid var(--Buttons-Default-Border, var(--Border))'
                        : '1px solid var(--Border, rgba(0,0,0,0.1))',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
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
          <Divider />
          <div
            onClick={() => setShowChromaSettings(!showChromaSettings)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            <span style={{ color: 'var(--Hotlink)', fontSize: '0.8rem', transform: showChromaSettings ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform 0.2s', display: 'inline-block' }}>⌃</span>
            <Link onClick={(e: React.MouseEvent) => e.preventDefault()} style={{ fontSize: '0.875rem' }}>
              {showChromaSettings ? 'Hide Settings' : 'Show Settings'}
            </Link>
          </div>

          {/* Expanded: per-color tones + chroma */}
          {showChromaSettings && (
            <VStack spacing={3}>
              <HStack spacing={0}>
                <Button
                  variant={toneMode === 'light' ? 'default' : 'outline'}
                  size="small"
                  onClick={() => setToneMode('light')}
                  sx={{ borderRadius: 'var(--Style-Border-Radius) 0 0 var(--Style-Border-Radius)', marginRight: '-1px', position: 'relative', zIndex: toneMode === 'light' ? 1 : 0 }}
                >
                  Light Mode
                </Button>
                <Button
                  variant={toneMode === 'dark' ? 'default' : 'outline'}
                  size="small"
                  onClick={() => setToneMode('dark')}
                  sx={{ borderRadius: '0 var(--Style-Border-Radius) var(--Style-Border-Radius) 0' }}
                >
                  Dark Mode
                </Button>
              </HStack>

              <BodySmall style={{ fontSize: '0.75rem' }}>
                <strong>Click any tone</strong> to update which tone represents each color.
                {' '}(Mode: {toneMode}, Max Chroma: {toneMode === 'light' ? chromaPerColor[0] : darkChromaPerColor[0]})
              </BodySmall>

              {topColors.map((color, colorIdx) => {
                const anchor = anchorColors[colorIdx] || color;
                const lc = chromaPerColor[colorIdx] || 62;
                const dc = darkChromaPerColor[colorIdx] || 36;
                const easing = hueOverridesByTop[colorIdx]?.[toneMode];
                // Generate palette from the STABLE anchor color, not the user's current pick
                const palette = toneMode === 'light'
                  ? generateSemanticLightModeScale(anchor.hex, lc, lockedColorMap[colorIdx], easing)
                  : generateSemanticDarkModeScale(anchor.hex, dc, easing);
                // Find which Color-N matches the user's currently chosen hex (closest by deltaE)
                const currentColorN = findClosestColorN(color.hex, palette);
                const isHexLocked = !!lockedColorMap[colorIdx];
                const colorName = colorIdx === primaryIndex
                  ? `Primary – ${getColorDescription(anchor.hex)}`
                  : getColorDescription(anchor.hex);

                return (
                  <VStack key={colorIdx} spacing={1}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <Body style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>
                        {colorName}
                      </Body>
                      <Link
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          const baseHue = (() => {
                            const h = chroma(anchor.hex).get('lch.h');
                            return isNaN(h) ? 0 : Math.round(h);
                          })();
                          const existingDark = hueOverridesByTop[colorIdx]?.[toneMode]?.darkHue;
                          const existingLight = hueOverridesByTop[colorIdx]?.[toneMode]?.lightHue;
                          setHueEditDarkHue(existingDark !== undefined ? existingDark : baseHue);
                          setHueEditLightHue(existingLight !== undefined ? existingLight : baseHue);
                          setHueEditFocus(null);
                          setChromaDragValue(null);
                          setHueEditTopIdx(colorIdx);
                        }}
                        style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                      >
                        Edit
                      </Link>
                    </div>

                    {/* Tone palette */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {palette.map((step) => {
                        const isCurrentTone = step.colorNumber === currentColorN;
                        const showLock = isCurrentTone && isHexLocked;
                        const iconColor = (() => {
                          try { return chroma(step.hex).luminance() > 0.5 ? '#000' : '#fff'; }
                          catch { return '#fff'; }
                        })();
                        return (
                          <div
                            key={step.colorNumber}
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
                                position: 'relative',
                                width: '100%',
                                height: 24,
                                background: step.hex,
                                cursor: (toneMode === 'light' && !isHexLocked) ? 'pointer' : 'default',
                                borderRadius: 4,
                                outline: isCurrentTone ? '2px solid var(--Focus-Visible)' : 'none',
                                outlineOffset: isCurrentTone ? 1 : 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={`Color-${step.colorNumber}: ${step.hex}${isHexLocked && isCurrentTone ? ' — locked' : ''}`}
                              onClick={() => {
                                if (toneMode === 'dark') return;
                                if (isHexLocked) return; // can't change selected tone when color is hex-locked
                                // Only update topColors[colorIdx].hex; the palette is anchored
                                // and won't regenerate from this click.
                                const updated = [...topColors];
                                updated[colorIdx] = { ...updated[colorIdx], hex: step.hex };
                                setTopColors(updated);
                                regenerateSchemes(updated, primaryIndex);
                              }}
                            >
                              {showLock && (
                                <LockIcon style={{ fontSize: 12, color: iconColor }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </VStack>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Card>

      {/* Scheme cards — 3 col grid on wide screens, stacked on narrow */}
      <div className="color-theme-scheme-grid">
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

                {/* 3 color swatches — non-interactive. The whole card
                    handles selection; clicking a swatch directly did
                    nothing here, so the lib's Button variant was misleading.
                    For the Custom card the user still picks colors via the
                    "Edit Colors" link below. */}
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  {(['primary', 'secondary', 'tertiary'] as const).map((role, i) => {
                    const displayColor = scheme.colors[i];
                    const label = ['Primary', 'Secondary', 'Tertiary'][i];
                    return (
                      <VStack key={i} spacing={1} alignItems="center" style={{ flex: 1 }}>
                        <div
                          aria-hidden="true"
                          style={{
                            width: '100%',
                            height: 56,
                            background: displayColor,
                            borderRadius: 'var(--Button-Radius, 6px)',
                            border: '1px solid var(--Border, rgba(0,0,0,0.1))',
                            boxSizing: 'border-box',
                          }}
                        />
                        <BodySmall style={{ fontWeight: 600, fontSize: '0.7rem', textAlign: 'center', width: '100%' }}>{label}</BodySmall>
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
      </div>

      {renderEditModal()}

      {/* Navigation handled by CreationTopBar — Back goes to extraction step first */}
    </div>
  );
}
