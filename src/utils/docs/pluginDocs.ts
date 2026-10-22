/**
 * The component-docs table the Figma plugin inlines (COMPONENT_DOCS_BY_SET in
 * dino-figma-plugin/code.ts), generated from FIGMA_COMPONENT_MAP and
 * COMPONENT_DOCS — the two places that table is written down and tested.
 *
 * The plugin cannot import it (its manifest loads code.js alone), so the
 * table is pasted in. It was pasted once and then edited there, so it now holds
 * sets and wording the studio does not; Breadcrumbs, the assembled trail, was
 * never in it. pluginDocs.test.ts fails when a mapped set is missing from the
 * plugin and adds it with WRITE_PLUGIN_DOCS=1 — it never rewrites an entry.
 *
 * Keys are BARE set names. The plugin also matches a set hidden with a
 * leading "." or "_" under its bare name.
 */
import { FIGMA_COMPONENT_MAP } from '../figmaComponentMap';
import { COMPONENT_DOCS } from './components';
import { mergeDescription } from './figmaDescription';

/** Sets whose hand-written Figma description beats anything generated. */
export const KEEP_DESCRIPTION = new Set(['Card', 'Card Content / Ecommerce']);

/** Map rows keyed by a different export than the one documented. */
const DOC_NAME: Record<string, string> = { Switch: 'SwitchInput' };

export interface PluginDocEntry { component: string; slug: string; description: string; keepDescription?: boolean }

export function pluginDocEntries(): Array<[string, PluginDocEntry]> {
  const out: Array<[string, PluginDocEntry]> = [];
  for (const [component, mapping] of Object.entries(FIGMA_COMPONENT_MAP)) {
    const doc = COMPONENT_DOCS.find((d) => d.name === (DOC_NAME[component] ?? component));
    if (!doc) continue;
    for (const set of mapping.sets) {
      out.push([set, {
        component: doc.name, slug: doc.name, description: mergeDescription(doc, ''),
        ...(KEEP_DESCRIPTION.has(set) ? { keepDescription: true } : {}),
      }]);
    }
  }
  return out;
}

/** Non-ASCII as \uXXXX, as the plugin's copy has always been written. */
const ascii = (s: string) => s.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/** The object literal's body: one line per set. */
export function pluginDocsSource(): string {
  return pluginDocEntries().map(([set, e]) =>
    `  ${ascii(JSON.stringify(set))}: { component: ${JSON.stringify(e.component)}, slug: ${JSON.stringify(e.slug)}, description: ${ascii(JSON.stringify(e.description))}${e.keepDescription ? ', keepDescription: true' : ''} },`,
  ).join('\n');
}
