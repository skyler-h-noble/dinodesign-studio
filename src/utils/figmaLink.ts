// figmaLink.ts — which Figma file a design system belongs to, and whether what
// is in it is current.
//
// TWO FACTS, deliberately separate. They look like one and are not:
//
//   LINKED   do we know which Figma file this design system lives in?
//   PUSHED   have the current version's values reached it?
//
// The card showed only the second, so a system nobody had ever opened in Figma
// and one linked-but-stale read the same. They are also independent in both
// directions: a file can be linked before the first push, and everything
// pushed before this field existed is pushed but unlinked.
//
// Why linking matters at all: the Figma writer is UPDATE-ONLY. It matches by
// name and skips a name the file does not have, in silence, reporting success
// either way. Every divergence found on 2026-09-29 was that — a whole
// `Components` collection landing nowhere, `Other/Nav-Bar Height` and
// `Colors/Icon-Variant-Opacity` written into nothing for months, `Platform
// Spacer` never connecting because the file spells it with a space. Knowing
// the file is what lets anything check.

/** The file key out of any Figma URL. */
export function parseFigmaFileKey(url: string): string | null {
  /* Deliberately NOT parseFigmaUrl from figmaApi.ts. That one requires a
     `node-id` and returns null without one, because its caller converts a
     single frame. A design system links to a FILE, and the URL someone copies
     from the address bar with the whole file open carries no node-id. */
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)figma\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(?:design|file)\/([A-Za-z0-9]{10,})(?:\/|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/* No figmaFileUrl here. MyDesignsPage already has one that takes the file NAME
 * as well and slugs it, and DesignSystemDetail has its own taking a whole
 * LinkedFigmaFile. A third spelling of "build a Figma URL" is how the first two
 * came to disagree; this module does state and parsing only. */

export type FigmaLinkState = 'unlinked' | 'never-pushed' | 'pending' | 'synced';

export interface FigmaLinkInput {
  figmaFileKey?: string | null;
  version: number;
  lastPushedVersion: number;
}

/**
 * What to tell someone about this design system's relationship to Figma.
 *
 * Unlinked wins over every push state, because it is the more actionable
 * thing and because the push state is unverifiable without it: `pushed` here
 * means someone clicked "Mark as pushed", not that anything was confirmed.
 */
export function figmaLinkState(r: FigmaLinkInput): FigmaLinkState {
  if (!r.figmaFileKey) return 'unlinked';
  if (!r.lastPushedVersion) return 'never-pushed';
  return r.version > r.lastPushedVersion ? 'pending' : 'synced';
}

/**
 * The chip's text.
 *
 * `never-pushed` keeps its existing wording rather than saying "1 change":
 * a freshly created system has no CHANGES, it has everything, and counting
 * from zero made that read as a one-line edit.
 */
export function figmaLinkLabel(r: FigmaLinkInput): string {
  const state = figmaLinkState(r);
  if (state === 'unlinked') return 'Not linked to Figma';
  if (state === 'never-pushed') return 'Not yet pushed to Figma';
  if (state === 'synced') return 'In sync with Figma';
  const n = r.version - r.lastPushedVersion;
  return `${n} ${n === 1 ? 'change' : 'changes'} not pushed`;
}

/** Whether the chip is worth showing at all. */
export function figmaLinkNeedsAttention(r: FigmaLinkInput): boolean {
  return figmaLinkState(r) !== 'synced';
}

/** One entry of the record's `linkedFigmaFiles` array. */
export interface LinkedFigmaFileEntry {
  fileKey: string;
  fileName: string;
  fileUrl: string;
  lastSeenAt: Date;
}

/**
 * A pasted URL, as a linked-file entry.
 *
 * The file NAME is taken from the URL's slug, which is a guess: Figma builds
 * the slug by replacing every run of non-alphanumerics with a hyphen, so a file
 * genuinely called "Omni-Designs" and one called "Omni Designs" produce the
 * same slug and come back as the latter. That is acceptable here because the
 * plugin overwrites the name with `figma.root.name` — the real one — on the
 * next import. This is the placeholder until then, not the source of truth.
 */
export function parseFigmaFileLink(url: string): LinkedFigmaFileEntry | null {
  const fileKey = parseFigmaFileKey(url);
  if (!fileKey) return null;
  let fileName = '';
  try {
    const parts = new URL(url.trim()).pathname.split('/').filter(Boolean);
    const slug = parts[2];
    if (slug) fileName = decodeURIComponent(slug).replace(/-+/g, ' ').trim();
  } catch { /* the key parsed, so the URL is sound; a missing slug is fine */ }
  return { fileKey, fileName, fileUrl: url.trim(), lastSeenAt: new Date() };
}

/**
 * Add or replace an entry, keyed on fileKey.
 *
 * Deliberately the same rule the PLUGIN uses — it filters out any entry with a
 * matching fileKey and pushes a fresh one (code.ts, linkFigmaFileToDesignSystem).
 * Two writers on one array have to agree about identity or re-importing into a
 * file already linked from the studio would leave two rows for it, and the UI
 * would offer "Open in Figma (+1)" for a single file.
 *
 * Newest first, matching how both readers sort.
 */
export function upsertLinkedFile(
  list: LinkedFigmaFileEntry[],
  entry: LinkedFigmaFileEntry,
): LinkedFigmaFileEntry[] {
  return [entry, ...list.filter(f => f.fileKey !== entry.fileKey)]
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

/** Drop a link, by key. */
export function removeLinkedFile(
  list: LinkedFigmaFileEntry[],
  fileKey: string,
): LinkedFigmaFileEntry[] {
  return list.filter(f => f.fileKey !== fileKey);
}
