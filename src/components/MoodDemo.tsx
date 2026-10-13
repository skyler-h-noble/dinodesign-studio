/*
 * Raw elements here are a deliberate exception, and this says why so the audit
 * does not keep finding them.
 *
 * This widget renders THREE OTHER design systems side by side, loading each
 * one's published CSS and letting the cards paint themselves from it. Its own
 * styles are token-driven — var(--Background), var(--Border), var(--Hover),
 * var(--Buttons-Primary-Button) — so it follows whichever system is active;
 * what it does not do is use lib components, because the card's whole job is to
 * be a surface those foreign stylesheets paint.
 *
 * Closest in spirit to PhonePreview: chrome that displays someone else's
 * system. `.card-title` sets its own weight, size and color, so swapping in
 * the lib's H3 would change nothing visible while adding a cascade to reason
 * about.
 *
 * If this should be converted anyway, the card is a <Card> + <H3> + <Body>.
 *
 * The cards themselves ARE lib components: the clickable Card (SelectableCard)
 * is the control — role="button", Enter/Space, focus ring, hover elevation,
 * and the selected border on the applied one. Inside, the active card carries
 * a Tag and the others show an Apply Button, drawn as a span, aria-hidden and
 * out of the tab order: the card is already the button, and a real button
 * nested inside a role="button" would be two controls in one.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Tag, SelectableCard } from '@omni-design/components';

/* The portfolio's three showcase systems (portfolio-omni-styled
   case-studies/omni-tokens.js names them). The previous three were deleted
   from Storage, which left these cards on "Loading…" for good — if these move
   too, change them here and in the portfolio together. */
const DS_IDS = [
  'd1bd0ba4-4906-4801-93c3-49db251f10d2', // Cocktail Hour
  'd7ad345c-33d7-43f6-8f30-41728bf395e6', // Popsicles
  'b36585cd-f290-4a74-9749-4ae99e1986c0', // Chocolate
];

const STORAGE_BASE = 'https://firebasestorage.googleapis.com/v0/b/dino-design.firebasestorage.app/o';

function storageUrl(id: string, path: string): string {
  return `${STORAGE_BASE}/${encodeURIComponent(`design-systems/${id}/${path}`)}?alt=media`;
}

interface ThemeJson {
  name?: string;
  foundation?: string;
  core?: string;
  base?: string;
  styles?: string;
  lightMode?: string;
  darkMode?: string;
}

interface DsRecord {
  id: string;
  name: string;
  moodboardUrl: string;
  // CSS files shared across modes — set up component rendering, typography,
  // button shape/padding, radii, font imports.
  baseCss: string;        // includes foundation + base + core + typography + styles, concatenated
  // Mode-specific token files (just colors).
  lightCss: string;
  darkCss: string;
}

const STATIC_CSS = `
/* Floating sun/moon toggle — pinned under the sticky AppBar */
.dino-mood-toggle {
  position: fixed;
  top: 76px;
  right: 24px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--Border);
  background: var(--Background);
  color: var(--Text);
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
  transition: transform 150ms ease;
  z-index: 99;
}
.dino-mood-toggle:hover  { transform: scale(1.06); }
.dino-mood-toggle:active { transform: scale(0.95); }
.dino-mood-toggle svg { width: 18px; height: 18px; }

.dino-mood-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  width: 100%;
}
.dino-mood-card {
  background: var(--Background);
  border: 1px solid var(--Border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
  text-align: left;
  color: inherit;
  width: 100%;
  padding: 0;
  font-family: inherit;
  display: block;
}
.dino-mood-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.10);
}
.dino-mood-card.active {
  border-color: var(--Buttons-Primary-Button);
  cursor: default;
}
.dino-mood-card.active:hover { transform: none; }
.dino-mood-card .mood-image { aspect-ratio: 4 / 3; overflow: hidden; background: var(--Hover); }
.dino-mood-card .mood-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dino-mood-card .card-content { padding: 18px 18px 20px; }
.dino-mood-card .card-title {
  font-weight: 600; font-size: 18px; margin: 0 0 6px;
  letter-spacing: -0.01em; color: var(--Container-Text, var(--Text));
}

::view-transition-old(root),
::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
::view-transition-new(root) { z-index: 1; }
::view-transition-old(root) { z-index: 0; }
`;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.text();
}

async function loadDS(id: string): Promise<DsRecord | null> {
  try {
    const themeRes = await fetch(storageUrl(id, 'theme.json'));
    if (!themeRes.ok) return null;
    const theme: ThemeJson = await themeRes.json();

    const foundationUrl = theme.foundation || storageUrl(id, 'foundation.css');
    const baseUrl = theme.base || storageUrl(id, 'base.css');
    const coreUrl = theme.core || storageUrl(id, 'core.css');
    const typographyUrl = storageUrl(id, 'typography-tokens.css');
    const stylesUrl = theme.styles || storageUrl(id, 'styles.css');
    const lightUrl = theme.lightMode || storageUrl(id, 'Light-Mode.css');
    const darkUrl = theme.darkMode || storageUrl(id, 'Dark-Mode.css');

    const [foundationCss, baseFileCss, coreCss, typographyCss, stylesCss, lightCss, darkCss] = await Promise.all([
      fetchText(foundationUrl),
      fetchText(baseUrl),
      fetchText(coreUrl),
      fetchText(typographyUrl),
      fetchText(stylesUrl),
      fetchText(lightUrl),
      fetchText(darkUrl),
    ]);

    return {
      id,
      name: theme.name || 'Design System',
      moodboardUrl: storageUrl(id, 'moodboard.png'),
      // Concatenate the non-mode files in cascade order: foundation (component
      // sizing/radii) → base (button rendering) → core (token mapping) →
      // typography (font sizes/weights) → styles (font imports, body reset).
      baseCss: [foundationCss, baseFileCss, coreCss, typographyCss, stylesCss].join('\n\n'),
      lightCss,
      darkCss,
    };
  } catch (err) {
    console.warn(`[MoodDemo] failed to load ${id}:`, err);
    return null;
  }
}

const ACTIVE_STYLE_ID = 'dino-active-ds-css';

export default function MoodDemo() {
  const [records, setRecords] = useState<DsRecord[]>([]);
  /* "Loading…" is only true until the fetches settle. All three demo systems
     were once deleted from Storage and the cards said Loading… forever — a
     placeholder that never resolves reads as a broken page, so once loading is
     over and nothing came back, the demo hides itself and says why. */
  const [settled, setSettled] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dark, setDark] = useState(false);
  const inFlight = useRef(false);

  // Inject the static CSS (card/toggle styles) once at end-of-head.
  useEffect(() => {
    const id = 'dino-mood-demo-static-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = STATIC_CSS;
    document.head.appendChild(el);
  }, []);

  // Fetch the 3 design systems on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all(DS_IDS.map(loadDS)).then(results => {
      if (cancelled) return;
      const valid = results.filter((r): r is DsRecord => r !== null);
      if (valid.length < DS_IDS.length) {
        console.warn(`[MoodDemo] ${DS_IDS.length - valid.length} of ${DS_IDS.length} demo design systems did not load — `
          + 'check that DS_IDS still exist in Storage.');
      }
      setRecords(valid);
      setSettled(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Whenever the active DS or mode changes, swap the injected CSS. The bundle
  // is: foundation + base + core + typography + styles (shared) + the active
  // mode file. Appended last so it wins the cascade against the lib's defaults.
  //
  // @import statements must appear before all other rules per CSS spec, but
  // concatenating multiple files leaves them mid-stylesheet (browser ignores
  // them — fonts don't load). Extract all @imports to the top of the bundle.
  useEffect(() => {
    const active = records[activeIdx];
    if (!active) return;
    let el = document.getElementById(ACTIVE_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = ACTIVE_STYLE_ID;
      document.head.appendChild(el);
    }
    const combined = active.baseCss + '\n\n' + (dark ? active.darkCss : active.lightCss);
    const imports: string[] = [];
    /* The import's TARGET is matched whole — url(…) or a quoted string —
       before the closing semicolon. `@import[^;]+;` stopped at the first ';',
       and Google Fonts URLs carry them (`wght@400;600;700`): the import was
       cut mid-URL, the unclosed url(" swallowed the rest of the sheet, and the
       bundle parsed to three @import rules and nothing else — so clicking a
       card applied nothing. */
    const body = combined.replace(/@import\s+(?:url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"[^"]*"|'[^']*')[^;]*;/g, (m) => {
      imports.push(m);
      return '';
    });
    // Deduplicate identical font imports across files.
    const uniqueImports = Array.from(new Set(imports));
    el.textContent = uniqueImports.join('\n') + '\n\n' + body;
  }, [records, activeIdx, dark]);

  // Clean up the injected DS CSS when the landing page unmounts.
  useEffect(() => {
    return () => {
      document.getElementById(ACTIVE_STYLE_ID)?.remove();
    };
  }, []);

  function rippleTo(mutate: () => void, x: number, y: number) {
    if (inFlight.current) return;
    const docAny = document as any;
    if (!docAny.startViewTransition) {
      mutate();
      return;
    }
    inFlight.current = true;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const transition = docAny.startViewTransition(mutate);
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0 at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 700,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
    transition.finished.finally(() => { inFlight.current = false; });
  }

  function handleCard(e: React.MouseEvent, idx: number) {
    if (idx === activeIdx) return;
    rippleTo(() => setActiveIdx(idx), e.clientX, e.clientY);
  }

  function handleToggle(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    rippleTo(() => setDark(d => !d), r.left + r.width / 2, r.top + r.height / 2);
  }

  if (settled && records.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="dino-mood-toggle"
        data-surface="Container"
        onClick={handleToggle}
        aria-label="Toggle light/dark"
      >
        {dark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </button>

      <div className="dino-mood-grid">
        {records.length === 0
          ? DS_IDS.map(id => (
              <div key={id} className="dino-mood-card" data-surface="Container" style={{ opacity: 0.5 }}>
                <div className="mood-image" />
                <div className="card-content">
                  <h3 className="card-title">Loading…</h3>
                </div>
              </div>
            ))
          : records.map((r, i) => {
              const active = i === activeIdx;
              return (
                <SelectableCard
                  key={r.id}
                  selected={active}
                  size="small"
                  onClick={(e: React.MouseEvent) => handleCard(e, i)}
                  aria-label={active ? `${r.name}, currently applied` : `Apply ${r.name}`}
                  className="dino-mood-card"
                >
                  {/* CardOverflow / CardContent would bleed the image to the edge,
                      but 0.14.1 does not export them — so it sits in the padding. */}
                  <div className="mood-image">
                    <img src={r.moodboardUrl} alt="" />
                  </div>
                  <div className="card-content">
                    <h3 className="card-title">{r.name}</h3>
                    {active
                      ? <Tag color="primary">Currently applied</Tag>
                      : (
                        <Button variant="default" size="small" component="span" tabIndex={-1} aria-hidden="true">
                          Apply
                        </Button>
                      )}
                  </div>
                </SelectableCard>
              );
            })}
      </div>
    </>
  );
}
