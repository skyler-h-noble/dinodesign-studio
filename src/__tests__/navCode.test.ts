import { describe, it, expect } from 'vitest';
import { transform } from 'sucrase';
import { navCode } from '../utils/addOns/navCode';
import { adaptiveNavDefinition, arrangementRows } from '../utils/addOns/adaptiveNav';
import { defaultNavMatrix } from '../utils/addOns/navDefinition';
import { conditionsUsedBy } from '../utils/addOns/toAddonSpec';
import { DEFAULT_BREAKPOINTS } from '../utils/addOns/breakpoints';
import { DEFAULT_TABS, DEFAULT_ACTIONS } from '../utils/addOns/navContent';
import { DEFAULT_ACCOUNT_MENU } from '../utils/addOns/accountMenu';
import { DEFAULT_SPEED_DIAL } from '../utils/addOns/speedDial';
import type { NavOptions } from '../utils/addOns/navDefinition';
import type { MobileOptions } from '../utils/addOns/mobileNav';

function build(options: NavOptions, mobile: MobileOptions) {
  const definition = adaptiveNavDefinition(options, mobile);
  const names = conditionsUsedBy(definition);
  const matrix = { ...defaultNavMatrix(names, DEFAULT_BREAKPOINTS), ...arrangementRows(DEFAULT_BREAKPOINTS, {}) };
  return navCode({
    definition, breakpoints: DEFAULT_BREAKPOINTS, matrix, options, mobile,
    tabs: DEFAULT_TABS, actions: DEFAULT_ACTIONS, accountItems: DEFAULT_ACCOUNT_MENU, dialItems: DEFAULT_SPEED_DIAL,
    componentSize: 'medium',
  });
}

const layouts: NavOptions[] = [
  { layout: 'brand-left', search: true, actions: true, avatar: true, avatarMenu: true },
  { layout: 'brand-centre', actions: true, avatar: true },
  { layout: 'rail', actions: true, avatar: true, railExpandable: true },
  { layout: 'hero', actions: true, avatar: true, condensed: true },
];
const mobile = { layout: 'top-and-bottom', itemCount: 4, showAvatar: true, avatarMenu: true, fab: true, fabSpeedDial: true } as MobileOptions;

describe('Adaptive Nav as code', () => {
  it.each(layouts.map((l) => [l.layout, l] as const))('%s compiles to valid JSX', (_, opts) => {
    const code = build(opts, mobile);
    expect(() => transform(code, { transforms: ['jsx'] })).not.toThrow();
  });

  it.each(layouts.map((l) => [l.layout, l] as const))('%s imports everything it uses', (_, opts) => {
    const code = build(opts, mobile);
    const libImport = code.match(/import \{ ([^}]+) \} from '@omni-design\/components';/)![1].split(', ');
    const body = code.replace(/\/\*[\s\S]*?\*\//g, '');   // not the usage example in the header
    for (const used of new Set([...body.matchAll(/<([A-Z][A-Za-z]+)[\s>/]/g)].map((m) => m[1]))) {
      if (used.endsWith('Icon')) expect(code, used).toContain(`import ${used} from '@omni-design/icons/`);
      else if (!['React', 'I'].includes(used)) expect(libImport, used).toContain(used);
    }
  });

  it('turns width conditions into media queries from the breakpoint table', () => {
    const code = build(layouts[0], mobile);
    expect(code).toContain('@media (min-width: 900px) and (max-width: 1279.98px)');
    // The phone arrangement is hidden on desktop widths, and the desktop one on phones.
    expect(code).toMatch(/@media \(max-width: 599\.98px\) \{[\s\S]*?\.an-root \.an-desktop/);
    expect(code).toMatch(/\.an-root \.an-mobile/);
  });

  it('makes scroll and sign-in state on the root, and the account menu a Popover', () => {
    const code = build(layouts[3], mobile);
    expect(code).toContain('.an-root:not([data-condensed]) .an-show-condensed');
    expect(code).toContain('.an-root[data-condensed] .an-hide-when-condensed');
    expect(code).toContain("window.addEventListener('scroll'");
    const withMenu = build(layouts[0], mobile);
    // The account menu is the library's Popover, anchored to the avatar.
    expect(withMenu).toContain('<Popover open={menuOpen}');
    expect(withMenu).toContain('anchorRef={avatarRef}');
    expect(withMenu).toContain('ref={avatarRef}');
    expect(withMenu).not.toContain('data-menu-open');
    expect(withMenu).toContain('.an-root:not([data-signed-in]) .an-signed-in');
  });

  it('opens a Drawer from the menu button', () => {
    const code = build(layouts[1], mobile);
    expect(code).toContain('onClick={() => setDrawerOpen(true)}');
    expect(code).toContain('<Drawer open={drawerOpen}');
  });
});

import { createRequire } from 'module';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

describe('the generated file runs', () => {
  const req = createRequire(import.meta.url);
  it.each(layouts.map((l) => [l.layout, l] as const))('%s renders with the real library', (_, opts) => {
    const code = transform(build(opts, mobile), { transforms: ['jsx', 'imports'], production: true }).code;
    const mod: { exports: any } = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', 'React', code)(req, mod, mod.exports, req('react'));
    const AdaptiveNav = mod.exports.default;
    const html = renderToString(createElement(AdaptiveNav, { signedIn: true }, 'Page content'));
    expect(html).toContain('an-root');
    expect(html).toContain('Page content');
  }, 30000);   // the first require() of the whole library is slow under a full parallel run
});
