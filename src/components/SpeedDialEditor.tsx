/**
 * Edit the speed dial — the whole list, the way the account menu is edited.
 *
 * Same argument: a short list of actions is judged as a list, in order, and a
 * modal showing one row cannot show whether "Upload" belongs above "Record".
 * Narrower than the account editor by design — no rule between rows, because
 * a speed dial is a flat handful of peers and grouping inside it is a menu's
 * job — so it is its own editor rather than that one with a switch hidden.
 */
import {
  Modal, Button, VStack, HStack, Caption, BodySmall, Alert, Link,
  TextField, Divider, H4, LabelSmall,
} from '@omni-design/components';
import { ICON_REFERENCE_URL } from '../utils/addOns/navContent';
import {
  speedDialProblems, newSpeedDialItem, MAX_SPEED_DIAL_ITEMS, type SpeedDialItem,
} from '../utils/addOns/speedDial';
import NavIconGlyph from './NavIconGlyph';

export interface SpeedDialEditorProps {
  open: boolean;
  items: SpeedDialItem[];
  onChange: (next: SpeedDialItem[]) => void;
  onClose: () => void;
}

export default function SpeedDialEditor(
  { open, items, onChange, onClose }: SpeedDialEditorProps,
) {
  const problems = speedDialProblems(items);
  const blocked = problems.length > 0;

  const patch = (id: string, next: Partial<SpeedDialItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...next } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <Modal open={open} onClose={() => { if (!blocked) onClose(); }} size="medium">
      <VStack gap="var(--Sizing-3)">
        <H4>Speed dial</H4>

        {/* The rows as the dial stacks them: first action nearest the ring,
            so the list reads bottom-up here the way it will on the phone. */}
        <div
          style={{
            border: '1px solid var(--Border)',
            borderRadius: 'var(--Dropdown-Frame-Radius, 8px)',
            padding: 'var(--Sizing-1, 8px)',
            display: 'flex', flexDirection: 'column-reverse', gap: 'var(--Sizing-1, 8px)',
            alignItems: 'flex-start',
          }}
          data-surface="Surface-Brightest"
        >
          {items.length === 0 ? (
            <Caption color="quiet">Nothing to show yet</Caption>
          ) : items.map((i) => (
            <span key={i.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--Sizing-1, 8px)' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 40,
                border: 'var(--Button-Border-Width, 1px) solid var(--Buttons-Default-Border)',
                color: 'var(--Buttons-Default-Border)',
              }}>
                <NavIconGlyph name={i.iconName || 'Add'} />
              </span>
              <LabelSmall>{i.label || 'Unnamed'}</LabelSmall>
            </span>
          ))}
        </div>

        {problems.length > 0 && (
          <Alert severity="error">
            <VStack gap="var(--Sizing-Half)">
              {problems.map((p) => <BodySmall key={p}>{p}</BodySmall>)}
            </VStack>
          </Alert>
        )}

        <Divider />

        <VStack gap="var(--Sizing-3)">
          {items.map((item, index) => (
            <HStack key={item.id} gap="var(--Sizing-2)" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <TextField
                  label="Label"
                  value={item.label}
                  onChange={(e: { target: { value: string } }) => patch(item.id, { label: e.target.value })}
                  size="small"
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <TextField
                  label="Icon name"
                  value={item.iconName ?? ''}
                  placeholder="e.g. Edit, Upload, Mic"
                  onChange={(e: { target: { value: string } }) => patch(item.id, { iconName: e.target.value })}
                  size="small"
                />
              </div>
              <Button iconOnly variant="ghost" size="small"
                aria-label={`Move ${item.label || 'action'} down the dial`}
                disabled={index === 0} onClick={() => move(index, -1)}>
                <NavIconGlyph name="ArrowDownward" />
              </Button>
              <Button iconOnly variant="ghost" size="small"
                aria-label={`Move ${item.label || 'action'} up the dial`}
                disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                <NavIconGlyph name="ArrowUpward" />
              </Button>
              <Button variant="ghost" size="small" onClick={() => remove(item.id)}>Remove</Button>
            </HStack>
          ))}
        </VStack>

        <Caption color="quiet">
          The first action sits nearest the ring and the rest climb from it. Icon
          names are typed rather than picked —{' '}
          <Link href={ICON_REFERENCE_URL} target="_blank" rel="noreferrer">browse the names</Link>.
          Up to {MAX_SPEED_DIAL_ITEMS}: past that the top one is out of thumb reach.
        </Caption>

        <Caption color="quiet">
          The actions stay HERE. The published add-on carries the open/closed variable
          for the Nav-Bar's dial; the rows are the importing design system's to fill.
        </Caption>

        <Divider />
        <HStack gap="var(--Sizing-2)" style={{ justifyContent: 'space-between' }}>
          <Button variant="default-outline"
            disabled={items.length >= MAX_SPEED_DIAL_ITEMS}
            onClick={() => onChange([...items, newSpeedDialItem()])}>
            Add action
          </Button>
          <Button variant="default" disabled={blocked} onClick={onClose}>Done</Button>
        </HStack>
      </VStack>
    </Modal>
  );
}
