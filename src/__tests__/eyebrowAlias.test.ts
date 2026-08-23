import { describe, it, expect } from 'vitest';
import { typographyDeclarations } from '../utils/cssgen/generateTypographyTokensCSS';

const css = () => typographyDeclarations([
  { type: 'Display', family: 'Anton', weight: '400', letterSpacing: '0em' },
  { type: 'Header', family: 'Google Sans Flex', weight: '600', letterSpacing: '0em' },
  { type: 'Body', family: 'Poppins', weight: '400', letterSpacing: '0em' },
] as any);

describe('Eyebrow / Overline aliasing', () => {
  it('emits the Eyebrow names', () => {
    const out = css();
    for (const step of ['Small', 'Medium', 'Large']) {
      expect(out, `missing --Eyebrow-${step}-Font-Size`).toContain(`--Eyebrow-${step}-Font-Size`);
      expect(out).toContain(`--Eyebrow-${step}-Letter-Spacing`);
      expect(out).toContain(`--Eyebrow-${step}-Text-Transform`);
    }
  });

  it('KEEPS the Overline names', () => {
    // Removing these would break every design system already published: their
    // CSS is frozen in Storage and cannot be regenerated, and the lib's
    // component is still called Overline.
    const out = css();
    for (const step of ['Small', 'Medium', 'Large']) {
      expect(out, `dropped --Overline-${step}-Font-Size`).toContain(`--Overline-${step}-Font-Size`);
    }
  });

  it('aliases by reference, so the two names cannot drift', () => {
    // One literal, one name that reads it — two literals for one number is how
    // they diverge.
    //
    // DIRECTION MATTERS, and it is Overline -> Eyebrow. Eyebrow is the name now;
    // Overline is the back-compat one, so Overline is what does the reading. An
    // earlier version of this test asserted the reverse, from before the rename,
    // and stayed red rather than wrong-but-passing only because the value is a
    // var() reference either way.
    expect(css()).toContain('--Overline-Medium-Font-Size: var(--Eyebrow-Medium-Font-Size);');
    // and NOT the other way round, which would make Overline canonical again
    expect(css()).not.toContain('--Eyebrow-Medium-Font-Size: var(--Overline-Medium-Font-Size);');
  });

  it('does not alias non-Overline styles', () => {
    const out = css();
    expect(out).not.toContain('--Eyebrow-H1');
    expect(out).not.toContain('--Eyebrow-Display');
  });

  it('leaves the Eyebrow FACE tokens alone', () => {
    // --Font-Family-Eyebrow / --Font-Weight-Eyebrow are the colour-and-face
    // role and already exist; the alias must not collide with them.
    const out = css();
    expect(out).not.toContain('--Eyebrow-Font-Size');
  });
});

describe('Eyebrow tracking ramp', () => {
  // Direction is the rule: an eyebrow is set in caps, and tight spacing is what
  // makes small caps hard to read, so tracking must DECREASE as the type grows.
  // Retuning one step in isolation broke this once — Small went to 0.06 while
  // Medium stayed at 0.10, leaving the middle step airier than the smallest and
  // the three no longer reading as a scale.
  it('loosens as the type gets smaller', () => {
    const out = css();
    const em = (step: string) => {
      const m = out.match(new RegExp(`--Eyebrow-${step}-Letter-Spacing:\\s*([\\d.]+)em;`));
      return m ? Number(m[1]) : NaN;
    };
    const [s, m, l] = [em('Small'), em('Medium'), em('Large')];
    expect([s, m, l].every(Number.isFinite), 'all three steps must emit a value').toBe(true);
    expect(s, `Small (${s}) must track wider than Medium (${m})`).toBeGreaterThan(m);
    expect(m, `Medium (${m}) must track wider than Large (${l})`).toBeGreaterThan(l);
  });
});
