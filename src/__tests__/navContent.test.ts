import { describe, it, expect } from 'vitest';
import {
  itemProblems, itemRendersNothing, buttonVariant, DEFAULT_TABS,
  decoratorAt, setDecorator, type NavItem,
} from '../utils/addOns/navContent';
import { resolveIcon } from '../components/NavIconGlyph';

/* These are the failures that SHIP rather than fail: every one renders
   something, and every one is invisible without a screen reader or a careful
   look. Checking them is the only way they get noticed. */

const item = (over: Partial<NavItem> = {}): NavItem =>
  ({ id: 'x', label: 'Home', text: true, ...over });

describe('what a nav item must have', () => {
  it('an item with the text off still needs a name', () => {
    // Announced as just "button" otherwise, which says nothing.
    expect(itemProblems(item({ text: false, label: '', startIcon: true, startIconName: 'Search' })))
      .toContainEqual(expect.stringContaining('announced as just'));
  });

  it('and the name must describe the action, not the glyph', () => {
    expect(itemProblems(item({ text: false, label: 'OK', startIcon: true, startIconName: 'Check' })))
      .toContainEqual(expect.stringContaining('names the glyph'));
  });

  it('text off with nothing else renders nothing at all', () => {
    /* Not a styling problem — an empty control that still takes focus and can
       still be clicked. */
    expect(itemProblems(item({ text: false })))
      .toContainEqual(expect.stringContaining('renders nothing'));
  });

  it('an icon switched on with no name is caught', () => {
    expect(itemProblems(item({ startIcon: true }))).toContainEqual(expect.stringContaining('Start icon'));
    expect(itemProblems(item({ endIcon: true, endIconName: 'Add' }))).toEqual([]);
  });

  it('initials avatar with no initials is caught', () => {
    expect(itemProblems(item({ startAvatar: true, avatarType: 'initials' })))
      .toContainEqual(expect.stringContaining('initials'));
  });

  it('the defaults are all clean', () => {
    // Opening on a warning would teach that warnings are normal.
    for (const t of DEFAULT_TABS) expect([t.label, itemProblems(t)]).toEqual([t.label, []]);
  });
});

describe('icon names are typed, so they have to be resolved', () => {
  it('accepts the exact export name', () => {
    expect(resolveIcon('Search')).toBeTruthy();
  });

  it('and the forms a person would reasonably type', () => {
    /* The reference page shows names in several shapes, so accepting only one
       would make correct-looking input fail. */
    for (const n of ['expand-more', 'expand more', 'expandMore', 'ExpandMore']) {
      expect([n, !!resolveIcon(n)]).toEqual([n, true]);
    }
  });

  it('returns nothing for a name that does not exist', () => {
    // The caller shows a marker rather than empty space — an empty icon slot
    // reads as a spacing quirk, and only a marker gets fixed.
    expect(resolveIcon('NotAnIcon')).toBeNull();
    expect(resolveIcon('')).toBeNull();
    expect(resolveIcon(undefined)).toBeNull();
  });
});

describe('button variants compose the way the lib expects', () => {
  it('solid is the bare colour, everything else is suffixed', () => {
    expect(buttonVariant('primary', 'solid')).toBe('primary');
    expect(buttonVariant('primary', 'outline')).toBe('primary-outline');
    expect(buttonVariant('error', 'ghost')).toBe('error-ghost');
  });
});

describe('an item that would render nothing is refused', () => {
  /* Not a warning. Text off, no icon, no avatar is an empty control that still
     takes focus and can still be clicked — there is no reading of it that is
     intended, so it is blocked rather than reported. */
  it('catches the empty case', () => {
    expect(itemRendersNothing(item({ text: false }))).toBe(true);
    expect(itemRendersNothing(item({ text: true, label: '   ' }))).toBe(true);
  });

  it('an icon switched on with no NAME does not count as content', () => {
    // The switch being on is not the same as something rendering: an unnamed
    // icon resolves to nothing.
    expect(itemRendersNothing(item({ text: false, startIcon: true }))).toBe(true);
    expect(itemRendersNothing(item({ text: false, startIcon: true, startIconName: 'Search' }))).toBe(false);
  });

  it('an avatar is enough on its own', () => {
    // It always renders something — a photo, initials or a glyph.
    expect(itemRendersNothing(item({ text: false, endAvatar: true }))).toBe(false);
  });

  it('text alone is enough', () => {
    expect(itemRendersNothing(item())).toBe(false);
  });
});

/* --- One decorator per end --- */
describe('a decorator is one choice, not two switches', () => {
  /* startIcon and startAvatar are separate booleans because those are Figma's
     variant property names and the converter has to line up with them. They
     are NOT independent: one end holds one decorator, and with both set the
     renderer takes the avatar and drops the icon — so the old pair of switches
     could express a state the component cannot render, and the icon switch
     stayed on with nothing appearing. */
  it('reads back what the renderer would actually draw', () => {
    const both = { id: 'a', label: 'X', startIcon: true, startAvatar: true };
    expect(decoratorAt(both, 'start')).toBe('avatar');
  });

  it('turning one on turns the other off', () => {
    let item: NavItem = { id: 'a', label: 'X' };
    item = setDecorator(item, 'start', 'icon');
    expect([item.startIcon, item.startAvatar]).toEqual([true, false]);
    item = setDecorator(item, 'start', 'avatar');
    expect([item.startIcon, item.startAvatar]).toEqual([false, true]);
  });

  it('off clears both', () => {
    const item = setDecorator(
      { id: 'a', label: 'X', startIcon: true, startAvatar: true }, 'start', 'none',
    );
    expect([item.startIcon, item.startAvatar]).toEqual([false, false]);
    expect(decoratorAt(item, 'start')).toBe('none');
  });

  it('seeds an icon name, so the field is never empty on arrival', () => {
    // An empty name renders the not-found marker straight away, which reads
    // as an error the user just caused rather than a field not yet filled in.
    expect(setDecorator({ id: 'a', label: 'X' }, 'start', 'icon').startIconName).toBe('Menu');
  });

  it('keeps a name the user already typed', () => {
    const item = setDecorator({ id: 'a', label: 'X', startIconName: 'Search' }, 'start', 'icon');
    expect(item.startIconName).toBe('Search');
  });

  it('the two ends are independent of each other', () => {
    let item: NavItem = { id: 'a', label: 'X' };
    item = setDecorator(item, 'start', 'avatar');
    item = setDecorator(item, 'end', 'icon');
    expect(decoratorAt(item, 'start')).toBe('avatar');
    expect(decoratorAt(item, 'end')).toBe('icon');
  });
});
