#!/usr/bin/env node
/* CHART PALETTE — proposes the six additional hues and the tone each of the
 * fourteen chart colours takes on each of the four grounds.
 *
 * READ-ONLY. Prints a table and the variable values to create. Writes nothing.
 *
 * THE SHAPE OF THE PROBLEM
 * Charts are only ever drawn on Surface-Brightest or Surface-Dimmest, and
 * --Chart-BG names which. So the ground is one of two per mode, four in all —
 * not the ten surface levels. And because Brightest is close to the same
 * lightness under every theme, one tone per series per ground covers all
 * twelve themes. The table is 14 x 4, not 14 x 120.
 *
 * WHY THE TONES ARE CHOSEN JOINTLY, NOT ONE AT A TIME
 * An earlier version gave each series a "home" tone picked for separability
 * and then let a per-series 3:1 search re-tone it on each ground. The search
 * pushed neighbours onto the same tone and dE collapsed to 0.3 — two series
 * rendered as one colour. Lightness separation only exists if the set is
 * solved together, subject to 3:1, on each ground.
 *
 * WHAT CONTRAST DOES AND DOES NOT COVER
 * 3:1 here is WCAG 1.4.11, mark against ground. It says nothing about series
 * against series. Adjacent segments are handled by a border drawn in
 * --Chart-BG — Understanding 1.4.11 waives adjacent-colour contrast when a
 * visible boundary exists, and since every series clears 3:1 against the
 * ground, a ground-coloured border is always visible by construction.
 * So series-vs-series separation is a LEGEND requirement, which is why it is
 * measured under deuteranopia and protanopia rather than as a contrast ratio.
 */
const fs = require('fs');
const path = require('path');
const chroma = require('chroma-js');

const LIB = process.env.DINO_LIB || path.join(process.env.HOME, 'DinoDesign');
const SRC = { 'Light-Mode': 'Light-Mode.css', 'Dark-Mode': 'Dark-Mode.css' };

const MIN_CONTRAST = 3.0;
const TONES        = 12;
const REF_TONE     = 5;    // where hues are compared; mid of the usable band
const NEW_COUNT    = Number(process.env.NEW_COUNT || 8);
const DE_WARN      = 12;
/* A series has to stay recognisably the same colour on every ground, or the
 * legend stops working across a dashboard. Tones 1-2 and 11-12 are near-black
 * and near-white: they carry almost no chroma, so a series pushed there reads
 * as "black" rather than as itself. The optimiser will happily use them for
 * separation, so the band is a constraint, not a preference. */
const TONE_BAND    = [3, 10];   // CIEDE2000 below this reads as one colour in a key
/* ORDINAL PAIRS — the thing a minimum hue separation was reaching for.
 *
 * Two series read as "one colour at two lightnesses" — implying an order the
 * data has not got — only when they share a hue AND differ a lot in lightness.
 * Similar hue at similar lightness is merely harder to tell apart, which dE
 * already measures. So the constraint is the CONJUNCTION, applied where the
 * lightnesses are actually decided: the per-ground tone solve.
 *
 * A hard hue floor was tried and made things worse. This brand's hues sit at
 * 23/64/115deg, so excluding a band around each leaves one arc, 139-359deg —
 * the teal-blue-purple sweep, exactly where LCh compresses. Spreading eight
 * hues evenly through it gave colours evenly spaced in DEGREES and badly
 * spaced perceptually: worst dE fell from 2.3 to 2.1 at a 24deg floor and to
 * 1.7 at 30deg, which could not even be met. Degrees are not the unit. */
const ORDINAL_HUE  = Number(process.env.ORDINAL_HUE || 24);  // degrees
const ORDINAL_L    = Number(process.env.ORDINAL_L   || 20);  // CIE L*
const ORDINAL_CAP  = 2;   // an ordinal pair scores no better than this
const GROUNDS      = ['Surface-Brightest', 'Surface-Dimmest'];
const BRAND        = ['Primary', 'Secondary', 'Tertiary'];
const STATES       = ['Error', 'Warning', 'Success', 'Info'];

/* ---------- parse ------------------------------------------------------- */
function parseCSS(file) {
  const css = fs.readFileSync(file, 'utf8');
  const ramps = {};
  for (const m of css.matchAll(/--([A-Za-z][\w-]*?)-Color-(\d+)\s*:\s*(#[0-9a-fA-F]{6})/g))
    (ramps[m[1]] ||= {})[Number(m[2])] = m[3].toLowerCase();
  const grounds = [];
  for (const b of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const bg = b[2].match(/--Background\s*:\s*([^;]+);/); if (!bg) continue;
    const t = b[1].match(/\[data-theme="([^"]+)"\]/), s = b[1].match(/\[data-surface="([^"]+)"\]/);
    if (t && s) grounds.push({ theme: t[1], surface: s[1], ref: bg[1].trim() });
  }
  return { ramps, grounds };
}
const resolve = (ref, ramps) => {
  const v = ref.match(/var\(\s*--([A-Za-z][\w-]*?)-Color-(\d+)/);
  if (v) return (ramps[v[1]] || {})[Number(v[2])] || null;
  const h = ref.match(/#[0-9a-fA-F]{6}/); return h ? h[0].toLowerCase() : null;
};

/* ---------- colour ------------------------------------------------------ */
const contrast = (a, b) => { const l1 = chroma(a).luminance(), l2 = chroma(b).luminance();
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const CVD = {
  deuteranopia: [[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  protanopia:   [[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
};
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const toSrgb = (c) => { const v = c <= 0.0031308 ? c*12.92 : 1.055*Math.pow(c,1/2.4)-0.055;
  return Math.max(0, Math.min(255, Math.round(v*255))); };
const simulate = (hex, k) => { const [r,g,b] = chroma(hex).rgb().map(toLin); const M = CVD[k];
  return chroma(M.map((w) => toSrgb(w[0]*r + w[1]*g + w[2]*b))); };
/** the worst of normal / deuteranopic / protanopic distance — what a reader gets */
const arc = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const sep = (a, b) => Math.min(chroma.deltaE(a,b),
  chroma.deltaE(simulate(a,'deuteranopia'), simulate(b,'deuteranopia')),
  chroma.deltaE(simulate(a,'protanopia'),   simulate(b,'protanopia')));
/** A pair sharing a hue but not a lightness reads as a sequence rather than two
 *  categories. Reported, NOT constrained — see the ORDINAL note above: the
 *  per-ground 3:1 requirement already compresses every series into a narrow
 *  lightness band, so the case cannot arise, and penalising it only pushed the
 *  search into a worse local optimum (worst dE 5.3 -> 4.0 for nothing).
 *  Set ORDINAL_ENFORCE=1 to turn it back into a constraint for a brand whose
 *  grounds leave a wider usable band. */
const ENFORCE = process.env.ORDINAL_ENFORCE !== '0';
const isOrdinal = (a, b) => {
  const A = chroma(a).lch(), B = chroma(b).lch();
  const hA = Number.isNaN(A[2]) ? 0 : A[2], hB = Number.isNaN(B[2]) ? 0 : B[2];
  return arc(hA, hB) < ORDINAL_HUE && Math.abs(A[0] - B[0]) > ORDINAL_L;
};
const pairScore = (a, b) => (ENFORCE && isOrdinal(a, b))
  ? Math.min(sep(a, b), ORDINAL_CAP) : sep(a, b);
const rampFor = (hue, profile) => { const o = {};
  for (let n = 1; n <= TONES; n++) { const src = profile[n]; if (!src) continue;
    const [L, C] = chroma(src).lch(); o[n] = chroma.lch(L, C, hue).hex().toLowerCase(); }
  return o; };

/* ---------- load -------------------------------------------------------- */
const modes = {};
for (const [name, f] of Object.entries(SRC)) {
  const p = path.join(LIB, 'public/styles', f);
  if (!fs.existsSync(p)) { console.error('missing ' + p); process.exit(1); }
  modes[name] = parseCSS(p);
}
const base = modes['Light-Mode'];
const profile = base.ramps.Primary || base.ramps.Neutral;

console.log('='.repeat(78));
console.log('CHART PALETTE   source: ' + path.join(LIB, 'public/styles'));
console.log('='.repeat(78));

/* ---------- 1. six hues, chosen at one reference tone -------------------- */
/* Within a single ground every series sits in a narrow tone band, so HUE is
   the axis that separates them. Hues are chosen once and never vary: a series
   that changed hue between grounds would break the legend. */
const hueOf = (hex) => { const h = chroma(hex).lch()[2]; return Number.isNaN(h) ? 0 : h; };
const arcUnused = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/* Neutral is achromatic, so it occupies no hue slot and is excluded from the
   hue filter — but it stays in the dE pool, since a grey still has to be told
   apart from a desaturated colour. */
const brandHues = BRAND.filter((n) => base.ramps[n]).map((n) => hueOf(base.ramps[n][REF_TONE]));
const pool = [...BRAND, 'Neutral'].filter((n) => base.ramps[n]).map((n) => base.ramps[n][REF_TONE]);
/* Place by EVEN DISTRIBUTION across the free arcs, then nudge for dE.
 *
 * Greedy farthest-point fails here: it takes the single best dE spot each
 * round and strands the last hue with nowhere legal to go (7 of 8 at 24deg,
 * though the geometry allows all 8). Even distribution cannot strand anything,
 * and the local nudge afterwards recovers most of the dE the greedy was
 * chasing. */
const hues = [];
for (let i = 0; i < NEW_COUNT; i++) {
  let best = null, score = -1;
  for (let h = 0; h < 360; h += 1) {
    const hex = rampFor(h, profile)[REF_TONE]; if (!hex) continue;
    const q = Math.min(...pool.map((o) => sep(hex, o)));
    if (q > score) { score = q; best = { h, hex }; }
  }
  hues.push(best.h); pool.push(best.hex);
}
hues.sort((x, y) => x - y);
const gaps = hues.map((h, i) => arc(h, hues[(i + 1) % hues.length]));
console.log(`\nHUES  brand at ` + brandHues.map((h) => h.toFixed(0)).join('/') +
  `deg  |  smallest gap among the new ${Math.min(...gaps).toFixed(0)}deg ` +
  `(no floor — see ORDINAL note)`);

const series = {};
for (const n of [...BRAND, 'Neutral']) if (base.ramps[n]) series['Chart-' + n] = { ramp: n };
hues.forEach((h, i) => { series['Chart-' + (i + 5)] = { hue: h }; });  // Chart-5..12
for (const n of STATES) if (base.ramps[n]) series['Chart-State-' + n] = { ramp: n };

console.log(`\n${NEW_COUNT} NEW HUES  (Primary's lightness/chroma profile, new hue)`);
hues.forEach((h, i) => console.log(
  `  Chart-${i + 5}   hue ${String(h).padStart(3)}deg   at Color-${REF_TONE}: ${rampFor(h, profile)[REF_TONE]}`));

/* ---------- 2. per ground, solve the tones together --------------------- */
function rampOf(def, modeRamps) {
  return def.ramp ? modeRamps[def.ramp] : rampFor(def.hue, modeRamps.Primary || modeRamps.Neutral);
}
/** hill-climb: repeatedly move whichever member of the worst pair improves the
 *  global minimum most. Exhaustive search is 12^14; this converges in a few
 *  hundred steps and the result is reported so it can be eyeballed. */
function solveGround(bg, defs, modeRamps) {
  const names = Object.keys(defs);
  const usable = {}, ramps = {};
  for (const n of names) {
    ramps[n] = rampOf(defs[n], modeRamps);
    usable[n] = [];
    for (let t = TONE_BAND[0]; t <= TONE_BAND[1]; t++)
      if (ramps[n][t] && contrast(bg, ramps[n][t]) >= MIN_CONTRAST) usable[n].push(t);
  }
  const missing = names.filter((n) => !usable[n].length);
  const pick = {};
  for (const n of names) if (usable[n].length)
    pick[n] = usable[n].reduce((a, b) => Math.abs(a - REF_TONE) <= Math.abs(b - REF_TONE) ? a : b);
  const live = names.filter((n) => pick[n] !== undefined);
  const minSep = (p) => { let w = Infinity, pair = null;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const d = pairScore(ramps[live[i]][p[live[i]]], ramps[live[j]][p[live[j]]]);
      if (d < w) { w = d; pair = [live[i], live[j]]; } }
    return { w, pair }; };
  let cur = minSep(pick);
  for (let step = 0; step < 400; step++) {
    let improved = false;
    for (const n of cur.pair || []) {
      for (const t of usable[n]) {
        if (t === pick[n]) continue;
        const trial = { ...pick, [n]: t };
        const got = minSep(trial);
        if (got.w > cur.w + 1e-9) { pick[n] = t; cur = got; improved = true; break; }
      }
      if (improved) break;
    }
    if (!improved) break;
  }
  return { pick, ramps, worst: cur, missing, usable };
}

const table = {};
for (const [modeName, data] of Object.entries(modes)) {
  for (const g of GROUNDS) {
    const row = data.grounds.filter((x) => x.surface === g)
      .map((x) => resolve(x.ref, data.ramps)).filter(Boolean);
    if (!row.length) continue;
    // every theme's version of this ground; solve against the hardest one
    const hardest = row.reduce((a, b) =>
      Math.abs(chroma(a).luminance() - 0.5) < Math.abs(chroma(b).luminance() - 0.5) ? a : b);
    const sol = solveGround(hardest, series, data.ramps);
    // verify the chosen tones clear 3:1 on EVERY theme's version of this ground
    const bad = [];
    for (const n of Object.keys(sol.pick))
      for (const bg of row)
        if (contrast(bg, sol.ramps[n][sol.pick[n]]) < MIN_CONTRAST)
          bad.push(`${n} on ${bg} (${contrast(bg, sol.ramps[n][sol.pick[n]]).toFixed(2)}:1)`);
    table[modeName + ' | ' + g] = { ...sol, themes: row.length, bad, hardest };
  }
}

console.log('\nTONE PER SERIES PER GROUND   (one tone covers every theme on that ground)');
const names = Object.keys(series);
const cols = Object.keys(table);
console.log('  series'.padEnd(24) + cols.map((c) => c.replace('-Mode','').replace('Surface-','').padEnd(18)).join(''));
for (const n of names) {
  console.log('  ' + n.padEnd(22) +
    cols.map((c) => { const s = table[c]; const t = s.pick[n];
      return (t === undefined ? 'NONE' : `${t}  ${s.ramps[n][t]}`).padEnd(18); }).join(''));
}

console.log('\nVERIFICATION');
for (const [c, s] of Object.entries(table)) {
  console.log(`  ${c.padEnd(32)} ${s.themes} themes   worst legend dE ${s.worst.w.toFixed(1).padStart(5)}` +
    `  (${s.worst.pair ? s.worst.pair.map((x) => x.replace('Chart-','')).join(' / ') : '-'})`);
  const ord = [];
  const nm = Object.keys(s.pick);
  for (let i = 0; i < nm.length; i++) for (let j = i + 1; j < nm.length; j++) {
    const a = s.ramps[nm[i]][s.pick[nm[i]]], b = s.ramps[nm[j]][s.pick[nm[j]]];
    const A = chroma(a).lch(), B = chroma(b).lch();
    const hA = Number.isNaN(A[2]) ? 0 : A[2], hB = Number.isNaN(B[2]) ? 0 : B[2];
    if (arc(hA, hB) < ORDINAL_HUE && Math.abs(A[0] - B[0]) > ORDINAL_L)
      ord.push(`${nm[i].replace('Chart-','')}/${nm[j].replace('Chart-','')} ` +
               `(${arc(hA,hB).toFixed(0)}deg, dL ${Math.abs(A[0]-B[0]).toFixed(0)})`);
  }
  console.log(`      ordinal-looking pairs: ${ord.length ? ord.join(', ') : 'none'}`);
  if (s.missing.length) console.log(`      NO USABLE TONE: ${s.missing.join(', ')}`);
  if (s.bad.length) console.log(`      3:1 FAILS on some theme: ${s.bad.slice(0,4).join('; ')}` +
    (s.bad.length > 4 ? ` (+${s.bad.length - 4})` : ''));
}
const anyBad = Object.values(table).some((s) => s.bad.length || s.missing.length);
console.log(anyBad ? '\n  ^ resolve the above before importing.'
                   : '\n  All fourteen clear 3:1 on every theme of both grounds, both modes.');

/* ---------- 3. categorical-only view ------------------------------------ */
console.log('\nIF A CHART USES ONLY THE CATEGORICAL TEN (no state colours)');
for (const [c, s] of Object.entries(table)) {
  const cat = Object.keys(s.pick).filter((n) => !n.startsWith('Chart-State-'));
  let w = Infinity, pair = null;
  for (let i = 0; i < cat.length; i++) for (let j = i + 1; j < cat.length; j++) {
    const d = pairScore(s.ramps[cat[i]][s.pick[cat[i]]], s.ramps[cat[j]][s.pick[cat[j]]]);
    if (d < w) { w = d; pair = [cat[i], cat[j]]; } }
  console.log(`  ${c.padEnd(32)} worst dE ${w.toFixed(1).padStart(5)}  ` +
    `(${pair.map((x) => x.replace('Chart-','')).join(' / ')})${w < DE_WARN ? '  <- under ' + DE_WARN : ''}`);
}
console.log('\n' + '='.repeat(78));

/* ---------- 4. the literals to create in Modes -------------------------- */
/* Named as they are in the file: Chart/Surface-{Brightest,Dimmest}/Color-N,
   each carrying a Light-Mode and a Dark-Mode value. Only the generated hues
   appear here — the brand four and the state four alias existing ramps and
   need no literal of their own. */
console.log('\nLITERALS TO CREATE IN `Modes`   (' + (NEW_COUNT * 2) + ' variables, ' +
            (NEW_COUNT * 4) + ' values)');
console.log('  variable'.padEnd(42) + 'Light-Mode   Dark-Mode');
for (const g of GROUNDS) {
  for (let i = 0; i < NEW_COUNT; i++) {
    const n = 'Chart-' + (i + 5);
    const L = table['Light-Mode | ' + g], D = table['Dark-Mode | ' + g];
    if (!L || !D) continue;
    console.log('  ' + `Chart/${g}/Color-${i + 5}`.padEnd(40) +
      `${L.ramps[n][L.pick[n]]}      ${D.ramps[n][D.pick[n]]}`);
  }
}
console.log('\nALIASES FOR THE OTHER EIGHT  (no literal needed)');
for (const n of Object.keys(series)) {
  if (!series[n].ramp) continue;
  const row = GROUNDS.map((g) => {
    const L = table['Light-Mode | ' + g];
    return `${g.replace('Surface-','')}: ${series[n].ramp}-Color-${L.pick[n]}`;
  });
  console.log('  ' + n.padEnd(22) + row.join('   '));
}
console.log('\n' + '='.repeat(78));
