/**
 * The plugin's inlined docs table covers every set the studio maps (pluginDocs.ts).
 * Skipped when the plugin repo is not beside this one. WRITE_PLUGIN_DOCS=all
 * replaces every mapped set's entry from the studio. To add only missing sets:
 *   WRITE_PLUGIN_DOCS=1 npx vitest run src/__tests__/pluginDocs.test.ts
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pluginDocsSource, pluginDocEntries } from '../utils/docs/pluginDocs';

const PLUGIN = join(homedir(), 'Documents', 'dino-figma-plugin', 'code.ts');
const OPEN = 'const COMPONENT_DOCS_BY_SET: Record<string, ComponentDocEntry> = {\n';

describe('plugin component docs', () => {
  it('covers the assembled Breadcrumbs and its parts', () => {
    const sets = pluginDocEntries().map(([s]) => s);
    expect(sets).toEqual(expect.arrayContaining(['Breadcrumbs', 'Breadcrumb-Segments', 'Breadcrumbs-separator']));
  });

  /* Coverage, not equality. The plugin's copy also carries sets the map does
     not list (Swatch, Switch, Brand, the ButtonGroup sets) and descriptions
     edited there, so regenerating it wholesale would delete those. Every set
     the map DOES list must be present; WRITE_PLUGIN_DOCS=1 adds the missing. */
  it.skipIf(!existsSync(PLUGIN))('the plugin covers every mapped set', () => {
    const code = readFileSync(PLUGIN, 'utf8');
    const start = code.indexOf(OPEN);
    expect(start, 'COMPONENT_DOCS_BY_SET not found in the plugin').toBeGreaterThan(-1);
    const bodyStart = start + OPEN.length;
    const end = code.indexOf('\n};', bodyStart);
    const body = code.slice(bodyStart, end);
    const lines = pluginDocsSource().split('\n');
    const missing = lines.filter((line) => !body.includes('\n' + line.slice(0, line.indexOf(':') + 1)) && !body.startsWith(line.slice(0, line.indexOf(':') + 1)));
    /* WRITE_PLUGIN_DOCS=all makes the studio the source: every MAPPED set's
       entry is replaced with the generated one. Unmapped entries are left. */
    if (process.env.WRITE_PLUGIN_DOCS === 'all') {
      const keyOf = (l: string) => l.slice(0, l.indexOf(':') + 1);
      const gen = new Map(lines.map((l) => [keyOf(l), l]));
      const kept = body.split('\n').map((l) => gen.get(keyOf(l)) ?? l);
      const present = new Set(body.split('\n').map(keyOf));
      const added = lines.filter((l) => !present.has(keyOf(l)));
      writeFileSync(PLUGIN, code.slice(0, bodyStart) + [...kept, ...added].join('\n') + code.slice(end));
      return;
    }
    if (process.env.WRITE_PLUGIN_DOCS && missing.length) {
      writeFileSync(PLUGIN, code.slice(0, end) + '\n' + missing.join('\n') + code.slice(end));
      return;
    }
    expect(missing.map((l) => l.slice(0, l.indexOf(':')).trim())).toEqual([]);
  });
});
