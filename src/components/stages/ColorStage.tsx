import {
  Button, ButtonGroup, H2, H3, Body, BodySmall, VStack, HStack, Card,
  CircularProgress, Checkbox, Divider, Link, Radio, Modal, TextField, Alert, SliderInput, Icon,
} from '@dynodesign/components';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  /**
   * The three below used to be local-only state, so every one of them was
   * lost the moment this stage unmounted — walk forward to Assign Colors and
   * back and the core colours returned to their pre-edit values with nothing
   * reporting it.
   *
   * anchorColors cannot be recovered from savedTopColors: the two diverge on
   * purpose (see the note on the anchorColors state below), so re-seeding
   * anchors from topColors silently promotes whatever tone was last clicked
   * into the anchor slot.
   */
  anchorColors?: ExtractedColor[];
  hueOverridesByTop?: Record<number, { light?: { darkHue?: number; lightHue?: number }; dark?: { darkHue?: number; lightHue?: number } }>;
  primaryIndex?: number;
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

/**
 * Swatch corner radius.
 *
 * A swatch follows the brand's button radius so it reads as part of the same
 * shape language — but only up to a point. Past 16px the brand is decidedly
 * rounded, and a square swatch at, say, 20px looks like a mistake rather than
 * a choice, so it snaps to a full 56px and reads as a circle/pill.
 *
 * The threshold is pure CSS: the middle term goes negative when the radius is
 * at or below 16, and clamp() falls back to its minimum (the button radius);
 * above 16 the term explodes past the maximum and clamp() returns 56px. That
 * keeps the rule live against --Button-Radius without plumbing the numeric
 * radius down into this screen.
 */
const SWATCH_RADIUS =
  'clamp(var(--Button-Radius, 6px), (var(--Button-Radius, 6px) - 16px) * 1000, 56px)';
const SWATCH_INNER_RADIUS = `calc(${SWATCH_RADIUS} - 1px)`;

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
  const [anchorColors, setAnchorColors] = useState<ExtractedColor[]>(
    () => (savedColorEdits?.anchorColors?.length
      ? savedColorEdits.anchorColors
      : seededFromScheme()),
  );
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [primaryIndex, setPrimaryIndex] = useState(savedColorEdits?.primaryIndex ?? 0);
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
  const [hueOverridesByTop, setHueOverridesByTop] = useState<Record<number, { light?: { darkHue?: number; lightHue?: number }; dark?: { darkHue?: number; lightHue?: number } }>>(
    savedColorEdits?.hueOverridesByTop || {},
  );

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

  // Colours the generator had to move.
  //
  // A locked hex is written verbatim into the tone nearest its lightness. If
  // that colour cannot carry accessible text — nothing in its own ramp reaches
  // 4.5:1 — the generator shifts its lightness to the nearest value that can
  // and records what it did. Silently altering someone's brand colour would be
  // worse than the adjustment, so it is surfaced here.
  const colorAdjustments = useMemo(() => {
    const palettes: Array<[string, any]> = [
      ['Primary', selectedScheme?.tonePalettes?.primary],
      ['Secondary', selectedScheme?.tonePalettes?.secondary],
      ['Tertiary', selectedScheme?.tonePalettes?.tertiary],
    ];
    const found: Array<{ role: string; from: string; to: string; reason: string }> = [];
    for (const [role, palette] of palettes) {
      const step = (palette as Array<any> | undefined)?.find((t) => t?.adjusted);
      if (step?.adjusted) found.push({ role, ...step.adjusted });
    }
    return found;
  }, [selectedScheme]);

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
      // Re-derive THIS colour's chroma peak from the new hex.
      //
      // Without this the ramp keeps the peak derived from the colour that used
      // to be here, so a vivid new pick renders as a muted ramp with one
      // saturated tone stamped into it — the whole curve describing a colour
      // that is no longer there. The auto-derive effect below cannot do it: it
      // is keyed on the LENGTH of the list, which does not change when a hex is
      // edited in place.
      const peaks = rederiveChromaFor(hexEditIndex, hexEditValue);

      // Track lock state
      const nextLocked = { ...lockedColorMap };
      if (hexLocked) nextLocked[hexEditIndex] = hexEditValue;
      else delete nextLocked[hexEditIndex];
      setLockedColorMap(nextLocked);

      // Rebuild the schemes now — see the note in handleSwap.
      const nextTops = topColors.map((c, i) =>
        (i === hexEditIndex ? { ...c, hex: hexEditValue } : c));
      const nextAnchors = anchorColors.map((c, i) =>
        (i === hexEditIndex ? { ...c, hex: hexEditValue } : c));
      const nextLight = [...chromaPerColor]; nextLight[hexEditIndex] = peaks.light;
      const nextDark = [...darkChromaPerColor]; nextDark[hexEditIndex] = peaks.dark;
      regenerateSchemes(nextTops, primaryIndex, nextLight, nextDark, nextAnchors, undefined, nextLocked);
    }
    setHexEditIndex(null);
  };

  // Per-color chroma has to be derived for EVERY flow, not just the edit one.
  //
  // The state initialises to a flat [62, 62, …] placeholder, and until this
  // runs, every palette is generated at chroma 62 regardless of what the color
  // actually is. On a muted deep pink (matching peak nearer 40) that pushes the
  // mid tones to a vivid magenta that appears nowhere in the ramp the user was
  // shown — which is what Tonal buttons render, since they take the border
  // tone. It also desaturates/shifts the tone a Secondary button reads.
  //
  // The bootstrap effect below did this correctly but was gated on editMode, so
  // the fix only appeared once you opened Settings — or reordered the colors,
  // which regenerates the palettes through a path that derives the peak itself.
  useEffect(() => {
    if (topColors.length === 0) return;
    if (savedColorEdits?.chromaPerColor?.length !== topColors.length) {
      setChromaPerColor(topColors.map(c => Math.min(Math.round(getMatchingPeakChroma(c.hex, false)), 70)));
    }
    if (savedColorEdits?.darkChromaPerColor?.length !== topColors.length) {
      setDarkChromaPerColor(topColors.map(c => Math.min(Math.round(getMatchingPeakChroma(c.hex, true)), 42)));
    }
    // Keyed on the colors themselves: re-derive when the extraction changes,
    // and never stomp a value the user has since dragged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topColors.map(c => c.hex).join('|')]);

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
      anchorColors,
      hueOverridesByTop,
      primaryIndex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromaPerColor, darkChromaPerColor, lockedColorMap, anchorColors, hueOverridesByTop, primaryIndex]);

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
    // Returning to this stage is NOT a fresh start. This effect overwrites
    // topColors, anchorColors and both chroma arrays with whatever the image
    // yields, so re-running it on a remount threw away every edit made here —
    // walk forward to Assign Colors and back and the core colours were the
    // originals again. savedTopColors is the "we have been here" signal: it is
    // populated by the [topColors] effect above on the first pass, so its
    // presence means extraction already ran and its result has since been
    // edited. Re-extracting would only reproduce the pre-edit state.
    if (savedTopColors?.length) {
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

  /**
   * Re-derive one slot's chroma peak from the hex now sitting in it.
   *
   * Both ways a colour can change — swapping it out, or typing a new hex —
   * have to do this, and neither did. The auto-derive effect cannot: it is
   * guarded on the LENGTH of the colour list, which is identical before and
   * after a colour is replaced in place. So the ramp kept the peak derived
   * from the colour that used to be here, and a vivid new pick rendered as a
   * muted ramp of the right hue — a #ec5a63 red drawn at peak 21 reads as
   * dusty rose, which is what made the tone rows disagree with the swatches
   * above them.
   */
  const rederiveChromaFor = useCallback((slot: number, hex: string) => {
    const light = Math.min(Math.round(getMatchingPeakChroma(hex, false)), 70);
    const dark = Math.min(Math.round(getMatchingPeakChroma(hex, true)), 42);
    setChromaPerColor(prev => { const n = [...prev]; n[slot] = light; return n; });
    setDarkChromaPerColor(prev => { const n = [...prev]; n[slot] = dark; return n; });
    // Returned so the caller can hand the NEW values straight to
    // regenerateSchemes — setState is async, so regenerating without them
    // rebuilds from the peaks that were there before the change.
    return { light, dark };
  }, []);


  const regenerateSchemes = useCallback((
    tops: ExtractedColor[],
    pIdx: number,
    lChroma?: number[],
    dChroma?: number[],
    anchors?: ExtractedColor[],
    overrides?: Record<number, { light?: { darkHue?: number; lightHue?: number }; dark?: { darkHue?: number; lightHue?: number } }>,
    lockedOverride?: Record<number, string>,
  ) => {
    const lc = lChroma || chromaPerColor;
    const dc = dChroma || darkChromaPerColor;
    const anchorsArr = anchors || anchorColors;
    // Hue edits are applied via setState (async), so a caller firing this right
    // after setHueOverridesByTop would read the STALE state through the closure.
    // Callers pass the freshly-edited overrides here to bypass that.
    const hOverrides = overrides || hueOverridesByTop;
    // Same stale-closure problem as the hue overrides above: swapping or
    // re-hexing a colour clears or sets its lock via setState, so a caller
    // firing this immediately after would still read the OLD lock and pin the
    // ramp to the colour that was just replaced.
    const lockedMap = lockedOverride || lockedColorMap;
    const primary = tops[pIdx].hex;
    const others = tops.filter((_, i) => i !== pIdx).map(c => c.hex);
    const reordered = [primary, ...others];
    // Build locked colors array: [primary locked hex, secondary locked hex, ...]
    const locked: (string | undefined)[] = [
      lockedMap[pIdx],
      ...tops.filter((_, i) => i !== pIdx).map((_, i) => {
        const origIdx = i >= pIdx ? i + 1 : i;
        return lockedMap[origIdx];
      }),
    ];
    // Translate hueOverridesByTop (keyed by topColors index) to reordered scheme indices
    // Reordered: [primary=tops[pIdx], ...tops without pIdx] → indices 0/1/2 in scheme
    const orderedTopIndices = [pIdx, ...tops.map((_, i) => i).filter(i => i !== pIdx)];
    const hueOverridesForScheme: Record<number, { light?: { darkHue?: number; lightHue?: number }; dark?: { darkHue?: number; lightHue?: number } }> = {};
    orderedTopIndices.forEach((origIdx, schemeIdx) => {
      if (hOverrides[origIdx]) {
        hueOverridesForScheme[schemeIdx] = hOverrides[origIdx];
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
        // A scheme colour is not always one of the user's Core Colors.
        // Analogous, Triadic, Complementary and Split-Complementary ROTATE the
        // primary's hue, so two of their three colours never appear in `tops`
        // and the lookup fails. This used to `return null`, which made the
        // whole scheme fall through unrefined and keep generateColorSchemes'
        // palettes — where primary's chroma is applied to all three roles.
        //
        // That is exactly what the refinement below exists to prevent, and it
        // was silently skipping the four schemes that need it most: the tone
        // rows in Settings showed the per-colour ramps while the export shipped
        // the unrefined ones.
        //
        // A derived colour has no Core Color to inherit from, so it derives its
        // own peak from itself — the same rule a Core Color follows.
        const isTop = topIdx >= 0;
        const anchorHex = isTop ? (anchorsArr[topIdx]?.hex || colorHex) : colorHex;
        const lightC = isTop
          ? (lc[topIdx] ?? 62)
          : Math.min(Math.round(getMatchingPeakChroma(colorHex, false)), 70);
        const darkC = isTop
          ? (dc[topIdx] ?? 36)
          : Math.min(Math.round(getMatchingPeakChroma(colorHex, true)), 42);
        // Pin the ramp to the colour the user actually sees. Without this the
        // palette is generated from the ANCHOR plus a chroma value that need not
        // match the picked hex, so tone SC — the tone every Secondary button
        // reads — came out a desaturated cousin of the swatch beside it.
        // lockedHex overwrites only the step nearest the colour's own lightness,
        // so the anchor, chroma and hue easing still shape every other tone.
        const lockedHex = isTop ? (lockedMap[topIdx] ?? colorHex) : colorHex;
        const easing = isTop ? hOverrides[topIdx] : undefined;
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

  // Declared AFTER regenerateSchemes on purpose: it lists that callback as a
  // dependency, and a dependency array is evaluated during render — so with
  // handleSwap above it, `regenerateSchemes` was still in its temporal dead
  // zone and the component threw on first render.
  const handleSwap = useCallback((replacement: ExtractedColor) => {
    if (swapIndex === null) return;
    setTopColors(prev => {
      const next = [...prev];
      next[swapIndex] = replacement;
      return next;
    });
    // A swap replaces the COLOUR, so the anchor has to move with it.
    //
    // anchorColors deliberately stays put when the user nudges to a different
    // TONE of the same colour, which keeps the generated ramp stable. A swap is
    // a different thing: the hue changes entirely. Leaving the old anchor meant
    // every palette kept being generated from the colour that was swapped out —
    // an olive seed with plum-tinted containers, because the ramp was still
    // being built from the plum.
    setAnchorColors(prev => {
      const next = [...prev];
      next[swapIndex] = replacement;
      return next;
    });
    // Anything tuned for the OLD colour at this slot is now meaningless: a hue
    // easing dialled for plum is wrong for olive, and a locked hex pins the
    // ramp to a colour that is no longer in the scheme.
    setLockedColorMap(prev => {
      if (!(swapIndex in prev)) return prev;
      const next = { ...prev };
      delete next[swapIndex];
      return next;
    });
    setHueOverridesByTop(prev => {
      if (!(swapIndex in prev)) return prev;
      const next = { ...prev };
      delete next[swapIndex];
      return next;
    });
    // The chroma peak was derived from the colour being replaced, so it is as
    // stale as the locked hex and the hue easing cleared above.
    const peaks = rederiveChromaFor(swapIndex, replacement.hex);

    // Rebuild the schemes NOW rather than at export.
    //
    // Every other way of changing a colour — clicking a tone, moving the
    // primary, dragging chroma, applying a hue edit — calls this explicitly.
    // The two paths that change a Core Colour outright did not, so the schemes
    // (and the export that reads them) kept the previous colours until some
    // unrelated action happened to trigger a rebuild.
    //
    // Every value is passed explicitly: the setState calls above are async, so
    // regenerating off the closure would rebuild from what was there before.
    const nextTops = topColors.map((c, i) => (i === swapIndex ? replacement : c));
    const nextAnchors = anchorColors.map((c, i) => (i === swapIndex ? replacement : c));
    const nextLight = [...chromaPerColor]; nextLight[swapIndex] = peaks.light;
    const nextDark = [...darkChromaPerColor]; nextDark[swapIndex] = peaks.dark;
    const nextLocked = { ...lockedColorMap }; delete nextLocked[swapIndex];
    const nextOverrides = { ...hueOverridesByTop }; delete nextOverrides[swapIndex];
    regenerateSchemes(nextTops, primaryIndex, nextLight, nextDark, nextAnchors, nextOverrides, nextLocked);

    setSwapIndex(null);
  }, [swapIndex, rederiveChromaFor, topColors, anchorColors, chromaPerColor,
      darkChromaPerColor, lockedColorMap, hueOverridesByTop, primaryIndex, regenerateSchemes]);

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
          // Build the new overrides synchronously and pass them straight into
          // regeneration — setState is async, so relying on state here would
          // regenerate with the pre-edit hues (the bug where edits didn't apply).
          const nextOverrides = { ...hueOverridesByTop };
          const colorEntry = { ...(nextOverrides[idx] || {}) };
          colorEntry[toneMode] = { darkHue: hueEditDarkHue, lightHue: hueEditLightHue };
          nextOverrides[idx] = colorEntry;
          setHueOverridesByTop(nextOverrides);
          setHueEditTopIdx(null);
          regenerateSchemes(topColors, primaryIndex, undefined, undefined, undefined, nextOverrides);
        };

        const resetEdit = () => {
          const nextOverrides = { ...hueOverridesByTop };
          if (nextOverrides[idx]) {
            const colorEntry = { ...nextOverrides[idx] };
            delete colorEntry[toneMode];
            if (Object.keys(colorEntry).length === 0) delete nextOverrides[idx];
            else nextOverrides[idx] = colorEntry;
          }
          setHueOverridesByTop(nextOverrides);
          setHueEditTopIdx(null);
          regenerateSchemes(topColors, primaryIndex, undefined, undefined, undefined, nextOverrides);
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
                      // Single click SWITCHES the colour, double click opens the
                      // editor. These were the other way round: the common action
                      // (swap this swatch for another) needed a double click while
                      // the rare one (type a hex, lock it) fired on a single.
                      // The timer only exists so the first half of a double click
                      // does not also open the swap.
                      onClick={() => {
                        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
                        clickTimer.current = setTimeout(() => {
                          clickTimer.current = null;
                          setSwapIndex(isSwapActive ? null : i);
                        }, 350);
                      }}
                      onDoubleClick={() => {
                        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                        openHexEditor(color.hex, i, 'top');
                      }}
                      sx={{
                        // Match the design system's button shape — uses the
                        // same --Button-Radius token that brand buttons resolve.
                        borderRadius: SWATCH_RADIUS,
                        // The lib swatch fill defaults to the round ICON radius;
                        // pin it to --Button-Radius so the swatch tracks the
                        // design system's button shape (concentric, 1px inset).
                        // The lib applies the inner radius as an INLINE style
                        // (round icon radius), which beats a normal class rule —
                        // so we must use !important to pin it to the button radius.
                        '& .btn-swatch-inner': {
                          borderRadius: `${SWATCH_INNER_RADIUS} !important`,
                        },
                        width: '100%',
                        aspectRatio: '1',
                        height: 'auto',
                        overflow: 'hidden',
                        outline: isSwapActive ? '3px solid var(--Focus-Visible)' : 'none',
                        outlineOffset: isSwapActive ? 2 : 0,
                      }}
                      title={`${color.hex} — click to edit · double-click to swap`}
                    />
                    {color.isSwatch && (
                      <HStack spacing={0} alignItems="center">
                        <Icon size="small"><StarIcon style={{ fontSize: 14 }} /></Icon>
                        <BodySmall style={{ fontSize: '0.65rem', fontWeight: 600 }}>
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
                        // Same shape as the brand's regular buttons.
                        borderRadius: SWATCH_RADIUS,
                        // Lib paints the inner fill at the round ICON radius via
                        // an inline style — pin it to the button radius (!important
                        // beats inline) so the swatch is a rounded square, not a circle.
                        '& .btn-swatch-inner': {
                          borderRadius: `${SWATCH_INNER_RADIUS} !important`,
                        },
                        width: 42,
                        height: 42,
                        minWidth: 42,
                        minHeight: 42,
                        overflow: 'hidden',
                      }}
                    />
                    {color.isSwatch && (
                      <Icon size="small"><StarIcon style={{ fontSize: 10 }} /></Icon>
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
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              <strong>Click</strong> a colour to swap it for another.
              {' '}<strong>Double-click</strong> to type an exact hex or lock it.
            </BodySmall>
          </VStack>

          {colorAdjustments.length > 0 && (
            <Alert severity="warning">
              <VStack spacing={1}>
                <Body>
                  {colorAdjustments.length === 1
                    ? 'One colour was adjusted to meet contrast requirements'
                    : `${colorAdjustments.length} colours were adjusted to meet contrast requirements`}
                </Body>
                {colorAdjustments.map((adj) => (
                  <BodySmall key={adj.role}>
                    <strong>{adj.role}</strong>: {adj.from} → {adj.to}. {adj.reason}
                  </BodySmall>
                ))}
              </VStack>
            </Alert>
          )}

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
                      borderRadius: SWATCH_RADIUS,
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
                Each row is the full 12-tone scale built from that colour.
                {' '}<strong>Click any tone</strong> to choose which one represents the colour —
                {' '}the scale itself does not change.
                {' '}<strong>Edit</strong> adjusts the colour's hue and saturation.
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
                      <Body style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1, minWidth: 0 }}>
                        {colorName}
                      </Body>
                      {/* Editing is a LIGHT-mode action: the modal tunes the
                          colour itself, and the dark ramp is derived from it.
                          Offering it in dark mode implies you can tune the two
                          independently, which you cannot — so it is rendered as
                          plain text rather than a link, with the reason on hover.
                          Not a disabled Link: a link you cannot follow still
                          reads as actionable. */}
                      {/* Fixed slot so the row geometry is identical in both
                          modes. Link renders inline and BodySmall renders block,
                          so swapping them directly let the name lose its space
                          and wrap to three lines the moment you hit Dark Mode. */}
                      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 28, lineHeight: 1 }}>
                      {toneMode === 'dark' ? (
                        <BodySmall
                          title="Switch to Light Mode to edit this colour — the dark scale is derived from it."
                          style={{ color: 'var(--Quiet)', fontSize: '0.7rem', whiteSpace: 'nowrap', display: 'inline' }}
                        >
                          Edit
                        </BodySmall>
                      ) : (
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
                      )}
                      </div>
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
                            borderRadius: SWATCH_RADIUS,
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
                                      // Chroma is keyed by the colour's index in
                                      // topColors, NOT by the role slot. Reading
                                      // chromaPerColor[roleIdx] meant assigning
                                      // topColors[4] to Primary generated its ramp
                                      // at topColors[0]'s peak — the wrong colour's
                                      // saturation, the same mismatch that made the
                                      // Core Colors ramps disagree with the swatches.
                                      const peakFor = (hex: string, dark: boolean) => {
                                        const i = topColors.findIndex(c => c.hex === hex);
                                        const table = dark ? darkChromaPerColor : chromaPerColor;
                                        return i >= 0 ? table[i] : undefined;
                                      };
                                      const updated: ColorScheme = {
                                        ...scheme,
                                        colors: newColors,
                                        extractedTones: {
                                          primary: getLightness(newColors[0]),
                                          secondary: getLightness(newColors[1]),
                                          tertiary: getLightness(newColors[2]),
                                        },
                                        tonePalettes: {
                                          primary: generateSemanticLightModeScale(newColors[0], peakFor(newColors[0], false)),
                                          secondary: generateSemanticLightModeScale(newColors[1], peakFor(newColors[1], false)),
                                          tertiary: generateSemanticLightModeScale(newColors[2], peakFor(newColors[2], false)),
                                        },
                                        darkModeTonePalettes: {
                                          primary: generateSemanticDarkModeScale(newColors[0], peakFor(newColors[0], true)),
                                          secondary: generateSemanticDarkModeScale(newColors[1], peakFor(newColors[1], true)),
                                          tertiary: generateSemanticDarkModeScale(newColors[2], peakFor(newColors[2], true)),
                                        },
                                      };
                                      onSchemeSelected(updated);
                                      // Persist upward as well as locally. setSchemes
                                      // alone updates component state that is thrown
                                      // away on unmount; savedSchemes is what the next
                                      // mount seeds from, so without this the Custom
                                      // scheme reverted the moment you went forward and
                                      // came back. regenerateSchemes does both — this
                                      // path only did half.
                                      const nextSchemes = schemes.map(s => s.name === 'Custom' ? updated : s);
                                      setSchemes(nextSchemes);
                                      onSchemesGenerated?.(nextSchemes);
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
