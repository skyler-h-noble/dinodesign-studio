/**
 * The Omni Design plugin builds charts with a COPY of the studio's chart spec
 * and layout code (it is one script with no module system, so it cannot
 * import them). Parity between the exported code and the Figma build rests on
 * those copies being the same code, so this compares them block for block.
 *
 * Edit the studio files, then paste the marked blocks into the plugin's
 * code.ts without the `export` keywords.
 *
 * Skipped when the plugin repo is not checked out next to the studio — the
 * comparison needs both, and a missing sibling is not a drift.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLUGIN = process.env.DINO_PLUGIN_CODE
  || resolve(__dirname, '../../../dino-figma-plugin/code.ts');

function block(src: string, tag: string): string | null {
  const m = src.match(new RegExp(`// <${tag}>\\n([\\s\\S]*?)// </${tag}>`));
  return m ? m[1] : null;
}
const withoutExports = (s: string) => s.replace(/^export /gm, '');

describe.skipIf(!existsSync(PLUGIN))('the plugin carries the studio\'s chart code', () => {
  const plugin = existsSync(PLUGIN) ? readFileSync(PLUGIN, 'utf8') : '';

  for (const [tag, file] of [
    ['chart-spec', '../utils/addOns/charts/chartSpec.ts'],
    ['chart-layout', '../utils/addOns/charts/chartLayout.ts'],
  ] as const) {
    it(`${tag} matches`, () => {
      const studio = block(readFileSync(resolve(__dirname, file), 'utf8'), tag);
      const copy = block(plugin, tag);
      expect(studio, `${tag} markers missing in the studio`).not.toBeNull();
      expect(copy, `${tag} markers missing in the plugin's code.ts`).not.toBeNull();
      expect(copy).toBe(withoutExports(studio!));
    });
  }
});
