import { useEffect, useRef, useState } from 'react';

const DS_IDS = [
  'ffa9b21d-9ee9-415e-9457-929da502acfd',
  '22387e46-af26-4a3c-bc2e-dedb70b8a166',
  'c8d26f1e-7d5a-4361-85be-a1799bba6855',
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
  background: var(--Container);
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
  background: var(--Container);
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
.dino-mood-card .card-tag {
  display: inline-block; padding: 4px 11px;
  background: var(--Hover);
  color: var(--Text-Primary);
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
  border-radius: 999px; font-weight: 500;
}
.dino-mood-card.active .tag-default { display: none; }
.dino-mood-card:not(.active) .tag-active { display: none; }

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
      setRecords(valid);
    });
    return () => { cancelled = true; };
  }, []);

  // Whenever the active DS or mode changes, swap the injected CSS. The bundle
  // is: foundation + base + core + typography + styles (shared) + the active
  // mode file. Appended last so it wins the cascade against the lib's defaults.
  useEffect(() => {
    const active = records[activeIdx];
    if (!active) return;
    let el = document.getElementById(ACTIVE_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = ACTIVE_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = active.baseCss + '\n\n' + (dark ? active.darkCss : active.lightCss);
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

  return (
    <>
      <button
        type="button"
        className="dino-mood-toggle"
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
              <div key={id} className="dino-mood-card" style={{ opacity: 0.5 }}>
                <div className="mood-image" />
                <div className="card-content">
                  <h3 className="card-title">Loading…</h3>
                </div>
              </div>
            ))
          : records.map((r, i) => {
              const active = i === activeIdx;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`dino-mood-card${active ? ' active' : ''}`}
                  onClick={e => handleCard(e, i)}
                >
                  <div className="mood-image">
                    <img src={r.moodboardUrl} alt={r.name} />
                  </div>
                  <div className="card-content">
                    <h3 className="card-title">{r.name}</h3>
                    <span className="card-tag">
                      <span className="tag-default">Click to apply →</span>
                      <span className="tag-active">● Currently applied</span>
                    </span>
                  </div>
                </button>
              );
            })}
      </div>
    </>
  );
}
