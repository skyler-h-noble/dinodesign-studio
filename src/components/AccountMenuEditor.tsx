/**
 * Edit the account menu — the whole list, not one row at a time.
 *
 * Tabs and action buttons are edited one by one, because each is a separate
 * control you can point at and the strip's order is barely a design decision.
 * A menu is the other way round: ORDER and GROUPING are most of what the
 * design is — "Sign out" last, and set apart from the rest — and neither can
 * be judged from a modal showing one row. So the list is the unit here, and
 * the divider is a property of the row below the rule rather than an item of
 * its own, which is what keeps a removal from stranding a rule at the top.
 */
import {
  Modal, Button, VStack, HStack, Caption, BodySmall, Alert, Link,
  TextField, SwitchInput, Divider, H4, MenuItem, MenuDivider,
} from '@omni-design/components';
import { ICON_REFERENCE_URL } from '../utils/addOns/navContent';
import {
  accountMenuProblems, newAccountItem, type AccountMenuItem,
} from '../utils/addOns/accountMenu';
import NavIconGlyph from './NavIconGlyph';

export interface AccountMenuEditorProps {
  open: boolean;
  items: AccountMenuItem[];
  onChange: (next: AccountMenuItem[]) => void;
  onClose: () => void;
}

export default function AccountMenuEditor(
  { open, items, onChange, onClose }: AccountMenuEditorProps,
) {
  const problems = accountMenuProblems(items);
  /* Refused rather than warned about, the same rule the item editor uses: a
     row with no label is a clickable empty strip announced as nothing, and
     there is no reading of it that is intended. */
  const blocked = items.some((i) => !i.label.trim()) || items.length === 0;

  const patch = (id: string, next: Partial<AccountMenuItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...next } : i)));

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  /* Order is the design, so it has to be editable, and two buttons are the
     honest way to do it here: drag-and-drop needs pointer AND keyboard paths
     to be usable at all, and a half-built one is worse than none. */
  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    /* A rule belongs to a POSITION in the list, not to the row that happens to
       be under it — so a row carrying one to the top would leave a rule above
       the first item, which draws a line against nothing. */
    if (to === 0 && next[0].dividerBefore) next[0] = { ...next[0], dividerBefore: false };
    onChange(next);
  };

  return (
    <Modal open={open} onClose={() => { if (!blocked) onClose(); }} size="medium">
      <VStack gap="var(--Sizing-3)">
        <H4>Account menu</H4>

        {/* The real rows, from the library's own Menu — so what is judged here
            is the panel that will ship rather than a sketch of it. */}
        <div style={{
          border: '1px solid var(--Border)',
          borderRadius: 'var(--Dropdown-Frame-Radius, 8px)',
          overflow: 'hidden',
          padding: 'var(--Sizing-1, 4px) 0',
        }} data-surface="Surface-Brightest">
          {items.length === 0 ? (
            <div style={{ padding: 'var(--Sizing-3, 12px)', textAlign: 'center' }}>
              <Caption color="quiet">Nothing to show yet</Caption>
            </div>
          ) : items.map((i) => (
            <div key={i.id}>
              {i.dividerBefore && <MenuDivider />}
              <MenuItem>
                {/* A SPAN, not an HStack.

                    MenuItem wraps everything it is given in one Body, which
                    renders a <p> — so a div inside it is invalid nesting that
                    the browser silently repairs by breaking the row apart. An
                    inline-flex span is valid inside a paragraph and is a
                    layout primitive, which is the sanctioned exception.

                    The gap sits here rather than on MenuItem for the same
                    reason: MenuItem's own gap applies to its one child, the
                    paragraph, so it never reaches the icon. MenuItem having no
                    startDecorator the way Tab does is a real lib gap. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--Sizing-1, 4px)' }}>
                  {i.iconName ? <NavIconGlyph name={i.iconName} /> : null}
                  {i.label || 'Unnamed'}
                </span>
              </MenuItem>
            </div>
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
            <VStack key={item.id} gap="var(--Sizing-2)">
              <HStack gap="var(--Sizing-2)" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <TextField
                    label="Label"
                    value={item.label}
                    onChange={(e: { target: { value: string } }) =>
                      patch(item.id, { label: e.target.value })}
                    size="small"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <TextField
                    label="Icon name"
                    value={item.iconName ?? ''}
                    placeholder="e.g. Person, Settings, Logout"
                    onChange={(e: { target: { value: string } }) =>
                      patch(item.id, { iconName: e.target.value })}
                    size="small"
                  />
                </div>
                <Button
                  iconOnly
                  variant="default-ghost"
                  size="small"
                  aria-label={`Move ${item.label || 'item'} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <NavIconGlyph name="ArrowUpward" />
                </Button>
                <Button
                  iconOnly
                  variant="default-ghost"
                  size="small"
                  aria-label={`Move ${item.label || 'item'} down`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <NavIconGlyph name="ArrowDownward" />
                </Button>
                <Button
                  variant="error-ghost"
                  size="small"
                  onClick={() => remove(item.id)}
                >
                  Remove
                </Button>
              </HStack>
              {/* Not offered on the first row: a rule above the top item draws
                  a line against nothing. */}
              {index > 0 && (
                <SwitchInput
                  checked={!!item.dividerBefore}
                  onChange={(e: { target: { checked: boolean } }) =>
                    patch(item.id, { dividerBefore: e.target.checked })}
                  label="Rule above"
                />
              )}
            </VStack>
          ))}
        </VStack>

        <Caption color="quiet">
          Icon names are typed rather than picked — the set runs to several thousand,
          so a picker is a search problem and a curated dozen is a guess that will be
          wrong for somebody.{' '}
          <Link href={ICON_REFERENCE_URL} target="_blank" rel="noreferrer">
            Browse the names
          </Link>
          . Leave it empty for a row with no icon.
        </Caption>

        <Caption color="quiet">
          The rows stay HERE. The published add-on carries the panel — its corner, its
          surface, the fact that it hangs under the avatar — and leaves the rows as a
          slot, the same as the tabs, so each design system fills it with its own.
        </Caption>

        <Divider />
        <HStack gap="var(--Sizing-2)" style={{ justifyContent: 'space-between' }}>
          <Button
            variant="default-outline"
            onClick={() => onChange([...items, newAccountItem()])}
          >
            Add item
          </Button>
          <Button variant="default" disabled={blocked} onClick={onClose}>Done</Button>
        </HStack>
      </VStack>
    </Modal>
  );
}
