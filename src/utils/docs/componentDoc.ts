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
 *   Theming       where the theme goes IN CODE and IN FIGMA, as two columns.
 *                 Agents write in both, and the answers differ: `data-theme`
 *                 on an element, versus a variable mode on one specific node.
 *                 A themed node that also carries a shadow tints the shadow.
 *   Tokens        what each one sets, whether it varies, and which Figma
 *                 variable it comes from. That last column is written nowhere
 *                 else in the system, and it is what an agent working in Figma
 *                 needs to change a value rather than guess at one.
 *   Gotchas       a value or behaviour that LOOKS wrong until explained, and
 *                 that someone has already got wrong. Not a tip and not a
 *                 preference — that rule is what stops it becoming a junk
 *                 drawer, which is the failure mode of every section like it.
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

/**
 * One CSS custom property, and where it comes from.
 *
 * `variesWith` is the question an agent cannot answer from the name: a token
 * that changes with the size mode has Sm-/Lg- siblings and must not be
 * hardcoded, one that changes with theme+surface resolves differently inside
 * every zone, and a fixed one is safe to reason about directly.
 */
export interface TokenDoc {
  name: string;
  /** What it sets, in a few words. */
  sets: string;
  /** '—' when fixed. Otherwise what moves it: size, theme, surface, device. */
  variesWith: string;
  /** The Figma variable it is generated from, or '—' when it has none. */
  figma: string;
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
  /**
   * The wrong-component errors, which are the most common kind an agent makes.
   *
   * There is deliberately no `useWhen`: it restated the summary a line above
   * it, and two ways to say the same thing is how they drift apart.
   */
  insteadUse: Array<{ when: string; use: string }>;
  props: PropDoc[];
  states: StateDoc[];
  /**
   * Where the theme goes, in both tools.
   *
   * Two columns because the answers genuinely differ — `data-theme` on an
   * element against a variable mode on one specific node — and an agent asked
   * to theme a component in Figma cannot derive the node from the CSS.
   */
  theming: Array<{ inCode: string; inFigma: string }>;
  /** Extra theming rules that are not a code/Figma pair. */
  themingNotes?: string[];
  tokens: TokenDoc[];
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

  if (doc.insteadUse.length) {
    out.push('### Reach for something else when', '');
    out.push(...doc.insteadUse.map(i => `- ${i.when} → \`${i.use}\``));
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

  if (doc.theming.length) {
    out.push('### Theming', '');
    out.push(...table(['In code', 'In Figma'],
      doc.theming.map(t => [t.inCode, t.inFigma])));
    if (doc.themingNotes?.length) {
      out.push('');
      out.push(...doc.themingNotes.map(n => `- ${n}`));
    }
    out.push('');
  }

  if (doc.tokens.length) {
    out.push('### Tokens it reads', '');
    out.push(...table(['Token', 'Sets', 'Varies with', 'Figma variable'],
      doc.tokens.map(t => [`\`${t.name}\``, t.sets, t.variesWith,
        t.figma === '—' ? '—' : `\`${t.figma}\``])));
    out.push('');
  }
  out.push(...bullets('Composition', doc.composition));
  out.push(...bullets('Accessibility', doc.accessibility));
  out.push(...bullets('Gotchas', doc.gotchas));

  const figma = renderFigmaSection(doc.name, link);
  if (figma.length) out.push(...figma, '');

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
