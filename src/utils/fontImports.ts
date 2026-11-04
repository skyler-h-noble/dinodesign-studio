/**
 * Font loading for a published system.
 *
 * The generator writes the Google Fonts @imports at the top of every CSS
 * file, so a page that loads the system's six sheets carried the same four
 * imports six times, and the fonts were found only after each sheet had
 * downloaded: theme.json -> sheet -> @import -> font file.
 *
 * At publish the imports stay in foundation.css alone (the Provider loads it
 * first, so a consumer still gets them) and their URLs are listed in
 * theme.json as `fonts`, so the Provider can request them as <link>s the
 * moment it reads the manifest, in parallel with the sheets.
 */

const IMPORT_RE = /^@import url\(['"]?(https:\/\/fonts\.googleapis\.com\/css2\?[^'")]+)['"]?\);[ \t]*\r?\n?/gm;

/** The Google Fonts URLs a stylesheet imports, in order, without duplicates. */
export function extractFontImports(css: string): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(IMPORT_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** The stylesheet without its Google Fonts @imports. */
export function stripFontImports(css: string): string {
  return css.replace(IMPORT_RE, '').replace(/^\s*\n/, '');
}

type UploadFile = { name: string; content: string; type: string };

/**
 * Keep the font imports in foundation.css only and list them in theme.json.
 * Mutates the files' content in place; a system with no foundation.css or no
 * theme.json is left as it is.
 */
export function consolidateFontImports(files: UploadFile[]): string[] {
  const foundation = files.find((f) => f.name === 'foundation.css');
  const theme = files.find((f) => f.name === 'theme.json');
  if (!foundation || !theme) return [];
  const urls: string[] = [];
  for (const f of files) {
    if (f.type !== 'text/css') continue;
    for (const u of extractFontImports(f.content)) if (!urls.includes(u)) urls.push(u);
  }
  if (!urls.length) return [];
  for (const f of files) {
    if (f.type === 'text/css') f.content = stripFontImports(f.content);
  }
  foundation.content = urls.map((u) => `@import url('${u}');`).join('\n') + '\n' + foundation.content;
  const manifest = JSON.parse(theme.content);
  manifest.fonts = urls;
  theme.content = JSON.stringify(manifest, null, 2);
  return urls;
}
