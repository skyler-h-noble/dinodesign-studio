/**
 * The per-component reference an AI agent is handed to build with the system.
 *
 * The reader is a coding agent, not a designer, so every section has to change
 * what it WRITES. That test removed three sections a human doc would carry:
 *
 *   Anatomy       a visual decomposition. An agent does not place parts, it
 *                 passes props. Anything load-bearing moved to Composition.
 *   Dependencies  a used-by graph is impact analysis, a maintainer's concern.
 *                 An agent can read imports.
 *   Change log    it cares about the API in front of it, not its history.
 *
 * And added three no human doc has, because they are where this system differs
 * from every other:
 *
 *   Theming       where data-theme goes, and where it must NOT. A themed node
 *                 that also carries a shadow tints the shadow.
 *   Tokens        the vars a consumer must define. The library's Link reads
 *                 --Link / --Link-Visited, which nothing emits.
 *   Gotchas       the "why" behind a value that looks arbitrary.
 *
 * Content is hand-authored rather than extracted. Props could be read from the
 * source, but "use TextArea for multiline" cannot, and a doc that is half
 * generated and half written drifts in the half nobody is watching.
 */

import {
  figmaMappingFor, NO_FIGMA_PAGE, type FigmaComponentMapping,
} from '../figmaComponentMap';
import {
  hasComponentMap, figmaComponentUrl, componentsOnPage,
  type LinkedFigmaFileEntry,
} from '../figmaLink';

export interface PropDoc {
  name: string;
  type: string;
  /** The allowed values, or a shape. Empty for a free value. */
  values?: string[];
  /** Stated even when it is undefined — the default is what an agent gets wrong. */
  default: string;
  note?: string;
}

export interface StateDoc {
  state: string;
  /** 'prop' when the caller sets it, 'interaction' when the browser does. */
  setBy: 'prop' | 'interaction' | 'context';
  note?: string;
}

export interface ComponentDoc {
  name: string;
  /** One sentence. What it is for, not what it looks like. */
  summary: string;
  useWhen: string[];
  /** The wrong-component errors, which are the most common kind. */
  insteadUse: Array<{ when: string; use: string }>;
  props: PropDoc[];
  states: StateDoc[];
  /** Where a theme goes on THIS component, and where it must not. */
  theming: string[];
  /** CSS custom properties it reads. */
  tokens: string[];
  composition: string[];
  accessibility: string[];
  gotchas: string[];
}

/* ── The Figma block ───────────────────────────────────────────────────── */

/**
 * Three outcomes, and the middle one is where every existing user is.
 *
 * A link written by a plugin build that predates component reporting has a
 * file key and no map: the file opens, individual components do not. Telling
 * that user to "link your Figma file" sends them to do something they have
 * already done, so the two cases get different instructions.
 */
export function renderFigmaSection(
  component: string,
  link: LinkedFigmaFileEntry | null,
): string[] {
  const mapping = figmaMappingFor(component);
  if (!mapping) return renderNoFigmaPage(component);

  const lines = ['### In Figma', ''];
  if (!link) {
    lines.push(
      `Designed on the **${mapping.page}** page.`, '',
      '> No Figma file is linked to this design system yet. In DinoDesign Studio,',
      '> open your design system and choose **Get your design into Figma**.',
    );
    return lines;
  }
  if (!hasComponentMap(link)) {
    lines.push(
      `Designed on the **${mapping.page}** page of [${link.fileName || 'your Figma file'}](${link.fileUrl}).`,
      '',
      '> Direct component links are unavailable. Re-run the OmniDesign plugin in',
      '> your Figma file to refresh the component map — the file is already linked.',
    );
    return lines;
  }

  const onPage = componentsOnPage(link, mapping.page);
  const byName = new Map(onPage.map(c => [c.name, c]));
  if (!mapping.sets.length) {
    lines.push(`[${mapping.page}](${link.fileUrl}) — styles, not component sets.`);
    if (mapping.note) lines.push('', mapping.note);
    return lines;
  }

  for (const setName of mapping.sets) {
    const found = byName.get(setName);
    if (!found) {
      /* Named in the map, absent from the user's file: they renamed or deleted
         it. Said plainly rather than dropped, because a silently shorter list
         looks like the component simply has fewer parts. */
      lines.push(`- **${setName}** — not found in your file (renamed or removed?)`);
      continue;
    }
    const variants = found.variants > 1 ? ` · ${found.variants} variants` : '';
    lines.push(`- [${setName}](${figmaComponentUrl(link, found)})${variants}`);
  }
  if (mapping.note) lines.push('', mapping.note);
  return lines;
}

function renderNoFigmaPage(component: string): string[] {
  const { undesigned, notDrawable, deferred } = NO_FIGMA_PAGE;
  if ((notDrawable as readonly string[]).includes(component)) {
    return ['### In Figma', '', 'Not drawn — this is layout or infrastructure, with nothing to place on a page.'];
  }
  if ((undesigned as readonly string[]).includes(component)) {
    return ['### In Figma', '', 'No Figma counterpart yet. Build from the props below; the design is not drawn.'];
  }
  if ((deferred as readonly string[]).includes(component)) {
    return ['### In Figma', '', 'Deliberately undocumented for now — the design is still being settled.'];
  }
  return [];
}

/* ── The document ──────────────────────────────────────────────────────── */

/* A pipe inside a cell IS the column separator, so a type like
   `number | string` silently splits the row and every cell after it shifts
   left. Escaped here rather than in the content, so an author writing a union
   type does not have to know. */
const cell = (v: string) => v.replace(/\|/g, '\\|');

const table = (head: string[], rows: string[][]): string[] => [
  `| ${head.join(' | ')} |`,
  `| ${head.map(() => '---').join(' | ')} |`,
  ...rows.map(r => `| ${r.map(cell).join(' | ')} |`),
];

const bullets = (title: string, items: string[]): string[] =>
  items.length ? [`### ${title}`, '', ...items.map(i => `- ${i}`), ''] : [];

export function renderComponentDoc(
  doc: ComponentDoc,
  link: LinkedFigmaFileEntry | null = null,
): string {
  const out: string[] = [`## ${doc.name}`, '', doc.summary, ''];

  if (doc.useWhen.length || doc.insteadUse.length) {
    out.push('### Use it when', '');
    out.push(...doc.useWhen.map(u => `- ${u}`));
    if (doc.insteadUse.length) {
      out.push('', '**Reach for something else when:**', '');
      out.push(...doc.insteadUse.map(i => `- ${i.when} → \`${i.use}\``));
    }
    out.push('');
  }

  if (doc.props.length) {
    out.push('### Props', '');
    out.push(...table(
      ['Prop', 'Type', 'Values', 'Default'],
      doc.props.map(p => [
        `\`${p.name}\``,
        p.type,
        p.values?.length ? p.values.map(v => `\`${v}\``).join(' · ') : '—',
        `\`${p.default}\``,
      ]),
    ));
    const noted = doc.props.filter(p => p.note);
    if (noted.length) {
      out.push('');
      out.push(...noted.map(p => `- \`${p.name}\` — ${p.note}`));
    }
    out.push('');
  }

  if (doc.states.length) {
    out.push('### States', '');
    out.push(...table(['State', 'Set by'], doc.states.map(s => [
      s.state,
      s.setBy === 'interaction' ? 'interaction — not a prop' : s.setBy,
    ])));
    const noted = doc.states.filter(s => s.note);
    if (noted.length) {
      out.push('');
      out.push(...noted.map(s => `- ${s.state} — ${s.note}`));
    }
    out.push('');
  }

  out.push(...bullets('Theming', doc.theming));
  if (doc.tokens.length) {
    out.push('### Tokens it reads', '', doc.tokens.map(t => `\`${t}\``).join(' · '), '');
  }
  out.push(...bullets('Composition', doc.composition));
  out.push(...bullets('Accessibility', doc.accessibility));
  out.push(...bullets('Gotchas', doc.gotchas));

  const figma = renderFigmaSection(doc.name, link);
  if (figma.length) out.push(...figma, '');

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
