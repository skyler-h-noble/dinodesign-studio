import { describe, it, expect } from 'vitest';
import { encodeNavState, readNavState, NAV_SHARE_VERSION, type NavShareState } from '../utils/addOns/navShare';

const state: NavShareState = {
  version: NAV_SHARE_VERSION,
  options: { layout: 'hero', condensed: true },
  mobile: { layout: 'top-and-bottom', itemCount: 4 },
  breakpoints: [{ id: 'xs', minWidth: 0 }],
  matrix: { 'Adaptive-Nav/Show-Search': { xs: false } },
  bottomBarAt: { xs: true },
  tabs: [{ id: 't1', label: 'Home' }],
  actions: [],
  accountItems: [],
  dialItems: [],
  componentSize: 'large',
  selectedTab: 't1',
};

describe('Adaptive Nav share link', () => {
  it('round-trips the whole setup through #spec=', () => {
    const link = `https://x.test/add-ons/nav/abc#spec=${encodeNavState(state)}`;
    expect(readNavState(link)).toEqual(state);
  });
  it('reopens from the exported spec and the React file, which carry the link', () => {
    const link = `https://x.test/add-ons/nav/abc#spec=${encodeNavState(state)}`;
    const spec = JSON.stringify({ name: 'adaptive-nav', root: {}, studio: link }, null, 2);
    const code = `/**\n * Edit in the studio — open this link, or paste this file into Import:\n * ${link}\n */\nimport React from 'react';`;
    expect(readNavState(spec)).toEqual(state);
    expect(readNavState(code)).toEqual(state);
  });
  it('ignores links that are not an Adaptive Nav, or broken', () => {
    expect(readNavState('https://x.test/add-ons/nav')).toBeNull();
    expect(readNavState('#spec=not-base64!!')).toBeNull();
    expect(readNavState(`#spec=${encodeNavState({ ...state, version: 'bento/1' as never })}`)).toBeNull();
  });
});
