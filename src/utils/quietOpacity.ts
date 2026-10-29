/**
 * Quiet text as an opacity on Text, rather than a tone of its own.
 *
 * Quiet used to be its own position on the ramp, picked per surface by
 * `findAccessibleTone(..., 4.5)`. That worked but overshot: it landed at
 * 5.0–7.0:1 where 4.5 is the requirement, because a ramp has twelve steps and
 * none of them sits on the line.
 *
 * Compositing Text over its own background at an alpha lands wherever you
 * want. The maths:
 *
 *     C = alpha * Text + (1 - alpha) * Background        (in sRGB bytes)
 *
 * is linear, but relative luminance applies the sRGB transfer curve AFTER it,
 * so contrast is not linear in alpha and there is no closed form. It IS
 * monotonic — as alpha falls, C moves from Text toward Background and the
 * ratio falls toward 1:1 — so a binary search is exact to any precision and
 * fully deterministic.
 *
 * ONE opacity serves every Quiet-* on a surface. Each Text-* in a
 * Theme/Surface is drawn from the same tone of a different palette, so they
 * all start from nearly the same contrast — measured 70.3%–72.8% across the
 * nine palettes on Default/Surface. Taking the MAXIMUM any of them needs puts
 * the whole set at or above 4.5 (worst overshoot measured: 4.84).
 *
 * Emitted differently on each side, deliberately:
 *
 *   Figma   alias + opacity. A variable cannot hold "alias plus modifier" —
 *           `VariableValue` is one RGBA or one pointer — but Figma can bind a
 *           colour's opacity to a FLOAT, which is the same shape Drop-Colors
 *           already uses. Quiet then follows Text automatically.
 *
 *   CSS     the composited solid. An alpha would composite over whatever is
 *           actually behind the text, which may be a Card rather than the
 *           Surface the alpha was computed against — and then the 4.5 floor
 *           silently stops holding. A solid is the same colour wherever it
 *           lands.
 *
 * Both resolve to the same value on the intended ground; the parity test
 * asserts exactly that.
 */

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

/** `fg` at `alpha` over `bg`, composited in sRGB bytes the way a browser does. */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const F = rgbOf(fg), B = rgbOf(bg);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(alpha * F[i] + (1 - alpha) * B[i]))
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Quantised to 1/255 — the precision the composite actually has, since it is
 * computed in 8-bit bytes. Matching `quantizeAlpha` in dropshadow.ts, and for
 * the same reason: the number Figma holds and the colour the CSS paints have
 * to be one value rather than two that round apart.
 */
export function quantizeAlpha(a: number): number {
  return Math.round(Math.round(Math.max(0, Math.min(1, a)) * 255) / 255 * 1000) / 1000;
}

/**
 * The smallest alpha at which `fg` over `bg` still clears `target`.
 *
 * Returns null when the solid already fails: alpha only moves the foreground
 * TOWARD the background, so it can lower contrast and never raise it. A
 * caller that gets null must keep the solid rather than pick something dimmer.
 */
export function alphaForContrast(fg: string, bg: string, target = 4.5): number | null {
  if (contrastRatio(fg, bg) < target) return null;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(compositeOver(fg, bg, mid), bg) >= target) hi = mid; else lo = mid;
  }
  /* Quantising can round DOWN through the threshold, so step back up until it
     clears again. At 1/255 this is at most a couple of steps. */
  let a = quantizeAlpha(hi);
  for (let i = 0; i < 8 && contrastRatio(compositeOver(fg, bg, a), bg) < target; i++) {
    a = quantizeAlpha(a + 1 / 255);
  }
  return a;
}

export interface QuietOpacity {
  /** 0..1, quantised */
  alpha: number;
  /** 0..100, what the Figma float holds — Drop-Colors does the same, because a
   *  number bound to a colour's opacity renders by appending "%" */
  percent: number;
  /** series that had no usable alpha and must keep their solid Text value */
  unsolvable: string[];
  /** the worst ratio any member lands at, for reporting */
  worstRatio: number;
}

/**
 * One opacity for every Quiet-* on a surface: the MAXIMUM any Text-* needs.
 *
 * Taking the max rather than the mean is what makes a shared value safe —
 * every member is then at or above the target, and the cost is a little
 * overshoot on the ones that needed less.
 */
export function quietOpacityFor(
  texts: Record<string, string>,
  background: string,
  target = 4.5,
): QuietOpacity | null {
  const unsolvable: string[] = [];
  let max = 0;
  for (const [name, hex] of Object.entries(texts)) {
    const a = alphaForContrast(hex, background, target);
    if (a === null) { unsolvable.push(name); continue; }
    if (a > max) max = a;
  }
  if (!max) return null;
  let worstRatio = Infinity;
  for (const [name, hex] of Object.entries(texts)) {
    if (unsolvable.includes(name)) continue;
    worstRatio = Math.min(worstRatio, contrastRatio(compositeOver(hex, background, max), background));
  }
  return { alpha: max, percent: Math.round(max * 1000) / 10, unsolvable, worstRatio };
}

/** The eight palettes that are actually painted as a surface.
 *
 * The Text tables carry three more keys and none of them is a ground. `BW` is
 * the black-or-white PICKER — Colors.BW.Color-1 is #ffffff, meaning "use white
 * on tones 1-5" — so pairing Text.Surfaces.BW with Colors.BW measures white on
 * white and reports a contrast failure that does not exist. `BW-Button` is
 * text on a button face, and `Hotlink-Visited` is a link colour with no
 * surface behind it.
 */
export const QUIET_PALETTES = ['Neutral', 'Primary', 'Secondary', 'Tertiary',
                               'Info', 'Success', 'Warning', 'Error'];

export interface QuietTable {
  /** tone (1..12) -> alpha 0..1 */
  alpha: Record<number, number>;
  /** tone (1..12) -> percent 0..100, which is what Figma's float holds */
  percent: Record<number, number>;
  /** anything a caller should surface; empty when all twelve solved cleanly */
  notes: string[];
}

/**
 * Solve one alpha per TONE for a whole mode — the table both sides read.
 *
 * It lives here rather than in either generator because the Figma payload and
 * the CSS export have to paint the same colour (invariant 5: the two are
 * separate implementations and diverge in silence). Figma binds the alpha to
 * an alias; CSS composites it to a solid. Same number, two shapes.
 *
 * A tone's value is the MAXIMUM any of the eight palettes needs, measured on
 * both grounds — Color-N for a surface, Container-Highest for a container —
 * and then verified against every palette before it is kept. Tones at the same
 * index share a lightness by construction, so the spread is small and the
 * overshoot stays under half a point.
 *
 * `toHex` resolves a token, which is usually an ALIAS rather than a literal:
 * Text.Surfaces.Primary.Color-1 is `{Colors.Primary.Color-9}`. Each caller
 * passes its own resolver because the two generators already have one.
 */
export function solveQuietOpacities(
  modeData: any,
  toHex: (raw: any) => string | null,
  target = 4.5,
): QuietTable {
  const alpha: Record<number, number> = {};
  const percent: Record<number, number> = {};
  const notes: string[] = [];

  const groundFor = (branch: string, palette: string, n: number): string | null =>
    branch === 'Surfaces'
      ? toHex(modeData?.Colors?.[palette]?.[`Color-${n}`])
      : toHex(modeData?.Backgrounds?.[palette]?.[`Background-${n}`]
          ?.Containers?.['Container-Highest']);

  for (let n = 1; n <= 12; n++) {
    const key = `Color-${n}`;
    let max = 0;
    let considered = 0, noText = 0, noGround = 0;
    const failed: string[] = [];

    for (const branch of ['Surfaces', 'Containers']) {
      const texts = modeData?.Text?.[branch];
      if (!texts) continue;
      for (const palette of QUIET_PALETTES) {
        if (!texts[palette]) continue;
        considered++;
        const textHex = toHex(texts[palette]?.[key]);
        const bgHex = groundFor(branch, palette, n);
        if (!textHex) { noText++; continue; }
        if (!bgHex) { noGround++; continue; }
        const a = alphaForContrast(textHex, bgHex, target);
        /* null means the SOLID already fails — an alpha cannot rescue it, and
           skipping in silence would hide a real failure in the Text table. */
        if (a === null) { failed.push(`${branch}/${palette}/${key}`); continue; }
        if (a > max) max = a;
      }
    }

    if (failed.length)
      notes.push(`solid Text already fails ${target}:1 on ${failed.join(', ')} — ` +
                 'no opacity can fix that.');
    if (!max) {
      notes.push(`${key}: nothing emitted. ${considered} pair(s) considered, ` +
                 `${noText} with no Text hex, ${noGround} with no ground, ` +
                 `${failed.length} already failing ${target}:1.`);
      continue;
    }

    /* Verify the shared max against every palette on BOTH grounds. */
    const short: string[] = [];
    for (const branch of ['Surfaces', 'Containers']) {
      const texts = modeData?.Text?.[branch];
      if (!texts) continue;
      for (const palette of QUIET_PALETTES) {
        if (!texts[palette]) continue;
        const textHex = toHex(texts[palette]?.[key]);
        const bgHex = groundFor(branch, palette, n);
        if (!textHex || !bgHex) continue;
        if (contrastRatio(compositeOver(textHex, bgHex, max), bgHex) < target)
          short.push(`${branch}/${palette}/${key}`);
      }
    }
    if (short.length) {
      notes.push(`a shared ${(max * 100).toFixed(1)}% leaves ${short.join(', ')} ` +
                 `under ${target}:1 — that tone needs its own value.`);
      continue;
    }

    alpha[n] = max;
    percent[n] = Math.round(max * 1000) / 10;
  }

  return { alpha, percent, notes };
}

/** The modes sectionQuietOverrides is applied in (CSS export and Figma
 *  payload both read this). Dark only for now — see exportToCSS quietSolid. */
export const QUIET_SECTION_FIX_MODES: readonly string[] = ['Dark-Mode'];

export interface SectionQuietOverride {
  theme: string;
  /** the theme section's key, e.g. 'Surfaces-Brightest' */
  section: string;
  /** the section object itself, so a caller walking the same tree can key on it */
  node: any;
  tone: number;
  /** the tone's shared alpha, which this section could not use */
  tableAlpha: number;
  alpha: number;
  percent: number;
  /** the worst Quiet ratio the shared alpha gave this section */
  worstBefore: number;
}

/**
 * Sections whose Quiet the shared per-tone alpha leaves under `target`, and
 * the smallest alpha that clears every Quiet-* in each.
 *
 * Why the shared table can miss: solveQuietOpacities measures each palette's
 * OWN Text on its own ground (Text.Surfaces.Error.Color-11 on Error Color-11).
 * A themed section paints the THEME's Text instead — the Neutral text table —
 * on that ground, so its composite can land a hair short even though every
 * pairing the table measured passed. Measured: dark Error / Surface-Brightest,
 * Neutral text on Error Color-11, 4.47-4.50:1.
 *
 * Scoped on purpose. Only a section that actually fails gets a value of its
 * own; every passing section keeps the shared tone alpha, untouched. The
 * replacement is the same kind of answer the table gives — the smallest
 * opacity of the section's own Text that reaches the target (a narrow pass is
 * a pass) — so Quiet still follows Text, in CSS as a solid and in Figma as an
 * alias at that opacity.
 *
 * `toneOf` returns the tone a section's Quiet-Opacity points at (each caller
 * resolves references its own way), or null when it is not a tone reference.
 */
export function sectionQuietOverrides(
  modeData: any,
  table: QuietTable,
  toHex: (raw: any) => string | null,
  toneOf: (section: any) => number | null,
  target = 4.5,
): SectionQuietOverride[] {
  const out: SectionQuietOverride[] = [];
  for (const [theme, themeNode] of Object.entries<any>(modeData?.Themes || {})) {
    if (!themeNode || typeof themeNode !== 'object') continue;
    for (const [section, node] of Object.entries<any>(themeNode)) {
      if (!node || typeof node !== 'object' || !('Background' in node) || !('Quiet-Opacity' in node)) continue;
      const tone = toneOf(node);
      const tableAlpha = tone === null ? undefined : table.alpha[tone];
      if (tone === null || tableAlpha === undefined) continue;
      const bg = toHex(node.Background);
      if (!bg) continue;
      const texts: Record<string, string> = {};
      for (const key of ['Text', ...QUIET_PALETTES.map((p) => `Text-${p}`)]) {
        const hex = node[key] ? toHex(node[key]) : null;
        if (hex) texts[key] = hex;
      }
      let worstBefore = Infinity;
      for (const hex of Object.values(texts)) {
        // A solid that already fails is a Text-table problem no opacity can fix.
        if (contrastRatio(hex, bg) < target) continue;
        worstBefore = Math.min(worstBefore, contrastRatio(compositeOver(hex, bg, tableAlpha), bg));
      }
      if (!(worstBefore < target)) continue;
      const solved = quietOpacityFor(texts, bg, target);
      if (!solved || solved.alpha <= tableAlpha) continue;
      out.push({ theme, section, node, tone, tableAlpha, alpha: solved.alpha, percent: solved.percent, worstBefore });
    }
  }
  return out;
}
