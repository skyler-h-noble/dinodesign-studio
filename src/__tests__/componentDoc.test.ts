/**
 * The doc is read by an agent, so the failures that matter are the ones that
 * still LOOK like a document: a broken table row, a Figma link that resolves to
 * the wrong node, a default that is quietly missing.
 */
import { describe, it, expect } from 'vitest';
import { renderComponentDoc, renderFigmaSection, renderColorSystem,
  COLOUR_COLLECTIONS } from '../utils/docs/componentDoc';
import { BUTTON_DOC, TABS_DOC, CARD_DOC, COMPONENT_DOCS } from '../utils/docs/components';
import type { LinkedFigmaFileEntry } from '../utils/figmaLink';
import fixture from './__fixtures__/figmaComponentSets.json';

/** A table row's cells, honouring the backslash escape a renderer respects. */
const cells = (row: string) =>
  row.split(/(?<!\\)\|/).map(c => c.trim()).filter(Boolean);

const linked: LinkedFigmaFileEntry = {
  fileKey: 'USERKEY0000000000000AB',
  fileName: 'Lise Design System',
  fileUrl: 'https://www.figma.com/design/USERKEY0000000000000AB/Lise-Design-System',
  lastSeenAt: new Date('2026-09-30T12:00:00Z'),
  components: [
    { id: '8216:9719', name: 'Tabs', page: 'Tabs', variants: 3 },
    { id: '8212:9219', name: 'Tab', page: 'Tabs', variants: 15 },
  ],
};
const noMap: LinkedFigmaFileEntry = { ...linked, components: undefined };

describe('the markdown survives its own content', () => {
  it('escapes a pipe in a union type instead of splitting the row', () => {
    /* `number | string` in a cell IS a column separator. Unescaped, the row
       gains a column and every cell after it shifts left — the table still
       renders, just wrong, which is the worst kind of wrong for a doc. */
    const md = renderComponentDoc(TABS_DOC);
    const row = md.split('\n').find(l => l.includes('value / defaultValue'))!;
    expect(row).toContain('number \\| string');
    // split on pipes that are NOT escaped — the same rule a renderer applies
    expect(cells(row)).toHaveLength(4);
  });

  it('keeps every props row at four columns', () => {
    for (const doc of COMPONENT_DOCS) {
      const md = renderComponentDoc(doc);
      const start = md.indexOf('### Props');
      const rows = md.slice(start, md.indexOf('### States'))
        .split('\n')
        .filter(l => l.startsWith('|') && !l.includes('---'))
        .map(l => cells(l).length);
      for (const n of rows) expect(n, doc.name).toBe(4);
    }
  });
});

describe('what an agent gets wrong without being told', () => {
  it('states a default for EVERY prop', () => {
    /* The default is the single most-missed fact — Button defaults to
       `default`, not `primary`, and an agent that guesses picks primary. */
    for (const doc of COMPONENT_DOCS) {
      for (const p of doc.props) expect(p.default, `${doc.name}.${p.name}`).toBeTruthy();
    }
  });

  it('says Button defaults to default, not primary', () => {
    const md = renderComponentDoc(BUTTON_DOC);
    expect(md).toMatch(/default.*not.*`primary`/i);
  });

  it('marks interaction states as NOT props', () => {
    /* Otherwise an agent writes state="hover". */
    const md = renderComponentDoc(TABS_DOC);
    expect(md).toContain('interaction — not a prop');
  });

  it('names a replacement for every wrong-component case', () => {
    for (const doc of COMPONENT_DOCS) {
      for (const i of doc.insteadUse) {
        expect(i.use, `${doc.name}: "${i.when}"`).toBeTruthy();
      }
    }
  });
});

describe('the Figma section', () => {
  it('links each set to the USER file, with a hyphenated node id', () => {
    const md = renderFigmaSection('Tabs', linked).join('\n');
    expect(md).toContain('/design/USERKEY0000000000000AB/');
    expect(md).toContain('node-id=8216-9719');
    expect(md).not.toContain('8216:9719');
  });

  it('lists the parts, because a page is not one component', () => {
    const md = renderFigmaSection('Tabs', linked).join('\n');
    expect(md).toContain('[Tabs]');
    expect(md).toContain('[Tab]');
  });

  it('tells a linked user to re-run the plugin, NOT to link their file', () => {
    /* The state every existing user is in. Sending them to link a file they
       already linked is how ten minutes disappear. */
    const md = renderFigmaSection('Tabs', noMap).join('\n');
    expect(md).toContain('Re-run the OmniDesign plugin');
    expect(md).not.toContain('Get your design into Figma');
    expect(md).toContain(linked.fileUrl);
  });

  it('tells an unlinked user to link, and offers no dead links', () => {
    const md = renderFigmaSection('Tabs', null).join('\n');
    expect(md).toContain('Get your design into Figma');
    expect(md).not.toContain('node-id=');
  });

  it('says so when a set the map names is absent from the user file', () => {
    /* They renamed or deleted it. Saying it beats a silently shorter list,
       which reads as the component simply having fewer parts. */
    const partial = { ...linked, components: [linked.components![0]] };
    const md = renderFigmaSection('Tabs', partial).join('\n');
    expect(md).toContain('**Tab** — not found in your file');
  });

  it('distinguishes undrawn from undrawable', () => {
    expect(renderFigmaSection('Autocomplete', linked).join('\n')).toContain('No Figma counterpart yet');
    expect(renderFigmaSection('Grid', linked).join('\n')).toContain('layout or infrastructure');
  });

  it('is omitted entirely for a component in neither list', () => {
    expect(renderFigmaSection('NotAComponent', linked)).toEqual([]);
  });
});

describe('the sections a human doc would not have', () => {
  it.each(COMPONENT_DOCS)('$name answers the theme question in BOTH tools', (doc) => {
    /* An agent asked to theme a component in Figma cannot derive the node from
       the CSS, and vice versa. A row with one side filled is half an answer. */
    expect(doc.theming.length).toBeGreaterThan(0);
    for (const t of doc.theming) {
      expect(t.inCode, doc.name).toBeTruthy();
      expect(t.inFigma, doc.name).toBeTruthy();
    }
  });

  it.each(COMPONENT_DOCS)('$name says what each token does and where it comes from', (doc) => {
    expect(doc.tokens.length).toBeGreaterThan(0);
    for (const t of doc.tokens) {
      expect(t.sets, `${doc.name} ${t.name}`).toBeTruthy();
      expect(t.variesWith, `${doc.name} ${t.name}`).toBeTruthy();
      expect(t.figma, `${doc.name} ${t.name}`).toBeTruthy();
    }
  });

  it('names a real Figma GROUP, checked against the file', () => {
    /* The Figma column is the only place the CSS name and the variable name are
       written together, so a made-up one sends an agent looking for something
       that is not there.
       Checked against groups captured from the file rather than a list kept
       here — a hand-maintained allowlist is just a second thing to get wrong,
       and it rejected `Sizing-3` (a collection, not a group) on the first run. */
    const groups = new Set(fixture.componentSizeGroups as string[]);
    const scoped = COMPONENT_DOCS.flatMap(d => d.tokens).filter(t => t.figma.includes('/'));
    expect(scoped.length).toBeGreaterThan(0);
    for (const t of scoped) {
      const prefix = t.figma.split('/')[0];
      // `Modes → Theme → …` describes a chain, not a group path.
      if (t.figma.includes('→')) continue;
      expect(groups.has(prefix), `${t.name} -> "${t.figma}"`).toBe(true);
    }
  });

  it('marks a token that varies, because a varying one must not be hardcoded', () => {
    const sized = COMPONENT_DOCS.flatMap(d => d.tokens).filter(t => /size mode/.test(t.variesWith));
    expect(sized.length).toBeGreaterThan(0);
  });

  it('warns about theming a node that carries a shadow', () => {
    /* The rule specific to this system and invisible everywhere else: Fab,
       Chip and AppBar pin the theme on an inner node so the shadow keeps
       reading the page. Button, Tabs and Card pin nothing and inherit. */
    expect(renderComponentDoc(BUTTON_DOC)).toMatch(/shadow/i);
  });

  it('explains a value that looks arbitrary rather than just stating it', () => {
    const md = renderComponentDoc(TABS_DOC);
    expect(md).toContain('outline-offset: -4px');
    expect(md).toMatch(/INNER edge/);
  });

  it('gives Card the opposite sign from Tabs, and says why', () => {
    /* Card's ring sits OUTSIDE and is radius + 3; Tabs' is inset. Getting the
       sign wrong draws a ring across the component's own curve. */
    expect(renderComponentDoc(CARD_DOC)).toContain('Card-Radius + 3');
  });
});

describe('the three color collections', () => {
  it('every theming row names which collection it is about', () => {
    /* The fact that cannot be guessed. Change the right node in the wrong
       collection and nothing happens — it does not error, so an agent has no
       signal it went to the wrong place. */
    for (const doc of COMPONENT_DOCS) {
      for (const t of doc.theming) {
        expect(t.collection, `${doc.name}: "${t.inCode}"`).toBeTruthy();
      }
    }
  });

  it('names all three, so the overview is not one collection restated', () => {
    const names = COLOUR_COLLECTIONS.map(c => c.name);
    expect(names).toEqual(['Theme', 'Buttons', 'Icons']);
  });

  it('gives each collection a code answer AND a Figma answer', () => {
    for (const c of COLOUR_COLLECTIONS) {
      expect(c.inCode, c.name).toBeTruthy();
      expect(c.inFigma, c.name).toBeTruthy();
      expect(c.moves, c.name).toBeTruthy();
    }
  });

  it('points each collection at its own layer prefix', () => {
    /* Theme-*, Button-Theme-*, Icon-Theme-*. One prefix per collection is what
       makes "which mode do I set?" answerable by looking at the layer name. */
    const md = renderColorSystem();
    expect(md).toContain('`Theme-*`');
    expect(md).toContain('`Button-Theme-*`');
    expect(md).toContain('`Icon-Theme-*`');
  });

  it('says an unpinned layer means inherit, not broken', () => {
    /* Most are unpinned. Without this an agent reads a missing mode as a gap
       and pins one, which turns an inheriting component into a fixed one. */
    expect(renderColorSystem()).toMatch(/unpinned.*inherit/is);
  });

  it('routes Badge to Icons, not Theme', () => {
    /* Badge binds Icon and On-Icon now. Sending someone to the Theme mode to
       recolor a badge is the exact mistake this column exists to prevent. */
    const badge = COMPONENT_DOCS.find(d => d.name === 'Badge')!;
    expect(badge.theming.some(t => t.collection === 'Icons')).toBe(true);
  });

  it('routes a button palette to Buttons, not Theme', () => {
    const button = COMPONENT_DOCS.find(d => d.name === 'Button')!;
    expect(button.theming.some(t => t.collection === 'Buttons')).toBe(true);
    expect(button.theming.some(t => t.collection === 'Theme')).toBe(true);
  });
});
