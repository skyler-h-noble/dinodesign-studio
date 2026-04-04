import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, ButtonGroup, Select, Link, Modal,
} from '@dynodesign/components';
import chroma from 'chroma-js';
import { useState, useRef } from 'react';
import { toneToColorNumber } from '../../utils/colorScale';
import PhonePreview from '../PhonePreview';
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

type NavOption = 'primary-light' | 'primary' | 'white' | 'black';
type ButtonMode = 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';

// App Bar / Status: theme + Surface or Surface-Bright
const NAV_OPTIONS: { value: NavOption; label: string }[] = [
  { value: 'primary-light', label: 'Primary Light' },
  { value: 'primary', label: 'Primary' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
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
  const [showButtonInfo, setShowButtonInfo] = useState(false);
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

  // Resolve the current surface palette and Color-N for nav color previews
  const getSurfaceInfo = (): { palette: typeof palettes.primary; n: number } => {
    const p = palettes?.primary || [];
    const neutral: typeof p = Array.from({ length: 12 }, (_, i) => ({
      hex: ['#050505','#1a1a1a','#2e2e2e','#434343','#585858','#8e8e8e','#a3a3a3','#b8b8b8','#cccccc','#e0e0e0','#f0f0f0','#fafafa'][i],
      tone: [1,10,19,28,37,58,71,81,90,95,98,99][i],
    }));
    switch (userSelections.background) {
      case 'black': return { palette: neutral, n: 1 };
      case 'primary-base': return { palette: p, n: PC };
      case 'primary-light': return { palette: p, n: 11 };
      default: return { palette: neutral, n: 12 }; // white
    }
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
      default: return '#ccc';
    }
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
      default: return '#ffffff';
    }
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
            <ButtonGroup size="small" variant="outline">
              <Button
                variant={previewMode === 'light' ? 'default' : 'outline'}
                size="small"
                onClick={() => setPreviewMode('light')}
              >Light</Button>
              <Button
                variant={previewMode === 'dark' ? 'default' : 'outline'}
                size="small"
                onClick={() => setPreviewMode('dark')}
              >Dark</Button>
            </ButtonGroup>
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
              />
            </div>
          </div>

          <BodySmall className="assign-preview-label" style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>Preview</BodySmall>
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
                  <BodySmall style={{ color: 'var(--Quiet)', cursor: 'grab', width: 24, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⠿</BodySmall>
                  <Button swatch swatchColor={colors[i] || '#ccc'} size="medium" />
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, width: '100%' }}>
            {([
              { key: 'status' as const, label: 'Status Bar', options: NAV_OPTIONS },
              { key: 'appBar' as const, label: 'App Bar', options: NAV_OPTIONS },
              { key: 'navBar' as const, label: 'Navigation Bar', options: NAV_OPTIONS },
            ]).map(nav => (
              <Select
                key={nav.key}
                mode="color"
                label={nav.label}
                labelPosition="top"
                size="small"
                fullWidth
                value={userSelections[nav.key]}
                onChange={(val: string) => update({ [nav.key]: val as NavOption })}
                options={nav.options.map(opt => ({
                  value: opt.value,
                  label: opt.label,
                  color: getNavColor(opt.value),
                }))}
              />
            ))}
          </div>
        </VStack>
      </Card>

      {/* Background */}
      <Card padding="medium" style={cardStyle}>
        <VStack spacing={2}>
          <H3 style={{ fontSize: '1rem' }}>Background</H3>
          <div className="assign-bg-buttons">
            {BG_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={userSelections.background === opt.value ? 'default' : 'outline'}
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
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {BUTTON_MODES.map(mode => (
              <Button
                key={mode.value}
                variant={userSelections.button === mode.value ? 'default' : 'outline'}
                size="small"
                onClick={() => update({ button: mode.value })}
                style={{ flex: 1 }}
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </VStack>
      </Card>

      {/* Button Modes Info Modal */}
      <Modal open={showButtonInfo} onClose={() => setShowButtonInfo(false)} title="Button Color Modes">
        <VStack spacing={3} style={{ maxWidth: 520 }}>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Primary</H3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Buttons use your primary theme color. On primary-tinted backgrounds, the border tone is used instead to maintain contrast.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Secondary</H3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Buttons use your secondary theme color, creating a complementary accent against primary surfaces and navigation.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Tonal</H3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Buttons use the primary border tone — a mid-range shade from your palette that has verified 3:1 contrast against the surface background.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Laddered</H3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Primary actions use the secondary color, secondary actions use tertiary, and so on — creating a visual hierarchy that cascades through your palette.
            </BodySmall>
          </VStack>
          <VStack spacing={1}>
            <H3 style={{ fontSize: '1rem' }}>Black/White</H3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Buttons are pure black on light backgrounds and pure white on dark backgrounds. In dark mode, this automatically switches to Laddered to preserve usability.
            </BodySmall>
          </VStack>
          <Button variant="outline" color="default" size="small" onClick={() => setShowButtonInfo(false)} style={{ alignSelf: 'flex-end' }}>
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
