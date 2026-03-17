import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
} from '@dynodesign/components';
import chroma from 'chroma-js';
import { useState, useRef } from 'react';
import { toneToColorNumber } from '../../utils/colorScale';
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
          <BodySmall style={{ fontWeight: 600, marginBottom: 8 }}>Preview</BodySmall>
          <div className="assign-preview-container">
          <div className="assign-preview-scaler">
          <div style={{
            width: 390,
            border: '8px solid #2e2e2e',
            borderRadius: 32,
            overflow: 'hidden',
            background: getBgColor(),
          }}>
            {/* Status bar */}
            <div style={{
              height: 28,
              background: getNavColor(userSelections.status),
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
            }}>
              <BodySmall style={{ fontSize: '0.55rem', color: chroma(getNavColor(userSelections.status)).luminance() > 0.5 ? '#000' : '#fff' }}>9:41</BodySmall>
            </div>

            {/* App bar */}
            <div style={{
              height: 44,
              background: getNavColor(userSelections.appBar),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
            }}>
              <div style={{ width: 18, height: 2, background: chroma(getNavColor(userSelections.appBar)).luminance() > 0.5 ? '#333' : '#fff', boxShadow: `0 5px 0 ${chroma(getNavColor(userSelections.appBar)).luminance() > 0.5 ? '#333' : '#fff'}, 0 10px 0 ${chroma(getNavColor(userSelections.appBar)).luminance() > 0.5 ? '#333' : '#fff'}` }} />
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1px solid ${chroma(getNavColor(userSelections.appBar)).luminance() > 0.5 ? '#999' : '#aaa'}` }} />
            </div>

            {/* Content */}
            <div style={{ padding: 12, minHeight: 340 }}>
              <Body style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 8, color: userSelections.textColoring === 'black-white' ? '#1a1a1a' : colors[0] }}>Welcome</Body>

              {/* Mood board thumbnail */}
              {moodBoardUrl && (
                <img src={moodBoardUrl} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
              )}

              {/* Card */}
              <div style={{
                background: userSelections.cardColoring === 'white' ? '#fff' : userSelections.cardColoring === 'black' ? '#1a1a1a' : palettes?.primary?.[12]?.hex || '#f5f5f5',
                borderRadius: 10, padding: 12, marginBottom: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid var(--Border)',
              }}>
                <BodySmall style={{ fontWeight: 600, fontSize: '0.75rem', color: userSelections.textColoring === 'black-white' ? (userSelections.cardColoring === 'black' ? '#fff' : '#1a1a1a') : colors[0], marginBottom: 2 }}>
                  {designSystemName || 'Lise'}
                </BodySmall>
                <BodySmall style={{ fontSize: '0.6rem', color: 'var(--Quiet)', marginBottom: 6 }}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </BodySmall>
                <div style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600,
                  background: userSelections.button === 'black-white' ? '#1a1a1a' : userSelections.button === 'secondary' ? colors[1] : colors[0],
                  color: '#fff', border: `1px solid ${userSelections.button === 'black-white' ? '#1a1a1a' : colors[0]}`,
                }}>Button</div>
              </div>

              {/* Two small cards */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: userSelections.cardColoring === 'white' ? '#fff' : userSelections.cardColoring === 'black' ? '#1a1a1a' : palettes?.secondary?.[12]?.hex || '#f5f5f5', borderRadius: 8, padding: 8, border: '1px solid var(--Border)' }}>
                  <BodySmall style={{ fontWeight: 600, fontSize: '0.6rem' }}>Next Steps</BodySmall>
                </div>
                <div style={{ flex: 1, background: userSelections.cardColoring === 'white' ? '#fff' : userSelections.cardColoring === 'black' ? '#1a1a1a' : palettes?.tertiary?.[12]?.hex || '#f5f5f5', borderRadius: 8, padding: 8, border: '1px solid var(--Border)' }}>
                  <BodySmall style={{ fontWeight: 600, fontSize: '0.6rem' }}>Have fun!</BodySmall>
                </div>
              </div>
            </div>

            {/* Nav bar */}
            <div style={{
              height: 50,
              background: getNavColor(userSelections.navBar),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              borderTop: '1px solid var(--Border)',
              padding: '0 8px',
            }}>
              {['Home', 'Tickets', 'Travel', 'Hotels', 'Food'].map(label => (
                <VStack key={label} spacing={0} alignItems="center">
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: chroma(getNavColor(userSelections.navBar)).luminance() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)' }} />
                  <BodySmall style={{ fontSize: '0.4rem', color: chroma(getNavColor(userSelections.navBar)).luminance() > 0.5 ? '#666' : '#ddd' }}>{label}</BodySmall>
                </VStack>
              ))}
            </div>
          </div>
          </div>
          </div>
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
