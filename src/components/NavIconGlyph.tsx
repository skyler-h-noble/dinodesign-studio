/**
 * One icon by NAME, resolved at render.
 *
 * Names are typed rather than picked — MUI ships several thousand, so a picker
 * is a search problem and a curated dozen is a guess that will be wrong for
 * somebody. That trade puts the whole set in reach and costs one thing: a typo
 * resolves to nothing.
 *
 * So an unresolved name renders a VISIBLE marker rather than empty space. An
 * empty icon slot in a nav looks like a spacing quirk; a marker says the name
 * was not found, which is the difference between noticing and not.
 *
 * These are for the PREVIEW. The spec carries the name and leaves an
 * icon-sized frame for the customer's own component — baking these paths in
 * would put this library's icon set into every file that imports the add-on.
 */
import * as Icons from '@mui/icons-material';

/** MUI exports PascalCase. Accept what a person would reasonably type —
 *  'expand-more', 'expand more', 'expandMore' — rather than only the exact
 *  export name, since the reference page shows names in several forms. */
function normalise(name: string): string {
  return name
    .trim()
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

export function resolveIcon(name: string | undefined) {
  if (!name?.trim()) return null;
  const key = normalise(name);
  const found = (Icons as unknown as Record<string, unknown>)[key];
  /* An OBJECT, not a function. MUI builds each icon with memo(forwardRef(...)),
     so a `typeof === 'function'` check rejects every real icon and accepts
     nothing — which reads as "no icon has that name" for names that all exist. */
  const isComponent = typeof found === 'function'
    || (typeof found === 'object' && found !== null && '$$typeof' in found);
  return isComponent ? (found as typeof Icons.Search) : null;
}

export default function NavIconGlyph(
  { name, fontSize = 'small' }: { name?: string; fontSize?: 'small' | 'medium' },
) {
  const Glyph = resolveIcon(name);

  if (!Glyph) {
    if (!name?.trim()) return null;
    /* Named but not found. Shown, because an empty slot reads as a spacing
       quirk while a marker reads as a mistake — and only one of those gets
       fixed. */
    return (
      <span
        title={`No icon named "${name}"`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '1em', height: '1em', fontSize: fontSize === 'small' ? 20 : 24,
          border: '1px dashed var(--Buttons-Warning-Border)',
          borderRadius: 2, color: 'var(--Buttons-Warning-Border)', lineHeight: 1,
        }}
        aria-hidden
      >
        ?
      </span>
    );
  }

  /* aria-hidden: the control around it owns the name. Both labelled and a
     screen reader announces it twice — "Search, Search button". */
  return <Glyph fontSize={fontSize} aria-hidden />;
}
