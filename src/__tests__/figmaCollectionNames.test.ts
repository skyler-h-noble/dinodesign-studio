/**
 * Every section of the Figma payload is either a collection the file has, or
 * something declared not to be one. There is no third option.
 *
 * The bug this exists for did not fail. `figma.Components` named a collection
 * the library file does not have, so the plugin CREATED one on every import —
 * a duplicate holding a second, older-named copy of values `Component-Size`
 * already carried. It had to be deleted by hand after every regenerate, and it
 * came back every time. Nothing reported anything, because from the plugin's
 * side "make a collection called Components" is a perfectly ordinary request.
 *
 * The same shape is recorded twice more in this repo: Elevation was emitted as
 * `Shadow`/`Layer-<n>` and "matched no collection in the file — so the payload
 * landed nowhere", and componentSize.ts notes that the flat payload's
 * `Card-Focus-Border-Radius` "would have matched nothing". Three instances of
 * one mistake is a missing check, not three mistakes.
 *
 * So the registry below is the check. A new payload section fails this suite
 * until it is classified, which forces the question "does the file actually
 * have a collection by this name?" to be answered on purpose rather than
 * discovered months later by someone deleting a collection over and over.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEVICES_COLLECTION } from '../utils/typographyPlatform';

/**
 * The collections in the library file, read from Figma 2026-09-29.
 *
 * A snapshot, and it will go stale — that is acceptable here in a way it would
 * not be for a value. A collection is created or renamed deliberately, by a
 * person, and when one moves this list should move in the same pass. The cost
 * of it being stale is a failing test naming the collection; the cost of not
 * having it is what happened with Components.
 */
const FILE_COLLECTIONS = [
  'Add-Ons', 'Alt-Display', 'Buttons', 'Charts', 'Component-Elevations',
  'Component-Size', 'Device-Sizes', 'Devices-Type', 'Drop-Colors', 'Elevation',
  'Icons & Avatars', 'Menu-Levels', 'Modes', 'Sizing', 'Spacing', 'Surface',
  'Theme', 'Typography',
] as const;

/** Payload sections that ARE collections, and must name a real one. */
const EMITS_COLLECTION = [
  'Modes', 'Drop-Colors', 'Elevation', 'Component-Elevations',
  'Component-Size', 'Typography', DEVICES_COLLECTION,
] as const;

/**
 * Payload sections the plugin consumes some other way.
 *
 * Listed individually rather than waved through as "everything else", because
 * "everything else" is exactly the rule that let Components through. Each of
 * these is asserted NOT to collide with a collection name too — a section that
 * is not meant to be a collection but happens to share a name with one is the
 * same bug wearing the opposite label.
 */
const NOT_A_COLLECTION = [
  'Themes', 'SurfacesContainers', 'Typography-Variables', 'Navigation',
  'Fonts', 'Motion', 'Platform', 'pageBackground', 'Brand', 'Metadata',
] as const;

/** Every key the generator can put on the payload, read from its source. */
function payloadKeys(): string[] {
  const src = readFileSync(resolve(__dirname, '../utils/generateFigmaJSON.ts'), 'utf8');
  const keys = new Set<string>();

  // The initial literal: const figma: any = { Modes: {}, ... }
  const init = src.match(/const figma: any = \{([^}]*)\}/);
  if (init) for (const m of init[1].matchAll(/([A-Za-z][\w-]*)\s*:/g)) keys.add(m[1]);

  // figma.Name = …  /  figma['Name'] = …  /  figma[CONST] = …
  for (const m of src.matchAll(/^\s*figma\.([A-Za-z][\w-]*) =/gm)) keys.add(m[1]);
  for (const m of src.matchAll(/^\s*figma\['([^']+)'\] =/gm)) keys.add(m[1]);
  for (const m of src.matchAll(/^\s*figma\[([A-Z_]+)\] =/gm)) {
    /* Only one such constant today. Resolved rather than skipped: a key hidden
       behind a const is exactly the one a regex-based scan would miss, and
       missing it silently is the failure mode this file is about. */
    if (m[1] === 'DEVICES_COLLECTION') keys.add(DEVICES_COLLECTION);
    else keys.add(`UNRESOLVED_CONST:${m[1]}`);
  }
  // Added by the caller, after generateFigmaJSON returns.
  keys.add('Metadata');
  return [...keys].sort();
}

describe('the payload names only collections the file has', () => {
  const keys = payloadKeys();

  it('finds the sections at all — the scan is not silently empty', () => {
    /* A regex that stops matching would make every assertion below pass on an
       empty set, which is the one way this suite could fail open. */
    expect(keys.length).toBeGreaterThan(10);
    expect(keys).toContain('Component-Size');
    expect(keys).toContain('Elevation');
  });

  it('resolves every key, including ones behind a constant', () => {
    expect(keys.filter((k) => k.startsWith('UNRESOLVED_CONST:'))).toEqual([]);
  });

  it('classifies every section as collection or not-a-collection', () => {
    const known = new Set<string>([...EMITS_COLLECTION, ...NOT_A_COLLECTION]);
    const unclassified = keys.filter((k) => !known.has(k));
    expect(unclassified,
      'A new payload section must be added to EMITS_COLLECTION (and to the ' +
      'Figma file) or to NOT_A_COLLECTION. See this file\'s header.').toEqual([]);
  });

  it('every collection-shaped section names a collection that exists', () => {
    const file = new Set<string>(FILE_COLLECTIONS);
    const missing = EMITS_COLLECTION.filter((c) => !file.has(c));
    expect(missing,
      'The plugin CREATES a collection for a name the file lacks, rather than ' +
      'failing — so this is a silent duplicate, not an error.').toEqual([]);
  });

  it('no not-a-collection section shares a name with a collection', () => {
    const file = new Set<string>(FILE_COLLECTIONS);
    expect(NOT_A_COLLECTION.filter((k) => file.has(k))).toEqual([]);
  });

  it('does not emit Components — the section this check exists for', () => {
    /* Named explicitly. The generic assertions above would catch it, but a
       reader who reintroduces it deserves to see why rather than only that. */
    expect(keys).not.toContain('Components');
    expect(FILE_COLLECTIONS as readonly string[]).not.toContain('Components');
  });

  it('does not emit Cognitive, which lives in tokens.json instead', () => {
    /* Cognitive has never been in this payload. It is written to tokens.json
       by generateDesignSystem, a different file with a different consumer. It
       is asserted here because it LOOKS like it belongs — it turned up as a
       stray Figma collection alongside Components, and the two had completely
       different causes. */
    expect(keys).not.toContain('Cognitive');
  });
});

/* ── tokens.json is a second file with a second consumer ────────────────────
 *
 * figma.json is not the only thing the Figma plugin reads. `Cognitive` was
 * never in this payload, yet it kept appearing as a variable collection —
 * because generateDesignSystem also uploads tokens.json, and the plugin reads
 * that too. So a section added there reaches Figma without ever passing the
 * checks above.
 *
 * Asserted against the generator's SOURCE for the same reason deviceChrome's
 * emission is: `designSystemJSON` is assembled inside a function that uploads
 * to Firebase, so there is no way to read the emitted file without standing up
 * the whole upload path.
 */
describe('tokens.json does not smuggle collections into Figma', () => {
  const gen = readFileSync(resolve(__dirname, '../utils/generateDesignSystem.ts'), 'utf8');

  it('adds no Cognitive section', () => {
    /* Removed 2026-09-29. It held a Dyslexia and an ADHD preset that nothing
       read back, and became a collection deleted by hand after every
       regenerate. */
    expect(gen).not.toMatch(/designSystemJSON\.Cognitive\s*=/);
  });

  it('keeps --Cognitive-Multiplier in the CSS, which is the live mechanism', () => {
    /* The feature was not removed with the section, and this is the assertion
       that says so. foundation.css declares the multiplier at 1 and raises it
       to 1.5 under the accessibility overrides; the library multiplies line
       heights by it (Link.js reads it five times). Deleting THIS would be the
       real regression, and it looks superficially like the same cleanup. */
    expect(gen).toMatch(/--Cognitive-Multiplier:\s*1;/);
    expect(gen).toMatch(/--Cognitive-Multiplier:\s*1\.5;/);
  });

  it('puts no top-level sections on tokens.json at all', () => {
    /* Was ['Platform']; Platform has since been retired in favour of
       Devices-Type and removed, as Cognitive was. Both existed only to be
       turned into collections by a plugin reading the wrong file.

       Empty is the state worth defending: with nothing assigned here, the only
       route into Figma is generateFigmaJSON, where figmaCollectionNames
       checks every name against the collections the file actually has. */
    const sections = [...gen.matchAll(/designSystemJSON\.([A-Z][\w-]*)\s*=/g)].map((m) => m[1]);
    expect([...new Set(sections)].sort()).toEqual([]);
  });
});
