/**
 * Linked and pushed are two facts, and the card used to show one.
 *
 * A design system nobody had ever opened in Figma and one linked-but-stale
 * read identically — both "not pushed" — so the state that needed an action
 * (link it) was indistinguishable from the state that needed a different one
 * (re-import).
 */
import { describe, it, expect } from 'vitest';
import {
  parseFigmaFileKey, figmaLinkState, figmaLinkLabel, parseFigmaFileLink,
  upsertLinkedFile, removeLinkedFile, type LinkedFigmaFileEntry,
  figmaLinkNeedsAttention,
} from '../utils/figmaLink';

describe('parseFigmaFileKey', () => {
  const KEY = 'Qv2dqF7mYoAGY77EkdrwTv';

  it('takes the key from a plain file URL, with no node-id', () => {
    /* The whole reason this exists rather than reusing parseFigmaUrl: that one
       requires a node-id and returns null without one, because its caller
       converts a single frame. Someone linking a design system copies the URL
       with the file open, which has no node-id at all. */
    expect(parseFigmaFileKey(`https://www.figma.com/design/${KEY}/Omni-Designs-Aug12`)).toBe(KEY);
    expect(parseFigmaFileKey(`https://figma.com/design/${KEY}/Any-Name`)).toBe(KEY);
  });

  it('also takes it from a URL that HAS a node-id', () => {
    expect(parseFigmaFileKey(
      `https://www.figma.com/design/${KEY}/Omni?node-id=6778-17180&m=dev`)).toBe(KEY);
  });

  it('accepts the older /file/ form', () => {
    expect(parseFigmaFileKey(`https://www.figma.com/file/${KEY}/Old-Style`)).toBe(KEY);
  });

  it('tolerates whitespace, which a paste usually carries', () => {
    expect(parseFigmaFileKey(`  https://www.figma.com/design/${KEY}/X  `)).toBe(KEY);
  });

  it('refuses anything that is not a Figma URL', () => {
    /* A look-alike host is the case worth naming: figma.com.evil.test ends in
       neither `figma.com` nor `.figma.com`, and the anchored test rejects it
       where a bare `includes` would not. */
    for (const bad of [
      'https://figma.com.evil.test/design/abcdefghij/X',
      'https://notfigma.com/design/abcdefghij/X',
      'https://www.figma.com/board/abcdefghij/X',
      'not a url', '', 'https://www.figma.com/',
    ]) {
      expect(`${bad}: ${parseFigmaFileKey(bad)}`).toBe(`${bad}: null`);
    }
  });

  it('reads back a key from the URL shape the app builds', () => {
    /* MyDesignsPage builds `/file/<key>/<slug>`; this must survive it. Written
       against the shape rather than by calling that helper, which lives in a
       component module. */
    expect(parseFigmaFileKey(`https://www.figma.com/file/${KEY}/Cocktail-Hour`)).toBe(KEY);
  });
});

describe('figmaLinkState', () => {
  const base = { figmaFileKey: 'abc1234567', version: 34, lastPushedVersion: 34 };

  it('reports unlinked before any file is recorded', () => {
    expect(figmaLinkState({ ...base, figmaFileKey: null })).toBe('unlinked');
    expect(figmaLinkState({ ...base, figmaFileKey: undefined })).toBe('unlinked');
    expect(figmaLinkState({ ...base, figmaFileKey: '' })).toBe('unlinked');
  });

  it('puts unlinked ahead of every push state', () => {
    /* Not a tie-break for tidiness. The push state is unverifiable without a
       file: `pushed` means someone clicked "Mark as pushed", not that anything
       was confirmed to land. Linking is what makes the other claim checkable,
       so it is the one to ask for first. */
    expect(figmaLinkState({ figmaFileKey: null, version: 34, lastPushedVersion: 0 })).toBe('unlinked');
    expect(figmaLinkState({ figmaFileKey: null, version: 34, lastPushedVersion: 30 })).toBe('unlinked');
    expect(figmaLinkState({ figmaFileKey: null, version: 34, lastPushedVersion: 34 })).toBe('unlinked');
  });

  it('distinguishes never-pushed from stale', () => {
    expect(figmaLinkState({ ...base, lastPushedVersion: 0 })).toBe('never-pushed');
    expect(figmaLinkState({ ...base, lastPushedVersion: 30 })).toBe('pending');
  });

  it('is synced when the pushed version has caught up or overtaken', () => {
    expect(figmaLinkState(base)).toBe('synced');
    /* Overtaken happens: "Mark as pushed" stamps the current version, and a
       later rollback can leave lastPushed ahead. Not an error state. */
    expect(figmaLinkState({ ...base, version: 33, lastPushedVersion: 34 })).toBe('synced');
  });
});

describe('figmaLinkLabel', () => {
  it('names the four states', () => {
    const at = (r: Partial<Parameters<typeof figmaLinkLabel>[0]>) =>
      figmaLinkLabel({ figmaFileKey: 'abc1234567', version: 34, lastPushedVersion: 34, ...r });
    expect(at({ figmaFileKey: null })).toBe('Not linked to Figma');
    expect(at({ lastPushedVersion: 0 })).toBe('Not yet pushed to Figma');
    expect(at({ lastPushedVersion: 30 })).toBe('4 changes not pushed');
    expect(at({})).toBe('In sync with Figma');
  });

  it('says "1 change", not "1 changes"', () => {
    expect(figmaLinkLabel({ figmaFileKey: 'abc1234567', version: 34, lastPushedVersion: 33 }))
      .toBe('1 change not pushed');
  });

  it('never counts from zero', () => {
    /* A freshly created system has no CHANGES, it has everything. Counting
       version 1 against a lastPushed of 0 made that read "1 change not
       pushed", which describes a one-line edit. */
    expect(figmaLinkLabel({ figmaFileKey: 'abc1234567', version: 1, lastPushedVersion: 0 }))
      .toBe('Not yet pushed to Figma');
  });
});

describe('figmaLinkNeedsAttention', () => {
  it('is quiet only when linked AND current', () => {
    const k = 'abc1234567';
    expect(figmaLinkNeedsAttention({ figmaFileKey: k, version: 34, lastPushedVersion: 34 })).toBe(false);
    expect(figmaLinkNeedsAttention({ figmaFileKey: k, version: 34, lastPushedVersion: 30 })).toBe(true);
    expect(figmaLinkNeedsAttention({ figmaFileKey: null, version: 34, lastPushedVersion: 34 })).toBe(true);
  });
});

describe('parseFigmaFileLink', () => {
  const KEY = 'Qv2dqF7mYoAGY77EkdrwTv';

  it('takes the key and a name from the slug', () => {
    const e = parseFigmaFileLink(`https://www.figma.com/design/${KEY}/Omni-Designs-Aug12`)!;
    expect(e.fileKey).toBe(KEY);
    expect(e.fileName).toBe('Omni Designs Aug12');
    expect(e.fileUrl).toBe(`https://www.figma.com/design/${KEY}/Omni-Designs-Aug12`);
  });

  it('keeps the URL exactly as pasted, minus surrounding space', () => {
    /* Stored verbatim because it is what the person will click. Rebuilding it
       from the key would drop a node-id or a branch segment they meant to keep. */
    const e = parseFigmaFileLink(`  https://www.figma.com/design/${KEY}/X?node-id=1-2  `)!;
    expect(e.fileUrl).toBe(`https://www.figma.com/design/${KEY}/X?node-id=1-2`);
  });

  it('survives a URL with no slug at all', () => {
    const e = parseFigmaFileLink(`https://www.figma.com/design/${KEY}/`)!;
    expect(e.fileKey).toBe(KEY);
    expect(e.fileName).toBe('');
  });

  it('returns null for anything that is not a Figma file URL', () => {
    expect(parseFigmaFileLink('https://example.com/design/abcdefghij/X')).toBeNull();
  });

  it('guesses the name, and the guess is lossy on purpose', () => {
    /* Figma slugs every run of non-alphanumerics to a hyphen, so "Omni-Designs"
       and "Omni Designs" produce the same slug. The plugin overwrites this with
       figma.root.name on the next import; this is the placeholder until then. */
    const a = parseFigmaFileLink(`https://www.figma.com/design/${KEY}/Omni-Designs`)!;
    const b = parseFigmaFileLink(`https://www.figma.com/design/${KEY}/Omni-Designs`)!;
    expect(a.fileName).toBe(b.fileName);
    expect(a.fileName).toBe('Omni Designs');
  });
});

describe('upsertLinkedFile', () => {
  const at = (key: string, ms: number, name = key): LinkedFigmaFileEntry =>
    ({ fileKey: key, fileName: name, fileUrl: `https://www.figma.com/design/${key}/x`,
       lastSeenAt: new Date(ms) });

  it('adds a file that is not there', () => {
    const out = upsertLinkedFile([at('aaa', 1000)], at('bbb', 2000));
    expect(out.map(f => f.fileKey)).toEqual(['bbb', 'aaa']);
  });

  it('REPLACES rather than appends when the key already exists', () => {
    /* The rule the plugin uses, and both writers have to agree on it. If the
       studio appended, re-importing into an already-linked file would leave two
       rows for one file and the UI would offer "Open in Figma (+1)". */
    const out = upsertLinkedFile([at('aaa', 1000, 'Old name')], at('aaa', 2000, 'New name'));
    expect(out).toHaveLength(1);
    expect(out[0].fileName).toBe('New name');
  });

  it('keeps the list newest first', () => {
    const out = upsertLinkedFile([at('aaa', 3000), at('bbb', 1000)], at('ccc', 2000));
    expect(out.map(f => f.fileKey)).toEqual(['aaa', 'ccc', 'bbb']);
  });

  it('does not mutate the list it was given', () => {
    const list = [at('aaa', 1000)];
    upsertLinkedFile(list, at('bbb', 2000));
    expect(list.map(f => f.fileKey)).toEqual(['aaa']);
  });
});

describe('removeLinkedFile', () => {
  const at = (key: string): LinkedFigmaFileEntry =>
    ({ fileKey: key, fileName: key, fileUrl: '', lastSeenAt: new Date() });

  it('drops only the named key', () => {
    expect(removeLinkedFile([at('aaa'), at('bbb')], 'aaa').map(f => f.fileKey)).toEqual(['bbb']);
  });

  it('is a no-op for a key that is not there', () => {
    expect(removeLinkedFile([at('aaa')], 'zzz').map(f => f.fileKey)).toEqual(['aaa']);
  });
});
