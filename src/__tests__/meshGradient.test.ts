import { describe, it, expect } from 'vitest';
import { parseMeshGradient, generateMeshGradientCSS } from '../utils/meshGradient';
import { SEED_MESH_GRADIENTS } from '../data/meshGradients';

/** The Popsicle mesh, exactly as pasted from dev tools. */
const PASTED = `.gradient-figure {
  position: relative;
  width: 800px;
  height: 450px;
  max-width: 100%;
  background: radial-gradient(circle at 20% 30%, var(--Primary-Color-7) 0%, transparent 50%), radial-gradient(circle at 78% 64%, var(--Secondary-Color-7) 0%, transparent 45%), radial-gradient(circle at 30% 18%, var(--Primary-Color-9) 0%, transparent 45%), radial-gradient(circle at 21% 50%, var(--Tertiary-Color-6) 0%, transparent 45%), radial-gradient(circle at 0% 0%, var(--Primary-Color-9) 0%, transparent 45%), var(--Primary-Color-7);
  color: var(--BW-Color-6);
}`;

describe('parsing an authored mesh', () => {
  it('takes the background and colour out of a pasted rule', () => {
    const m = parseMeshGradient(PASTED)!;
    expect(m.background.startsWith('radial-gradient(circle at 20% 30%')).toBe(true);
    // the base colour after the last stack layer must survive
    expect(m.background.endsWith('var(--Primary-Color-7)')).toBe(true);
    expect(m.color).toBe('var(--BW-Color-6)');
  });

  it('keeps all five gradient layers', () => {
    const m = parseMeshGradient(PASTED)!;
    expect((m.background.match(/radial-gradient\(/g) || []).length).toBe(5);
  });

  it('never swallows the closing brace or the sizing declarations', () => {
    const m = parseMeshGradient(PASTED)!;
    // A stray brace or a leaked `position:` invalidates the whole declaration,
    // and CSS drops an invalid property silently — it paints nothing and says
    // nothing, which is why this is asserted rather than eyeballed.
    expect(m.background).not.toContain('}');
    expect(m.background).not.toMatch(/position|width|height/);
  });

  it('accepts a bare background value too', () => {
    const m = parseMeshGradient('radial-gradient(circle at 0 0, red 0%, transparent 50%), blue')!;
    expect(m.background).toContain('radial-gradient');
    expect(m.color).toBeUndefined();
  });

  it('returns null rather than an empty mesh', () => {
    expect(parseMeshGradient('')).toBeNull();
    expect(parseMeshGradient('   ')).toBeNull();
  });
});

describe('the CSS a system publishes', () => {
  const css = generateMeshGradientCSS(parseMeshGradient(PASTED)!);

  it('declares the stack once and has every consumer read it', () => {
    expect((css.match(/radial-gradient\(circle at 20% 30%/g) || []).length).toBe(1);
    for (const sel of ['.mesh-gradient', '.gradient-figure', '.hero-mesh']) {
      expect(css).toContain(sel);
    }
    // The hero and the card must resolve the SAME value, not two copies.
    expect((css.match(/background: var\(--Mesh-Gradient\)/g) || []).length).toBe(1);
  });

  it('keeps the card sizing off the shared rule', () => {
    // A hero is full-bleed; baking 800x450 into the shared selector would make
    // every consumer a fixed-size box.
    const shared = css.slice(css.indexOf('.mesh-gradient'), css.indexOf('.gradient-figure {'));
    expect(shared).not.toContain('800px');
  });

  it('uses the system type roles rather than the pasted font names', () => {
    expect(css).toContain('var(--Font-Family-Eyebrow)');
    expect(css).toContain('var(--Font-Family-Header)');
    expect(css).not.toContain('Righteous');
    expect(css).not.toContain('Google Sans Flex');
  });
});

/** Surf's Up: three layers, and pasted as the FULL block including the text
 *  and font rules — a different shape from Popsicle's, which is the point. */
const SURFS_UP = `.gradient-figure {
  position: relative;
  width: 800px;
  height: 450px;
  max-width: 100%;
  background: radial-gradient(circle at 20% 30%, var(--Neutral-Color-12) 0%, transparent 50%), radial-gradient(circle at 80% 31%, var(--Secondary-Color-9) 0%, transparent 45%), radial-gradient(circle at 0% 23%, var(--Tertiary-Color-7) 0%, transparent 45%), var(--Neutral-Color-12);
  color: var(--BW-Color-6);
}
.gradient-figure .gradient-text {
  position: absolute;
  left: 6.00%; top: 49.33%;
  width: 65.63%; height: 40.00%;
  display: flex; flex-direction: column; gap: 8px;
  align-items: flex-start;
  justify-content: flex-end;
  text-align: left;
}
.gradient-figure .t-eyebrow { margin: 0; font-family: 'Anton', sans-serif; font-size: 18px; font-weight: 400; line-height: 1.5; }
.gradient-figure .t-title { margin: 0; font-family: 'Google Sans Flex', sans-serif; font-size: 40px; font-weight: 400; line-height: 1.2; }`;

describe('a second system, pasted as the whole block', () => {
  const m = parseMeshGradient(SURFS_UP)!;

  it('takes only the figure rule, not the ones after it', () => {
    expect((m.background.match(/radial-gradient\(/g) || []).length).toBe(3);
    expect(m.background.endsWith('var(--Neutral-Color-12)')).toBe(true);
    expect(m.color).toBe('var(--BW-Color-6)');
  });

  it('does not pick up the text layout or the font rules', () => {
    // `color` must not match inside `background-color`, and nothing from the
    // .gradient-text / .t-eyebrow rules may leak into the stored value.
    expect(m.background).not.toMatch(/position|display|font-family|Anton/);
    expect(m.color).not.toMatch(/flex|column/);
  });

  it('produces a mesh distinct from the other system', () => {
    const popsicle = parseMeshGradient(PASTED)!;
    expect(m.background).not.toBe(popsicle.background);
    // Authored, not derived: same slot, different stops and different tokens.
    expect(m.background).toContain('--Neutral-Color-12');
    expect(popsicle.background).toContain('--Primary-Color-7');
  });
});

describe('the seeded meshes match what was authored', () => {
  // The seed is transcribed from pasted CSS by hand, which is exactly the step
  // where a stop position or a token name gets mistyped — and a wrong stop
  // still renders a perfectly plausible gradient. Parsing the original rule
  // and comparing is the only check that catches it.
  const cases: Array<[string, string]> = [
    ['d7ad345c-33d7-43f6-8f30-41728bf395e6', PASTED],
    ['a2d6e6cf-d16a-4a6b-b4f6-8d4c282fb4f2', SURFS_UP],
  ];

  it('round-trips each pasted rule into its seed entry', () => {
    for (const [id, css] of cases) {
      const parsed = parseMeshGradient(css)!;
      const seeded = SEED_MESH_GRADIENTS[id];
      expect(seeded, `no seed for ${id}`).toBeDefined();
      // Whitespace differs (the seed is wrapped across lines); the value must not.
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      expect(norm(seeded.background), id).toBe(norm(parsed.background));
      expect(seeded.color, id).toBe(parsed.color);
    }
  });

  it('gives every seeded system a distinct mesh', () => {
    const backgrounds = Object.values(SEED_MESH_GRADIENTS).map((m) => m.background);
    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });

  it('keeps every seed on tokens, never a hex', () => {
    for (const [id, m] of Object.entries(SEED_MESH_GRADIENTS)) {
      expect(m.background, id).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(m.color, id).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
});
