/**
 * Edit one tab or action button.
 *
 * The controls mirror the Figma component's variant properties one for one —
 * startIcon, startAvatar, endIcon, endAvatar, text — rather than a tidier
 * scheme of my own. The converter has to line them up either way, and two
 * vocabularies for one set of switches is a translation step that exists only
 * to be got wrong.
 */
import {
  Modal, Button, VStack, HStack, Label, Caption, BodySmall, Alert, Link,
  TextField, SwitchInput, Divider, H4, Avatar, Tabs, TabList, Tab,
} from '@omni-design/components';
import {
  BUTTON_VARIANTS, BUTTON_TREATMENTS, AVATAR_TYPES, ICON_REFERENCE_URL,
  itemProblems, itemRendersNothing, buttonVariant,
  type NavItem, type NavButtonItem, type ButtonTreatment, type AvatarType,
} from '../utils/addOns/navContent';
import NavIconGlyph from './NavIconGlyph';

export interface NavItemEditorProps {
  open: boolean;
  item: NavItem | NavButtonItem | null;
  /** Buttons carry a colour and treatment; tabs do not — a tab's treatment is
   *  a selector bar, not a fill. */
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
  const hasAvatar = !!(item.startAvatar || item.endAvatar);
  /* Refused, not warned about. An item with no text, icon or avatar is an
     empty control that still takes focus and can still be clicked — there is
     no reading of it that is intended. */
  const blocked = itemRendersNothing(item);

  const deco = (end: 'start' | 'end') => {
    const wantsAvatar = end === 'start' ? item.startAvatar : item.endAvatar;
    if (wantsAvatar) {
      return (
        <Avatar
          size="x-small"
          alt=""
          initials={item.avatarType === 'initials' ? (item.avatarInitials || '?') : undefined}
          defaultPhoto={item.avatarType !== 'icon'}
        />
      );
    }
    const wantsIcon = end === 'start' ? item.startIcon : item.endIcon;
    const iconName = end === 'start' ? item.startIconName : item.endIconName;
    return wantsIcon ? <NavIconGlyph name={iconName} /> : undefined;
  };

  const set = <K extends keyof NavButtonItem>(k: K, v: NavButtonItem[K]) =>
    onChange({ ...(item as NavButtonItem), [k]: v });

  return (
    /* onClose is guarded, not just the Done button. Escape and the backdrop
       reach onClose too, so disabling one button would leave two ways to keep
       an item that renders nothing. */
    <Modal open={open} onClose={() => { if (!blocked) onClose(); }} size="medium">
      <VStack gap="var(--Sizing-3)">
        <H4>{kind === 'tab' ? 'Tab' : 'Button'}</H4>

        {/* The item itself, rendered by the same components the nav uses — so
            what is shown here is what will appear in the bar, not a sketch of
            it. A tab keeps its selector, which is most of what makes a tab
            legible as one and cannot be judged from switches. */}
        <div style={{
          border: '1px solid var(--Border)',
          padding: 'var(--Sizing-3, 12px)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          {blocked ? (
            <Caption color="quiet">Nothing to show yet</Caption>
          ) : kind === 'tab' ? (
            <Tabs value={item.id}>
              <TabList>
                <Tab
                  value={item.id}
                  iconOnly={!item.text}
                  aria-label={!item.text ? item.label || 'Unnamed tab' : undefined}
                  startDecorator={deco('start')}
                  endDecorator={deco('end')}
                >
                  {item.text ? item.label : null}
                </Tab>
              </TabList>
            </Tabs>
          ) : (
            <Button
              variant={buttonVariant(asButton.colour, asButton.treatment)}
              size="small"
              iconOnly={!item.text}
              aria-label={!item.text ? item.label || 'Unnamed button' : undefined}
            >
              {deco('start')}
              {item.text ? item.label : null}
              {deco('end')}
            </Button>
          )}
        </div>

        {blocked && (
          <Alert severity="error">
            <BodySmall>
              Nothing would render. An item with no text, icon or avatar is an empty
              control that still takes focus and can still be clicked.
            </BodySmall>
          </Alert>
        )}

        {problems.length > 0 && (
          <Alert severity="warning">
            <VStack gap="var(--Sizing-Half)">
              {problems.map((p) => <BodySmall key={p}>{p}</BodySmall>)}
            </VStack>
          </Alert>
        )}

        <TextField
          label={item.text ? 'Label' : 'Accessible name'}
          value={item.label}
          onChange={(e: { target: { value: string } }) => set('label', e.target.value)}
        />
        <SwitchInput
          checked={!!item.text}
          onChange={(e: { target: { checked: boolean } }) => set('text', e.target.checked)}
          label="Text"
        />
        {!item.text && (
          <Caption color="quiet">
            Still read aloud with the text off. Name the ACTION rather than the glyph —
            "Search products", not "magnifier".
          </Caption>
        )}

        <Divider />

        {/* Both ends, independently. A tab with an avatar before the label and a
            chevron after it is one item, not a special case. */}
        {(['start', 'end'] as const).map((end) => {
          const iconKey = end === 'start' ? 'startIcon' : 'endIcon';
          const nameKey = end === 'start' ? 'startIconName' : 'endIconName';
          const avatarKey = end === 'start' ? 'startAvatar' : 'endAvatar';
          return (
            <VStack key={end} gap="var(--Sizing-2)">
              <Label>{end === 'start' ? 'Before the label' : 'After the label'}</Label>
              <HStack gap="var(--Sizing-3)" style={{ flexWrap: 'wrap' }}>
                <SwitchInput
                  checked={!!item[iconKey]}
                  onChange={(e: { target: { checked: boolean } }) => {
                    /* Switching it on seeds a name. An empty field renders the
                       not-found marker straight away, which reads as an error
                       the user just caused rather than a field they have not
                       filled in yet. Menu is the safe seed: it is the icon a
                       nav most often wants, and it is a real name so the
                       preview shows something real. */
                    const on = e.target.checked;
                    onChange({
                      ...(item as NavButtonItem),
                      [iconKey]: on,
                      ...(on && !item[nameKey]?.trim() ? { [nameKey]: 'Menu' } : {}),
                    });
                  }}
                  label="Icon"
                />
                <SwitchInput
                  checked={!!item[avatarKey]}
                  onChange={(e: { target: { checked: boolean } }) => set(avatarKey, e.target.checked)}
                  label="Avatar"
                />
              </HStack>
              {item[iconKey] && (
                <>
                  <TextField
                    label="Icon name"
                    value={item[nameKey] ?? ''}
                    placeholder="e.g. Search, ExpandMore, Notifications"
                    onChange={(e: { target: { value: string } }) => set(nameKey, e.target.value)}
                  />
                  <Caption color="quiet">
                    Typed rather than picked: the set runs to several thousand, so a
                    picker is a search problem and a curated dozen is a guess that will
                    be wrong for somebody.{' '}
                    <Link href={ICON_REFERENCE_URL} target="_blank" rel="noreferrer">
                      Browse the names
                    </Link>
                    . A name that does not resolve renders nothing, so it is reported
                    rather than left looking like a missing icon.
                  </Caption>
                </>
              )}
            </VStack>
          );
        })}

        {hasAvatar && (
          <>
            <Divider />
            <Label>Avatar</Label>
            <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              {AVATAR_TYPES.map((t) => (
                <Button
                  key={t}
                  size="small"
                  variant={(item.avatarType ?? 'photo') === t ? 'default' : 'default-outline'}
                  onClick={() => set('avatarType', t as AvatarType)}
                >
                  {t}
                </Button>
              ))}
              <Avatar
                size="x-small"
                alt=""
                initials={item.avatarType === 'initials' ? (item.avatarInitials || '?') : undefined}
                defaultPhoto={item.avatarType !== 'icon'}
              />
            </HStack>
            {item.avatarType === 'initials' && (
              <TextField
                label="Initials"
                value={item.avatarInitials ?? ''}
                placeholder="JD"
                onChange={(e: { target: { value: string } }) => set('avatarInitials', e.target.value)}
              />
            )}
            <Caption color="quiet">
              A photo, initials and a glyph are different CONTENT rather than different
              styling, which is why it is a choice and not a colour.
            </Caption>
          </>
        )}

        {/* Buttons only. A tab is built from Button TOKENS but its treatment is a
            selector — an indicator bar and a track — not a fill. Offering colour
            here would produce a solid tab, which the design system does not have. */}
        {kind === 'button' && (
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
        )}

        <Divider />
        <HStack gap="var(--Sizing-2)" style={{ justifyContent: 'space-between' }}>
          <Button variant="error-ghost" onClick={onRemove}>Remove</Button>
          <Button variant="default" disabled={blocked} onClick={onClose}>Done</Button>
        </HStack>
      </VStack>
    </Modal>
  );
}
