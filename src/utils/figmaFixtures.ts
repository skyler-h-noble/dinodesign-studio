// Registry of pre-fetched Figma frame fixtures available to the AAID
// workbench. Each fixture is a real Figma node tree (or a faithful
// approximation) saved to public/figma-fixtures/<file>.json. The workbench
// loads them via fetch() at conversion time so they're zero-cost test
// inputs — no Figma API hits, no rate limits, durable across sessions.
//
// To add a new fixture:
//   1. Drop the JSON file in public/figma-fixtures/<name>.json
//   2. Add an entry below
//   3. The fixture appears in the workbench dropdown automatically

export interface FigmaFixture {
  /** Stable id used as <option> value and React key. */
  id: string;
  /** Human-readable label shown in the dropdown. */
  label: string;
  /** Path relative to public/ — vite serves these as static files. */
  file: string;
  /** Optional Figma URL the fixture was originally extracted from.
   *  Lets the workbench's "Open in Figma" link still work and gives us a
   *  trail for regenerating the fixture later. */
  sourceUrl?: string;
  /** One-line note about why this fixture is in the corpus. */
  note?: string;
}

export const FIXTURES: FigmaFixture[] = [
  {
    id: 'omni-designs-test',
    label: 'Omni-Designs · Test card (Display + 3 list rows + Avatar)',
    file: '/figma-fixtures/omni-designs-test.json',
    sourceUrl: 'https://www.figma.com/design/ycUFfME6PNi0TFoQJYwl4l/Omni-Designs?node-id=6883-29407',
    note: 'Initial smoke-test fixture. Card frame with vertical auto-layout, 3 list rows with thumbnail + 3-line text + checkbox, ending with a small avatar.',
  },
];

export async function loadFixture(fixture: FigmaFixture): Promise<unknown> {
  const res = await fetch(fixture.file);
  if (!res.ok) {
    throw new Error(`Fixture ${fixture.id} not found at ${fixture.file} (HTTP ${res.status}).`);
  }
  return res.json();
}
