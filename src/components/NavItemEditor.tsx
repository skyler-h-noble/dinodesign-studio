/**
 * Edit one tab or action button.
 *
 * Opened by clicking the item in the preview, so what is edited is the thing
 * just pointed at rather than a row in a list somewhere else — the item and
 * its settings are never out of step because there is only ever one open.
 */
import {
  Modal, Button, VStack, HStack, Label, Caption, BodySmall, Alert,
  TextField, SwitchInput, Divider, H4,
} from '@omni-design/components';
import {
  NAV_ICONS, BUTTON_VARIANTS, BUTTON_TREATMENTS, itemProblems,
  type NavItem, type NavButtonItem, type NavIcon, type ButtonTreatment,
} from '../utils/addOns/navContent';
import NavIconGlyph from './NavIconGlyph';

export interface NavItemEditorProps {
  open: boolean;
  item: NavItem | NavButtonItem | null;
  /** Buttons carry a variant; tabs do not. */
  kind: 'tab' | 'button';
  onChange: (next: NavItem | NavButtonItem) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function NavItemEditor(
  { open, item, kind, onChange, onRemove, onClose }: NavItemEditorProps,
) {
  if (!item) return null;
  const asButton = item as NavButtonItem;
  const problems = itemProblems(item);

  const set = <K extends keyof NavButtonItem>(k: K, v: NavButtonItem[K]) =>
    onChange({ ...(item as NavButtonItem), [k]: v });

  return (
    <Modal open={open} onClose={onClose} size="medium">
      <VStack gap="var(--Sizing-3)">
        <H4>{kind === 'tab' ? 'Tab' : 'Button'}</H4>

        {problems.length > 0 && (
          <Alert severity="warning">
            <VStack gap="var(--Sizing-Half)">
              {problems.map((p) => <BodySmall key={p}>{p}</BodySmall>)}
            </VStack>
          </Alert>
        )}

        <TextField
          label={item.iconOnly ? 'Accessible name' : 'Label'}
          value={item.label}
          onChange={(e: { target: { value: string } }) => set('label', e.target.value)}
        />
        {item.iconOnly && (
          <Caption color="quiet">
            Not shown on screen, but read aloud. Name the ACTION rather than the
            glyph — "Search products", not "magnifier".
          </Caption>
        )}

        <Divider />

        <Label>Icon</Label>
        <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
          <Button
            variant={item.icon ? 'default-outline' : 'default'}
            size="small"
            onClick={() => onChange({ ...item, icon: undefined, iconOnly: false })}
          >
            None
          </Button>
          {NAV_ICONS.map((name) => (
            <Button
              key={name}
              iconOnly
              size="small"
              variant={item.icon === name ? 'default' : 'default-outline'}
              aria-label={name}
              onClick={() => set('icon', name as NavIcon)}
            >
              <NavIconGlyph name={name} />
            </Button>
          ))}
        </HStack>

        {item.icon && (
          <>
            <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
              {(['start', 'end'] as const).map((pos) => (
                <Button
                  key={pos}
                  size="small"
                  disabled={item.iconOnly}
                  variant={(item.iconPosition ?? 'start') === pos ? 'default' : 'default-outline'}
                  onClick={() => set('iconPosition', pos)}
                >
                  {pos === 'start' ? 'Before label' : 'After label'}
                </Button>
              ))}
            </HStack>
            <SwitchInput
              checked={!!item.iconOnly}
              onChange={(e: { target: { checked: boolean } }) => set('iconOnly', e.target.checked)}
              label="Icon only"
            />
          </>
        )}

        {/* Both kinds get these. A tab IS a button — your Figma Tab is built on
            Button tokens — so hiding the variant controls from one of them would
            invent a distinction the design system does not make, and leave a
            "tab variant" and a "button variant" as two vocabularies for one
            idea. */}
        <>
            <Divider />
            <Label>Colour</Label>
            <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
              {BUTTON_VARIANTS.map((c) => (
                <Button
                  key={c}
                  size="small"
                  variant={asButton.colour === c ? c : `${c}-outline`}
                  onClick={() => set('colour', c)}
                >
                  {c}
                </Button>
              ))}
            </HStack>

            <Label>Treatment</Label>
            <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
              {BUTTON_TREATMENTS.map((t) => (
                <Button
                  key={t}
                  size="small"
                  variant={asButton.treatment === t ? 'default' : 'default-outline'}
                  onClick={() => set('treatment', t as ButtonTreatment)}
                >
                  {t}
                </Button>
              ))}
            </HStack>
        </>

        <Divider />
        <HStack gap="var(--Sizing-2)" style={{ justifyContent: 'space-between' }}>
          <Button variant="error-ghost" onClick={onRemove}>Remove</Button>
          <Button variant="default" onClick={onClose}>Done</Button>
        </HStack>
      </VStack>
    </Modal>
  );
}
