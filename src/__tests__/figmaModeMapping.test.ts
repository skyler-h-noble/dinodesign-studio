import { describe, it, expect } from 'vitest';
import {
  resolveMode, buttonVariant, buttonVariantLosesColour,
  COMPONENT_SIZE_TO_PROP, COMPONENT_SIZE_DEFAULT,
  MENU_LEVEL_LEFT_MARGIN, irregularMenuLevels, menuLevelIfRegular,
  MENU_LEVEL_BASE, MENU_LEVEL_STEP,
  ICON_AVATAR_PX, ICON_AVATAR_MODE_TO_LIB_SIZE, iconAvatarSize, isIconAvatarContext,
  isAmbientCollection, DEVICE_TO_SIZE_CLASS,
  ALT_DISPLAY_PAINT, altDisplayIsFlat, COLLECTIONS_THAT_BECOME_PROPS,
  type ModeNode,
} from '../utils/figmaModeMapping';

const CS = 'VariableCollectionId:2410:836';
const NAMES = { m1: 'small', m2: 'medium', m3: 'large' };

describe('resolveMode — a mode is pinned on an ANCESTOR, not the instance', () => {
  it('walks up to the nearest ancestor that pins one', () => {
    /* The whole reason this function exists. Sampling the Buttons page, the
       pins sit on boards and wrappers — `Buttons[FRAME]` pins Component-Size
       small so the board can show the small row. The instance itself pins
       nothing, so a converter reading only the instance sees nothing. */
    const board: ModeNode = { explicitVariableModes: { [CS]: 'm1' }, parent: null };
    const wrapper: ModeNode = { parent: board };
    const instance: ModeNode = { parent: wrapper };
    expect(resolveMode(instance, CS, NAMES, 'medium')).toBe('small');
  });

  it('takes the NEAREST pin when ancestors disagree', () => {
    /* A large board can hold a small card. Taking the outermost pin would size
       every component on the page the same, which is the bug this ordering
       prevents. */
    const outer: ModeNode = { explicitVariableModes: { [CS]: 'm3' }, parent: null };
    const inner: ModeNode = { explicitVariableModes: { [CS]: 'm1' }, parent: outer };
    expect(resolveMode({ parent: inner }, CS, NAMES, 'medium')).toBe('small');
  });

  it('falls back to the collection default when nothing pins', () => {
    expect(resolveMode({ parent: null }, CS, NAMES, 'medium')).toBe('medium');
  });

  it('ignores a pin for a DIFFERENT collection', () => {
    /* explicitVariableModes holds every collection a node pins. Reading the
       wrong key returns another axis's mode name, which would type-check and
       be wrong — a Theme pin arriving where a size was expected. */
    const n: ModeNode = { explicitVariableModes: { 'VariableCollectionId:other': 'm3' }, parent: null };
    expect(resolveMode(n, CS, NAMES, 'medium')).toBe('medium');
  });
});

describe('Component-Size → size prop', () => {
  it('maps one to one', () => {
    expect(COMPONENT_SIZE_TO_PROP).toEqual({ small: 'small', medium: 'medium', large: 'large' });
  });

  it('defaults to medium, which must be EMITTED not omitted', () => {
    /* A component on a board pinning nothing renders medium. Most lib defaults
       are medium too, but Avatar's is x-small — so omitting the prop there
       silently changes the size. */
    expect(COMPONENT_SIZE_DEFAULT).toBe('medium');
  });
});

describe('Buttons → variant string (TWO Figma axes compose into ONE)', () => {
  it('solid is the colour alone', () => {
    expect(buttonVariant('primary', 'solid')).toBe('primary');
    expect(buttonVariant('default', 'solid')).toBe('default');
  });

  it('outline suffixes the colour', () => {
    expect(buttonVariant('primary', 'outline')).toBe('primary-outline');
    expect(buttonVariant('black-white', 'outline')).toBe('black-white-outline');
  });

  it('ghost DISCARDS the colour — a real capability gap', () => {
    /* Figma can draw a ghost button in any of the ten palettes, because the
       mode drives Buttons::Text / ::Hover / ::Pressed. The lib's ghost takes no
       colour at all — `ghostStyles(isTextContent, selected)` has no colour
       parameter. So ten Figma combinations collapse to one lib variant.

       Asserted rather than worked around: inventing `{color}-ghost` would be a
       token the lib has never shipped and every published stylesheet would
       have to grow one. The test records the loss so it stays a decision. */
    expect(buttonVariant('primary', 'ghost')).toBe('ghost');
    expect(buttonVariant('error', 'ghost')).toBe('ghost');
    expect(buttonVariant('default', 'ghost')).toBe('ghost');
  });

  it('flags when the mapping loses information', () => {
    expect(buttonVariantLosesColour('ghost', 'primary')).toBe(true);
    expect(buttonVariantLosesColour('ghost', 'default')).toBe(false);
    expect(buttonVariantLosesColour('solid', 'primary')).toBe(false);
  });
});

describe('Menu-Levels', () => {
  it('carries seven levels of Left-Margin', () => {
    expect(Object.keys(MENU_LEVEL_LEFT_MARGIN)).toHaveLength(7);
  });

  /* This suite used to assert the ladder was IRREGULAR, and said in a comment
     that if someone regularised it this was the test that should change,
     deliberately. That happened on 2026-09-28, so it changed. Leaving the old
     assertions to fail would have been the same mistake in reverse: a test
     that pins a defect in place once the defect is fixed. */
  it('follows one rule now: base 8, step 28', () => {
    expect(irregularMenuLevels()).toEqual([]);
    expect(Object.values(MENU_LEVEL_LEFT_MARGIN)).toEqual([8, 36, 64, 92, 120, 148, 176]);
    for (let n = 0; n < 7; n++) {
      expect(`level-${n}`).toBe(`level-${n}`);
      expect(MENU_LEVEL_LEFT_MARGIN[`level-${n}`]).toBe(menuLevelIfRegular(n));
    }
  });

  it('keeps the constants and the table as two statements of one fact', () => {
    /* The table is authored (it is what Figma holds) and the rule describes
       it. Generating one from the other would make them agree by construction
       and remove the only question worth asking. */
    expect(MENU_LEVEL_BASE).toBe(8);
    expect(MENU_LEVEL_STEP).toBe(36 - 8);
    expect(MENU_LEVEL_LEFT_MARGIN['level-0']).toBe(MENU_LEVEL_BASE);
  });

  it('would notice a rung edited back out of shape', () => {
    /* irregularMenuLevels() returning [] is only meaningful if it can return
       something. The old table is the honest fixture for that: it is what this
       collection actually held until the ladder was fixed. */
    const wasAuthored: Record<string, number> = {
      'level-0': 8, 'level-1': 36, 'level-2': 48, 'level-3': 72,
      'level-4': 88, 'level-5': 112, 'level-6': 128,
    };
    const off = Object.entries(wasAuthored)
      .filter(([name, v]) => v !== menuLevelIfRegular(Number(name.replace('level-', ''))))
      .map(([name]) => name);
    expect(off).toEqual(['level-2', 'level-3', 'level-4', 'level-5', 'level-6']);
  });

  it('reaches far enough for the deepest row to fit its frame', () => {
    /* Why 28 and not 20. A 20-step ladder from 8 reproduces every clean rung of
       the old table (8·48·88·128) and looks defensible on paper — but it ends
       at 128, and the component hugs to 360 with the level-6 row filling it.
       Agreeing with the old numbers was not evidence: those rungs were
       hand-typed too, so matching them is matching the arbitrary part. */
    expect(MENU_LEVEL_LEFT_MARGIN['level-6']).toBe(176);
    expect(menuLevelIfRegular(6, 8, 20)).toBe(128);
  });
});

describe('Icons & Avatars — the two-step name offset', () => {
  it('holds Figma\'s seven rungs', () => {
    expect(Object.values(ICON_AVATAR_PX)).toEqual([16, 20, 24, 32, 40, 56, 72]);
  });

  it('maps each mode to the LIB name with the same pixel value', () => {
    /* The most dangerous mapping in the file: both sides used the same words
       for different rungs, so passing the mode name straight through as the
       prop was wrong on every icon and avatar while looking right in review.
       The lib ladder has since been realigned, but this table records the
       offset that existed so a consumer on an older version can be translated. */
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.small).toBe('xx-small');   // both 24
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.medium).toBe('x-small');   // both 32
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.large).toBe('small');      // both 40
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.xl).toBe('medium');        // both 56
  });

  it('admits the rungs with no counterpart rather than rounding to one', () => {
    /* 16, 20 and 72 had no lib size. Rounding them to the nearest would be a
       silent resize; null forces a customSize and keeps the pixel value. */
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.xxs).toBeNull();
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.xs).toBeNull();
    expect(ICON_AVATAR_MODE_TO_LIB_SIZE.xxl).toBeNull();
  });

  it('treats the three CONTEXT modes as "emit no size"', () => {
    /* in-check, in-button and button-decorator are not sizes — the parent
       component owns the dimension. They are aliases in the file for the same
       reason. Emitting a size prop here would override the parent. */
    for (const m of ['in-check', 'in-button', 'button-decorator']) {
      expect(isIconAvatarContext(m)).toBe(true);
      expect(iconAvatarSize(m).prop).toBeNull();
      expect(iconAvatarSize(m).px).toBeNull();
    }
  });

  it('gives a reason with every null, so a silent drop is impossible', () => {
    expect(iconAvatarSize('in-button').reason).toMatch(/parent/);
    expect(iconAvatarSize('xxs').reason).toMatch(/customSize/);
    expect(iconAvatarSize('small').reason).toMatch(/offset/);
  });
});

describe('ambient collections — five of eight write no prop', () => {
  it('names the three that DO become props', () => {
    expect(COLLECTIONS_THAT_BECOME_PROPS)
      .toEqual(['Component-Size', 'Buttons', 'Icons & Avatars']);
  });

  it('marks the environment collections ambient', () => {
    for (const c of ['Devices-Type', 'Device-Sizes', 'Typography']) {
      expect(isAmbientCollection(c)).toBe(true);
    }
    expect(isAmbientCollection('Component-Size')).toBe(false);
  });

  it('Device-Sizes must be reached THROUGH Devices-Type', () => {
    /* Reading Device-Sizes directly gets `Default`, which is correct for
       Desktop alone — so a naive reading is right on one device of seven and
       silently wrong on the other six. */
    expect(DEVICE_TO_SIZE_CLASS['Desktop']).toBe('Default');
    expect(DEVICE_TO_SIZE_CLASS['IOS-Mobile']).toBe('Narrow');
    expect(DEVICE_TO_SIZE_CLASS['Android-Mobile']).toBe('Rare');
    expect(DEVICE_TO_SIZE_CLASS['IOS-Tablet-Horizontal']).toBe('Wide');
  });

  it('collapses seven devices onto five classes, by ORIENTATION not vendor', () => {
    /* The two tablet-verticals share `Common` and the two horizontals share
       `Wide` — so an iPad and an Android tablet in the same orientation get the
       same margins, while the same device rotated does not. Layout follows the
       viewport; only the CHROME follows the vendor, which is why App and Status
       is 74 on iOS and 88 on Android while these are shared. */
    expect(DEVICE_TO_SIZE_CLASS['IOS-Tablet-Vertical'])
      .toBe(DEVICE_TO_SIZE_CLASS['Android-Tablet-Vertical']);
    expect(DEVICE_TO_SIZE_CLASS['IOS-Tablet-Horizontal'])
      .toBe(DEVICE_TO_SIZE_CLASS['Android-Tablet-Horizontal']);
    expect(new Set(Object.values(DEVICE_TO_SIZE_CLASS)).size).toBe(5);
    expect(Object.keys(DEVICE_TO_SIZE_CLASS)).toHaveLength(7);
    /* The phones do NOT share, though both are 32 — Narrow and Rare are
       separate classes, so they can diverge without touching each other. */
    expect(DEVICE_TO_SIZE_CLASS['IOS-Mobile'])
      .not.toBe(DEVICE_TO_SIZE_CLASS['Android-Mobile']);
  });
});

describe('Alt-Display — a paint STRATEGY, not a value', () => {
  it('each mode is a different construction', () => {
    /* The other ambient collections select a measurement. This one selects how
       to paint: one flat colour, two tones, or a gradient between two stops.
       Reading Color-Stop-1 alone renders Gradient as its first stop and
       reports nothing. */
    expect(ALT_DISPLAY_PAINT).toEqual({
      Default: 'flat', Colored: 'two-tone', Gradient: 'gradient',
    });
  });

  it('only Default is faithful as a single fill', () => {
    expect(altDisplayIsFlat('Default')).toBe(true);
    expect(altDisplayIsFlat('Colored')).toBe(false);
    expect(altDisplayIsFlat('Gradient')).toBe(false);
  });
});
