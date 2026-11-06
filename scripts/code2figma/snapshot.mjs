#!/usr/bin/env node
// snapshot.mjs — the code → Figma runner: render each state in a snapshot spec
// with the app's own, unmodified code, record what the lib drew, and map it to
// the IR the Figma plugin builds from.
//
//   node scripts/code2figma/snapshot.mjs <spec.json> [--out <dir>] [--app <dir>] [--state <name>]
//
// Writes, per state:  <out>/<state>.recorded.json   what the stand-ins recorded
//                     <out>/<state>.ir.json         the code → Figma IR
//                     <out>/<state>.log             React warnings from the render
// and <out>/coverage.json for the run. Prints a coverage table.
//
// How it runs the app (no bundler, no new dependency):
//   - module.registerHooks (Node 23.5+, in-thread) resolves and loads modules:
//     JSX / TS are transpiled with the studio's own TypeScript; extensionless
//     imports are completed; CSS and image imports become their file name;
//     @omni-design/components becomes a generated module whose exports are the
//     recording stand-ins (src/utils/code2figma/record.ts) plus the real
//     module's non-component exports; @omni-design/icons/<Name> becomes a
//     recording icon.
//   - React, react-dom/server and react-router-dom are the APP's copies, so the
//     version that ships is the version that renders.
//   - each state imports the app under its own ?c2f=<n> query, so module-level
//     state in the app cannot leak from one state into the next.
//   - a minimal `window` (matchMedia at the spec's viewport, localStorage,
//     sessionStorage, location) is installed; there is no `document`, so code
//     that needs a real DOM fails loudly instead of drawing the wrong thing.
//
// This file is Node-only and lives outside src/, so none of it reaches the
// studio's browser bundle.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Writable } from 'node:stream';
import ts from 'typescript';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── Arguments and spec ──────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const specPath = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!specPath) {
  console.error('usage: node scripts/code2figma/snapshot.mjs <spec.json> [--out <dir>] [--app <dir>] [--state <name>]');
  process.exit(2);
}
const expand = (p) => (p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const specDir = path.dirname(path.resolve(specPath));
const appDir = path.resolve(specDir, expand(flag('app') ?? spec.app));
const outDir = path.resolve(flag('out') ?? path.join(STUDIO, 'code2figma-out', path.basename(appDir)));
const only = flag('state');
fs.mkdirSync(outDir, { recursive: true });

/* Anchored inside node_modules so the hooks treat these requires as library
   code (the app's package.json would count as app source and be redirected). */
const appRequire = createRequire(path.join(appDir, 'node_modules', '.c2f-anchor.js'));
const appSrc = path.join(appDir, path.sep);

// ── Module hooks ────────────────────────────────────────────────────────────

const STAND_IN_URL = 'c2f:components';
const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const ASSET = /\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|webm)(\?.*)?$/i;
const isOwnSource = (file) => (file.startsWith(appSrc) || file.startsWith(path.join(STUDIO, 'src') + path.sep)) && !file.includes(`${path.sep}node_modules${path.sep}`);

function queryOf(url) {
  const i = url ? url.indexOf('?') : -1;
  return i >= 0 ? url.slice(i) : '';
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    /* Only the app's (and the studio's) own source is redirected; the lib and
       everything else in node_modules resolve normally. */
    const fromOwn = !!context.parentURL?.startsWith('file:') && isOwnSource(fileURLToPath(context.parentURL.replace(/\?.*$/, '')));
    if (!fromOwn) return nextResolve(specifier, context);
    /* Each state's query rides on the generated modules too, so every state
       gets its own recorder's stand-ins. */
    const q = queryOf(context.parentURL);
    if (specifier === '@omni-design/components') return { url: STAND_IN_URL + q, shortCircuit: true };
    const icon = /^@omni-design\/icons\/([A-Za-z0-9]+?)(?:Icon)?(?:\.js)?$/.exec(specifier);
    if (icon) return { url: `c2f-icon:${icon[1]}${q}`, shortCircuit: true };
    if (ASSET.test(specifier)) return { url: `c2f-asset:${path.basename(specifier.replace(/\?.*$/, ''))}`, shortCircuit: true };
    const local = specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:');
    if (local) {
      const base = specifier.startsWith('file:') ? fileURLToPath(specifier) : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier.replace(/\?.*$/, ''));
      const candidates = fs.existsSync(base) && fs.statSync(base).isFile() ? [base] : EXTS.map((e) => base + e).filter((f) => fs.existsSync(f));
      if (candidates.length) {
        const file = candidates[0];
        const url = pathToFileURL(file).href + (isOwnSource(file) && file.startsWith(appSrc) ? q : '');
        return { url, shortCircuit: true, format: 'module' };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(STAND_IN_URL)) {
      const r = globalThis.__omniC2F;
      const names = Object.keys(r.exports).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== 'default');
      const src = `const r = globalThis.__omniC2F.exports;\n${names.map((n) => `export const ${n} = r[${JSON.stringify(n)}];`).join('\n')}\nexport default r.default;\n`;
      return { format: 'module', source: src, shortCircuit: true };
    }
    if (url.startsWith('c2f-icon:')) {
      return { format: 'module', source: `export default globalThis.__omniC2F.icon(${JSON.stringify(url.slice(9).replace(/\?.*$/, ''))});`, shortCircuit: true };
    }
    if (url.startsWith('c2f-asset:')) {
      return { format: 'module', source: `export default ${JSON.stringify(url.slice(10))};`, shortCircuit: true };
    }
    if (url.startsWith('file:')) {
      const file = fileURLToPath(url.replace(/\?.*$/, ''));
      if (file.endsWith('.json') && isOwnSource(file)) {
        return { format: 'module', source: `export default ${fs.readFileSync(file, 'utf8')};`, shortCircuit: true };
      }
      if (/\.(jsx|tsx|ts|js|mjs)$/.test(file) && isOwnSource(file)) {
        const source = fs.readFileSync(file, 'utf8');
        const out = ts.transpileModule(source, {
          fileName: file,
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
            esModuleInterop: true, verbatimModuleSyntax: false, isolatedModules: true, sourceMap: false,
          },
        });
        return { format: 'module', source: out.outputText, shortCircuit: true };
      }
    }
    return nextLoad(url, context);
  },
});

// ── The app's React and the recorder ────────────────────────────────────────

const React = appRequire('react');
const ReactDOMServer = appRequire('react-dom/server');
const realLib = appRequire('@omni-design/components');
const { createRecorder, mediaMatches } = await import(pathToFileURL(path.join(STUDIO, 'src/utils/code2figma/record.ts')).href);
const { mapRecorded } = await import(pathToFileURL(path.join(STUDIO, 'src/utils/code2figma/mapper.ts')).href);

function storage(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

function installWindow(state) {
  const viewport = state.viewport;
  const local = storage({ ...(spec.localStorage ?? {}), ...(state.localStorage ?? {}) });
  const session = storage({ ...(spec.sessionStorage ?? {}), ...(state.sessionStorage ?? {}) });
  const url = new URL(state.route, 'http://localhost');
  const noop = () => {};
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  globalThis.window = {
    innerWidth: viewport.width, innerHeight: viewport.height,
    localStorage: local, sessionStorage: session,
    location: { href: url.href, pathname: url.pathname, search: url.search, hash: url.hash, origin: url.origin },
    matchMedia: (q) => ({ matches: mediaMatches(q, viewport, state.mode), media: q, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, onchange: null }),
    addEventListener: noop, removeEventListener: noop, scrollTo: noop, requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    setTimeout, clearTimeout, navigator: { userAgent: 'code2figma' },
  };
}

function renderToString(element) {
  return new Promise((resolve, reject) => {
    let html = '';
    const sink = new Writable({ write(chunk, _enc, cb) { html += chunk.toString(); cb(); } });
    sink.on('finish', () => resolve(html));
    const errors = [];
    const stream = ReactDOMServer.renderToPipeableStream(element, {
      onAllReady() { stream.pipe(sink); },
      onShellError(e) { reject(e); },
      onError(e) { errors.push(e); },
    });
    setTimeout(() => { stream.abort(); }, 15000);
  });
}

// ── States ──────────────────────────────────────────────────────────────────

const defaults = { viewport: { name: 'Desktop', width: 1280, height: 800 }, mode: 'light' };
const states = (spec.states ?? []).filter((s) => !only || s.name === only);
const summary = [];
let n = 0;
for (const raw of states) {
  n += 1;
  const state = {
    ...raw,
    viewport: { ...defaults.viewport, ...(spec.viewport ?? {}), ...(raw.viewport ?? {}) },
    mode: raw.mode ?? spec.mode ?? defaults.mode,
  };
  installWindow(state);
  const recorder = createRecorder(React, realLib, { viewport: state.viewport, mode: state.mode });
  const exportsTable = { ...realLib, ...recorder.standIns, ...recorder.hooks };
  globalThis.__omniC2F = { exports: exportsTable, icon: recorder.icon };

  const q = `?c2f=${n}`;
  const imp = async (rel) => import(pathToFileURL(path.join(appDir, rel)).href + q);
  const entrySpec = raw.entry ?? spec.entry;
  const entryMod = await imp(entrySpec.module);
  const Entry = entryMod[entrySpec.export ?? 'default'];
  let tree = React.createElement(Entry);
  const pattern = raw.routePattern ?? spec.routePattern;
  const routerKind = raw.router ?? spec.router ?? 'memory';
  const rrd = routerKind === 'memory' ? appRequire('react-router-dom') : null;
  if (rrd && pattern) tree = React.createElement(rrd.Routes, null, React.createElement(rrd.Route, { path: pattern, element: tree }));
  for (const w of [...(raw.wrap ?? spec.wrap ?? [])].reverse()) {
    const mod = await imp(w.module);
    tree = React.createElement(mod[w.export ?? 'default'], w.props ?? null, tree);
  }
  if (rrd) tree = React.createElement(rrd.MemoryRouter, { initialEntries: [state.route] }, tree);

  const logs = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...a) => logs.push(['error', a.map(String).join(' ')]);
  console.warn = (...a) => logs.push(['warn', a.map(String).join(' ')]);
  let html;
  try {
    html = await renderToString(tree);
  } finally {
    console.error = origError;
    console.warn = origWarn;
  }
  const recorded = recorder.parse(html);
  const doc = mapRecorded(recorded, {
    app: path.basename(appDir),
    state: { name: state.name, route: state.route, ...(state.description ? { description: state.description } : {}), viewport: state.viewport, mode: state.mode },
  });
  fs.writeFileSync(path.join(outDir, `${state.name}.recorded.json`), JSON.stringify(recorded, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, `${state.name}.ir.json`), JSON.stringify(doc, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, `${state.name}.log`), logs.map(([k, m]) => `${k}: ${m}`).join('\n') + '\n');
  const c = doc.coverage;
  summary.push({ state: state.name, ...c });
}

const totals = summary.reduce((t, s) => {
  for (const k of ['clean', 'lossy', 'needsTable', 'unmapped', 'counted', 'normalized']) t[k] = (t[k] ?? 0) + s[k];
  return t;
}, {});
totals.cleanRatio = totals.counted ? Math.round((totals.clean / totals.counted) * 1000) / 1000 : 0;
totals.cleanRatioStrict = totals.counted ? Math.round(((totals.clean - totals.normalized) / totals.counted) * 1000) / 1000 : 0;
fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify({ app: path.basename(appDir), states: summary, totals }, null, 1) + '\n');

const pct = (x) => `${(x * 100).toFixed(0)}%`;
console.log(`${'state'.padEnd(16)} ${'drawn'.padStart(6)} ${'clean'.padStart(6)} ${'lossy'.padStart(6)} ${'table'.padStart(6)} ${'none'.padStart(6)}  clean%  strict%`);
for (const s of [...summary, { state: 'ALL', ...totals }]) {
  console.log(`${s.state.padEnd(16)} ${String(s.counted).padStart(6)} ${String(s.clean).padStart(6)} ${String(s.lossy).padStart(6)} ${String(s.needsTable).padStart(6)} ${String(s.unmapped).padStart(6)}  ${pct(s.cleanRatio).padStart(6)}  ${pct(s.cleanRatioStrict).padStart(6)}`);
}
console.log(`\nwrote ${outDir}`);
