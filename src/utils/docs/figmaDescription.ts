/**
 * What a component set's Figma description should say.
 *
 * Figma's Component configuration dialog has two fields, and they want
 * different things:
 *
 *   Description  generic — identical for every user, so it can live in the
 *                template and be written once.
 *   Link         per design system, because it carries the user's uuid. The
 *                plugin writes it at import time; see docsLink.ts.
 *
 * The description is NOT "replace whatever is there". Two components already
 * carry hand-written ones better than anything generated — Day Cell's
 * "Selection and State are separate axes" is a fact no summary field holds —
 * and overwriting them to gain a do-not list is a bad trade.
 *
 * So it merges. Everything above the marker is human and untouched; everything
 * below is generated and replaced on every run. A description with no marker is
 * all human, and the generated block is appended beneath it.
 */
import type { ComponentDoc } from './componentDoc';

/** Owned by the generator. Everything after it is rewritten each run. */
export const GENERATED_MARKER = '———';

/** The part this file owns: what not to use, and where the theme goes. */
export function generatedBlock(doc: ComponentDoc): string {
  const lines: string[] = [];
  if (doc.insteadUse.length) {
    lines.push(...doc.insteadUse.map(i => `Use ${i.use} when ${lower(i.when)}.`));
  }
  const themed = doc.theming[0];
  if (themed) lines.push('', `Theme: ${themed.inFigma}`);
  return lines.join('\n').trim();
}

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * The description to write, given whatever is already there.
 *
 * The human half is preserved even when it is only a fragment: judging whether
 * an existing description is "good enough" means guessing, and a wrong guess
 * silently destroys the one thing a person bothered to write. Keeping it costs
 * two lines of text.
 */
export function mergeDescription(doc: ComponentDoc, existing: string | null | undefined): string {
  const current = (existing || '').trim();
  const human = current.includes(GENERATED_MARKER)
    ? current.split(GENERATED_MARKER)[0].trim()
    : current;
  /* No human text at all: the summary becomes it. With text, the summary is
     dropped — a person who wrote a description does not need it restating. */
  const top = human || doc.summary;
  const block = generatedBlock(doc);
  return block ? `${top}\n\n${GENERATED_MARKER}\n${block}` : top;
}

/** True when a rewrite would change nothing — so the plugin can skip the write. */
export function descriptionIsCurrent(doc: ComponentDoc, existing: string | null | undefined): boolean {
  return (existing || '').trim() === mergeDescription(doc, existing).trim();
}
