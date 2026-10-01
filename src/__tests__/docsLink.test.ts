/**
 * A link written into 88 components is worse than no link if it is wrong, so
 * the shape is pinned rather than assumed.
 */
import { describe, it, expect } from 'vitest';
import {
  componentDocsUrl, componentDocsIndexUrl, docsSlug, DOCS_ORIGIN,
} from '../utils/docs/docsLink';
import { COMPONENT_DOCS } from '../utils/docs/components';

const UUID = 'd1bd0ba4-4906-4801-93c3-49db251f10d2';

describe('the component docs URL', () => {
  it('carries the DESIGN SYSTEM id, not a library-wide path', () => {
    /* Every user imports their own .fig and gets their own uuid. A link baked
       into the template would send all of them to whoever built it. */
    expect(componentDocsUrl(UUID, 'Button'))
      .toBe(`${DOCS_ORIGIN}/docs/${UUID}/Button`);
  });

  it('needs no anchor, because it is a path', () => {
    /* An anchor depends on the page rendering headings to jump to, and the
       existing /md route serves into a <pre>, which has none. */
    expect(componentDocsUrl(UUID, 'Button')).not.toContain('#');
  });

  it('survives a trailing slash on the origin', () => {
    expect(componentDocsUrl(UUID, 'Card', 'https://example.com/'))
      .toBe(`https://example.com/docs/${UUID}/Card`);
  });

  it('builds a usable URL for every documented component', () => {
    for (const doc of COMPONENT_DOCS) {
      const url = componentDocsUrl(UUID, doc.name);
      expect(() => new URL(url), doc.name).not.toThrow();
      expect(url, doc.name).not.toMatch(/\s/);
    }
  });

  it('hyphenates a name with a space rather than escaping it', () => {
    // No component has one today; the slug should not produce %20 if one does.
    expect(docsSlug('Menu Item')).toBe('Menu-Item');
    expect(componentDocsUrl(UUID, 'Menu Item')).toContain('/Menu-Item');
  });

  it('escapes the id, which comes from outside', () => {
    expect(componentDocsUrl('a/b', 'Button')).toContain('/docs/a%2Fb/');
  });

  it('has an index for the whole system', () => {
    expect(componentDocsIndexUrl(UUID)).toBe(`${DOCS_ORIGIN}/docs/${UUID}`);
  });
});
