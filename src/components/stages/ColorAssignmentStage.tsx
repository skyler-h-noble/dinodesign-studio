import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
  Tabs, TabPanel,
} from '@dynodesign/components';
import { useState } from 'react';
import type { StageProps, UserSelections, ColorScheme } from '../../types';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  onSelectionsChanged: (selections: UserSelections) => void;
  userSelections: UserSelections;
}

type NavOption = 'white' | 'black' | 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark';
type ButtonMode = 'primary' | 'secondary' | 'tonal' | 'laddered' | 'black-white';
type CardColoring = 'tonal' | 'white' | 'black';

interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  previewColor?: string;
}

function OptionCard({ label, description, selected, onClick, previewColor }: OptionCardProps) {
  return (
    <Card
      onClick={onClick}
      padding="small"
      style={{
        outline: selected ? '2px solid var(--Buttons-Primary-Button)' : '1px solid var(--Border)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flex: 1,
        minWidth: 100,
      }}
    >
      <VStack spacing={1} alignItems="center">
        {previewColor && (
          <div style={{
            width: '100%',
            height: 32,
            background: previewColor,
            borderRadius: 'var(--Style-Border-Radius)',
            border: '1px solid var(--Border)',
          }} />
        )}
        <BodySmall style={{ fontWeight: 600, textAlign: 'center' }}>{label}</BodySmall>
        {description && (
          <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.6rem', textAlign: 'center' }}>
            {description}
          </BodySmall>
        )}
      </VStack>
    </Card>
  );
}

const NAV_OPTIONS: { value: NavOption; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'primary', label: 'Primary' },
  { value: 'primary-light', label: 'Primary Light' },
  { value: 'primary-medium', label: 'Primary Medium' },
  { value: 'primary-dark', label: 'Primary Dark' },
];

const BUTTON_MODES: { value: ButtonMode; label: string; description: string }[] = [
  { value: 'primary', label: 'Primary', description: 'Default button uses Primary palette' },
  { value: 'secondary', label: 'Secondary', description: 'Default button uses Secondary palette' },
  { value: 'tonal', label: 'Tonal', description: 'Adaptive tonal approach' },
  { value: 'laddered', label: 'Laddered', description: 'Hierarchical: Primary > Secondary > Tertiary' },
  { value: 'black-white', label: 'Black & White', description: 'Default button uses BW palette' },
];

export default function ColorAssignmentStage({
  onNext,
  onBack,
  colorScheme,
  onSelectionsChanged,
  userSelections,
}: Props) {
  const [tab, setTab] = useState('navigation');

  const primaryColor = colorScheme?.colors[0] || '#666';

  const update = (partial: Partial<UserSelections>) => {
    onSelectionsChanged({ ...userSelections, ...partial });
  };

  const getNavPreviewColor = (opt: NavOption) => {
    switch (opt) {
      case 'white': return '#ffffff';
      case 'black': return '#1a1a1a';
      case 'primary': return primaryColor;
      case 'primary-light': return colorScheme?.tonePalettes?.primary?.[11]?.hex || '#ccc';
      case 'primary-medium': return colorScheme?.tonePalettes?.primary?.[7]?.hex || '#888';
      case 'primary-dark': return colorScheme?.tonePalettes?.primary?.[2]?.hex || '#333';
      default: return '#ccc';
    }
  };

  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '40px 24px' }}>
      <VStack spacing={1} alignItems="center">
        <H2>Assign Colors</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Configure how colors are applied across your design system
        </Body>
      </VStack>

      <div style={{ maxWidth: 640, width: '100%' }}>
        <Tabs
          tabs={[
            { label: 'Navigation', value: 'navigation' },
            { label: 'Buttons', value: 'buttons' },
            { label: 'Text & Cards', value: 'text' },
          ]}
          value={tab}
          onChange={setTab}
          variant="underline"
          color="primary"
          fullWidth
        />

        <div style={{ marginTop: 24 }}>
          {/* Navigation Tab */}
          <TabPanel value="navigation" activeValue={tab}>
            <VStack spacing={4}>
              {/* App Bar */}
              <VStack spacing={2}>
                <H3 style={{ fontSize: '1rem' }}>App Bar</H3>
                <HStack spacing={1} style={{ flexWrap: 'wrap' }}>
                  {NAV_OPTIONS.map(opt => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      selected={userSelections.appBar === opt.value}
                      onClick={() => update({ appBar: opt.value })}
                      previewColor={getNavPreviewColor(opt.value)}
                    />
                  ))}
                </HStack>
              </VStack>

              {/* Nav Bar */}
              <VStack spacing={2}>
                <H3 style={{ fontSize: '1rem' }}>Nav Bar</H3>
                <HStack spacing={1} style={{ flexWrap: 'wrap' }}>
                  {NAV_OPTIONS.map(opt => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      selected={userSelections.navBar === opt.value}
                      onClick={() => update({ navBar: opt.value })}
                      previewColor={getNavPreviewColor(opt.value)}
                    />
                  ))}
                </HStack>
              </VStack>

              {/* Status Bar */}
              <VStack spacing={2}>
                <H3 style={{ fontSize: '1rem' }}>Status Bar</H3>
                <HStack spacing={1} style={{ flexWrap: 'wrap' }}>
                  {NAV_OPTIONS.map(opt => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      selected={userSelections.status === opt.value}
                      onClick={() => update({ status: opt.value })}
                      previewColor={getNavPreviewColor(opt.value)}
                    />
                  ))}
                </HStack>
              </VStack>
            </VStack>
          </TabPanel>

          {/* Buttons Tab */}
          <TabPanel value="buttons" activeValue={tab}>
            <VStack spacing={3}>
              <H3 style={{ fontSize: '1rem' }}>Button Mode</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Choose how the default button style is determined
              </BodySmall>
              <VStack spacing={1}>
                {BUTTON_MODES.map(mode => (
                  <Card
                    key={mode.value}
                    onClick={() => update({ button: mode.value })}
                    padding="medium"
                    style={{
                      outline: userSelections.button === mode.value
                        ? '2px solid var(--Buttons-Primary-Button)'
                        : '1px solid var(--Border)',
                      cursor: 'pointer',
                    }}
                  >
                    <VStack spacing={0}>
                      <Body style={{ fontWeight: 600 }}>{mode.label}</Body>
                      <BodySmall style={{ color: 'var(--Quiet)' }}>{mode.description}</BodySmall>
                    </VStack>
                  </Card>
                ))}
              </VStack>
            </VStack>
          </TabPanel>

          {/* Text & Cards Tab */}
          <TabPanel value="text" activeValue={tab}>
            <VStack spacing={4}>
              {/* Text Coloring */}
              <VStack spacing={2}>
                <H3 style={{ fontSize: '1rem' }}>Text Coloring</H3>
                <HStack spacing={2}>
                  <Card
                    onClick={() => update({ textColoring: 'tonal' })}
                    padding="medium"
                    style={{
                      flex: 1,
                      outline: userSelections.textColoring === 'tonal'
                        ? '2px solid var(--Buttons-Primary-Button)'
                        : '1px solid var(--Border)',
                      cursor: 'pointer',
                    }}
                  >
                    <VStack spacing={1}>
                      <Body style={{ fontWeight: 600 }}>Tonal</Body>
                      <BodySmall style={{ color: 'var(--Quiet)' }}>
                        Text uses palette-specific colors. More branded.
                      </BodySmall>
                    </VStack>
                  </Card>
                  <Card
                    onClick={() => update({ textColoring: 'black-white' })}
                    padding="medium"
                    style={{
                      flex: 1,
                      outline: userSelections.textColoring === 'black-white'
                        ? '2px solid var(--Buttons-Primary-Button)'
                        : '1px solid var(--Border)',
                      cursor: 'pointer',
                    }}
                  >
                    <VStack spacing={1}>
                      <Body style={{ fontWeight: 600 }}>Black & White</Body>
                      <BodySmall style={{ color: 'var(--Quiet)' }}>
                        Maximum contrast. More accessible.
                      </BodySmall>
                    </VStack>
                  </Card>
                </HStack>
              </VStack>

              {/* Card Coloring */}
              <VStack spacing={2}>
                <H3 style={{ fontSize: '1rem' }}>Card Coloring</H3>
                <HStack spacing={2}>
                  {(['tonal', 'white', 'black'] as CardColoring[]).map(opt => (
                    <Card
                      key={opt}
                      onClick={() => update({ cardColoring: opt })}
                      padding="medium"
                      style={{
                        flex: 1,
                        outline: userSelections.cardColoring === opt
                          ? '2px solid var(--Buttons-Primary-Button)'
                          : '1px solid var(--Border)',
                        cursor: 'pointer',
                      }}
                    >
                      <Body style={{ fontWeight: 600, textTransform: 'capitalize' }}>{opt}</Body>
                    </Card>
                  ))}
                </HStack>
              </VStack>
            </VStack>
          </TabPanel>
        </div>
      </div>

      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
        <Button color="primary" onClick={onNext}>Next</Button>
      </HStack>
    </VStack>
  );
}
