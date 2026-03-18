import {
  Button, H2, H3, BodySmall, VStack, HStack, Card, ButtonGroup,
} from '@dynodesign/components';
import chroma from 'chroma-js';
import { useState, useRef, useEffect, useCallback } from 'react';
import { toneToColorNumber } from '../../utils/colorScale';
import { buildPreviewCSS } from '../../utils/buildPreviewCSS';
import '../../styles/assign-colors.css';

import type { StageProps, UserSelections, ColorScheme } from '../../types';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  onSelectionsChanged: (selections: UserSelections) => void;
  onColorsReordered: (colors: [string, string, string]) => void;
  userSelections: UserSelections;
  moodBoardUrl?: string | null;
  designSystemName?: string;
}

type NavOption = 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
type ButtonMode = 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';

const NAV_OPTIONS: { value: NavOption; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'primary', label: 'Primary' },
  { value: 'primary-light', label: 'Primary Light' },
  { value: 'primary-medium', label: 'Primary Medium' },
  { value: 'primary-dark', label: 'Primary Dark' },
];

const BUTTON_MODES: { value: ButtonMode; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'tonal', label: 'Tonal' },
  { value: 'laddered', label: 'Laddered' },
  { value: 'black-white', label: 'Black/White' },
];

const BG_OPTIONS = [
  { value: 'primary-light', label: 'Primary Light' },
  { value: 'white', label: 'White' },
  { value: 'primary-base', label: 'Primary' },
  { value: 'black', label: 'Black' },
];

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
}: Props) {
  const [activeTab, setActiveTab] = useState<'preview' | 'customize'>('customize');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];
  const palettes = colorScheme?.tonePalettes;
  const PC = toneToColorNumber(colorScheme?.extractedTones?.primary || 60);
  const mediumIndex = PC >= 11 ? 8 : 7;

  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const update = (partial: Partial<UserSelections>) => {
    onSelectionsChanged({ ...userSelections, ...partial });
  };

  const getNavColor = (opt: string) => {
    switch (opt) {
      case 'white': return '#ffffff';
      case 'black': return '#1a1a1a';
      case 'primary': return colors[0];
      case 'primary-light': return palettes?.primary?.[12]?.hex || '#ddd';
      case 'primary-medium': return palettes?.primary?.[mediumIndex]?.hex || '#888';
      case 'primary-dark': return palettes?.primary?.[2]?.hex || '#333';
      default: return '#ccc';
    }
  };

  const cardStyle = {
    width: '100%' as const,
    borderRadius: 'var(--Card-Radius, 14px)',
  };

  const getBgColor = () => {
    switch (userSelections.background) {
      case 'white': return '#ffffff';
      case 'black': return '#1a1a1a';
      case 'primary-base': return colors[0];
      case 'primary-light': return palettes?.primary?.[12]?.hex || '#f0f0f0';
      default: return '#ffffff';
    }
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendThemeToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !colorScheme) return;

    // Generate the real CSS from the cascade — same logic as export
    const css = buildPreviewCSS({
      colorScheme,
      userSelections,
      componentStyle: 'modern',
      mode: previewMode,
    });

    iframe.contentWindow.postMessage({ type: 'update-css', css }, '*');
    iframe.contentWindow.postMessage({ type: 'update-moodboard', src: moodBoardUrl || '' }, '*');
    iframe.contentWindow.postMessage({ type: 'update-name', name: designSystemName || 'Lise' }, '*');
  }, [userSelections, colorScheme, moodBoardUrl, designSystemName, previewMode]);

  useEffect(() => {
    sendThemeToIframe();
  }, [sendThemeToIframe]);

  const handleIframeLoad = () => {
    sendThemeToIframe();
  };

  return (
    <div className="assign-colors-page">
      <H2>Assign Colors</H2>

      {/* Mobile tab toggle */}
      <div className="assign-colors-tabs">
        <Button
          variant={activeTab === 'preview' ? 'solid' : 'outline'}
          color="default"
          onClick={() => setActiveTab('preview')}
          style={{ flex: 1, borderRadius: 0 }}
        >
          Preview
        </Button>
        <Button
          variant={activeTab === 'customize' ? 'solid' : 'outline'}
          color="default"
          onClick={() => setActiveTab('customize')}
          style={{ flex: 1, borderRadius: 0 }}
        >
          Customize
        </Button>
      </div>

      <div className="assign-colors-grid">
        {/* ─── Left: Preview ─── */}
        <div className={`assign-colors-preview ${activeTab !== 'preview' ? 'hidden' : ''}`}>
          <VStack spacing={2} alignItems="center">
            <ButtonGroup size="small" variant="default-outline">
              <Button
                variant={previewMode === 'light' ? 'solid' : 'outline'}
                color="default"
                size="small"
                onClick={() => setPreviewMode('light')}
              >Light</Button>
              <Button
                variant={previewMode === 'dark' ? 'solid' : 'outline'}
                color="default"
                size="small"
                onClick={() => setPreviewMode('dark')}
              >Dark</Button>
            </ButtonGroup>

            <div className="assign-preview-container">
              <div className="assign-preview-scaler">
                <iframe
                  ref={iframeRef}
                  src="/phone-frame.html"
                  onLoad={handleIframeLoad}
                  title="Design System Preview"
                  style={{ width: 406, height: 860, border: 'none', overflow: 'hidden' }}
                />
              </div>
            </div>

            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>Preview</BodySmall>
          </VStack>
        </div>

        {/* ─── Right: Controls ─── */}
        <div className={`assign-colors-controls ${activeTab !== 'customize' ? 'hidden' : ''}`}>

      {/* Theme Order */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={2}>
          <H3 style={{ fontSize: '1rem' }}>Theme Order</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>Drag to reorder theme colors</BodySmall>
          <div className="assign-theme-order-row">
            {['Primary', 'Secondary', 'Tertiary'].map((label, i) => (
              <div
                key={label}
                draggable
                onDragStart={() => { dragItem.current = i; setDragIndex(i); }}
                onDragEnter={() => { dragOver.current = i; }}
                onDragOver={(e) => e.preventDefault()}
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
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 'var(--Style-Border-Radius)',
                  border: '1px solid var(--Border)',
                  cursor: 'grab',
                  opacity: dragIndex === i ? 0.5 : 1,
                  transition: 'opacity 0.15s ease',
                  background: 'var(--Container-Low)',
                }}
              >
                <BodySmall style={{ color: 'var(--Quiet)', cursor: 'grab' }}>⠿</BodySmall>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: colors[i] || '#ccc',
                  border: '1px solid var(--Border)',
                  flexShrink: 0,
                }} />
                <BodySmall style={{ fontWeight: 600 }}>{label}</BodySmall>
              </div>
            ))}
          </div>
        </VStack>
      </Card>

      {/* Background */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={2}>
          <H3 style={{ fontSize: '1rem' }}>Background</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>Choose your background style</BodySmall>
          <div className="assign-bg-buttons">
            {BG_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={userSelections.background === opt.value ? 'solid' : 'outline'}
                color={userSelections.background === opt.value ? 'default' : 'default'}
                size="small"
                onClick={() => update({ background: opt.value })}
                style={{ flex: 1 }}
              >
                {opt.label}
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
                  variant={userSelections.cardColoring === opt.value ? 'solid' : 'outline'}
                  color={userSelections.cardColoring === opt.value ? 'default' : 'default'}
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
                  variant={userSelections.textColoring === opt.value ? 'solid' : 'outline'}
                  color={userSelections.textColoring === opt.value ? 'default' : 'default'}
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
          <H3 style={{ fontSize: '1rem' }}>Default Buttons</H3>
          <div className="assign-buttons-row">
            {BUTTON_MODES.map(mode => (
              <Button
                key={mode.value}
                variant={userSelections.button === mode.value ? 'solid' : 'outline'}
                color={userSelections.button === mode.value ? 'default' : 'default'}
                size="small"
                onClick={() => update({ button: mode.value })}
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </VStack>
      </Card>

      {/* Navigational Elements */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={3}>
          <H3 style={{ fontSize: '1rem' }}>Navigational Elements</H3>

          {([
            { key: 'appBar' as const, label: 'App Bar' },
            { key: 'status' as const, label: 'Status Bar' },
            { key: 'navBar' as const, label: 'Navigation Bar/Tool Bar' },
          ]).map(nav => (
            <div
              key={nav.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--Border)',
                borderRadius: 'var(--Style-Border-Radius)',
                padding: '10px 16px',
              }}
            >
              <BodySmall>{nav.label}</BodySmall>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: getNavColor(userSelections[nav.key]),
                  border: '1px solid var(--Border)',
                }} />
                <select
                  value={userSelections[nav.key]}
                  onChange={e => update({ [nav.key]: e.target.value as NavOption })}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    outline: 'none',
                    color: 'var(--Text)',
                    appearance: 'none',
                    paddingRight: 16,
                  }}
                >
                  {NAV_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <BodySmall style={{ color: 'var(--Quiet)' }}>⌄</BodySmall>
              </div>
            </div>
          ))}
        </VStack>
      </Card>

        </div>
      </div>

      <HStack spacing={2} style={{ marginTop: 16 }}>
        <Button variant="outline" color="default" onClick={onBack}>Back</Button>
        <Button variant="solid" color="default" onClick={onNext}>Next</Button>
      </HStack>
    </div>
  );
}
