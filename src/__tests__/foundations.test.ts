/**
 * Foundations are the facts that are not about any one component, and each
 * section exists to prevent a specific mistake. The tests assert the mistake is
 * named — a section with no trap has not earned its place.
 */
import { describe, it, expect } from 'vitest';
import { FOUNDATIONS, renderFoundations } from '../utils/docs/foundations';

const section = (t: string) => FOUNDATIONS.find(s => s.title.includes(t))!;

describe('every section earns its place', () => {
  it.each(FOUNDATIONS)('$title has a lede and a body', (s) => {
    expect(s.lede).toBeTruthy();
    expect(s.body.length).toBeGreaterThan(0);
  });

  it.each(FOUNDATIONS)('$title names the mistake it prevents', (s) => {
    /* A foundation that only describes is reference material an agent already
       infers from the tokens. The trap is the part it cannot. */
    expect(s.trap, s.title).toBeTruthy();
  });
});

describe('platforms, not breakpoints', () => {
  it('states there are no media queries', () => {
    /* The single most surprising fact here: `grep -c @media` on both emitters
       returns 0. Every other design system an agent has seen uses them, so
       without this it writes breakpoints that cannot do anything. */
    const s = section('Platforms');
    expect(s.lede + s.body.join(' ')).toMatch(/no media quer/i);
    expect(s.trap).toMatch(/min-width/);
  });

  it('lists the five device blocks', () => {
    /* Five, not four. Android split into tablet and phone because their
       typography differs on Floating-Label-Large-Line-Height — 24 against 16 —
       so the shared block dropped one of the two values. Orientation still
       collapses: across all 379 Typography variables the vertical and
       horizontal modes are identical. */
    const rows = section('Platforms').table!.rows.map(r => r[0]);
    expect(rows).toHaveLength(5);
    for (const p of ['Desktop', 'IOS-Mobile', 'IOS-Tablet', 'Android-Tablet', 'Android-Mobile']) {
      expect(rows.some(r => r.includes(p)), p).toBe(true);
    }
  });
});

describe('surfaces', () => {
  it('names all ten levels', () => {
    const all = section('Surfaces').table!.rows.map(r => r[1]).join(' ');
    for (const level of ['Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright',
      'Surface-Brightest', 'Container', 'Container-Low', 'Container-Lowest',
      'Container-High', 'Container-Highest']) {
      expect(all, level).toContain(level);
    }
  });

  it('forbids painting with --Surface directly', () => {
    expect(section('Surfaces').trap).toMatch(/var\(--Surface\)/);
  });
});

describe('static and dynamic typography', () => {
  it('says which platforms use which', () => {
    const body = section('typography').body.join(' ');
    expect(body).toMatch(/Desktop/);
    expect(body).toMatch(/Dynamic Type/);
    expect(body).toMatch(/Material 3/);
  });

  it('warns that a mobile line height will be replaced', () => {
    /* It is derived from the platform table at generate time. Editing the
       static block looks like it worked until the next regenerate. */
    expect(section('typography').trap).toMatch(/replaced|derived/i);
  });
});

describe('spacing', () => {
  it('marks Sizing-3 as the touch target', () => {
    const rows = section('Spacing').table!.rows;
    const s3 = rows.find(r => r[0].includes('Sizing-3'))!;
    expect(s3[1]).toBe('24');
    expect(s3[2]).toMatch(/touch target/i);
  });

  it('says a radius is NOT spacing', () => {
    /* The list row had its radius and padding both on Sizing-1 and they could
       not move apart. That is the mistake this prevents. */
    expect(section('Spacing').body.join(' ')).toMatch(/radius does NOT/i);
    expect(section('Spacing').trap).toMatch(/radius/i);
  });
});

describe('elevation', () => {
  it('gives every component a rest level', () => {
    for (const row of section('Elevation').table!.rows) {
      expect(row[1], row[0]).toMatch(/^\d$/);
    }
  });

  it('says a button is flat at rest and a modal cannot be raised', () => {
    const t = section('Elevation').trap!;
    expect(t).toMatch(/flat at rest/);
    expect(t).toMatch(/cannot be raised/);
  });

  it('separates a bevel from a drop shadow', () => {
    /* The rule the whole Theme-* layer convention exists to serve. */
    expect(section('Elevation').body.join(' ')).toMatch(/bevel.*own surface/is);
  });
});

describe('the Alt Display', () => {
  it('describes both gradient kinds', () => {
    const body = section('Alt Display').body.join(' ');
    expect(body).toMatch(/\*\*duo\*\*/);
    expect(body).toMatch(/\*\*mono\*\*/);
  });

  it('says every brand gets one — the palette picks WHICH, not WHETHER', () => {
    const s = section('Alt Display');
    expect(s.lede).toMatch(/every brand/i);
    expect(s.body.join(' ')).toMatch(/not whether/i);
  });

  it('forbids hand-picking the stops', () => {
    expect(section('Alt Display').trap).toMatch(/legible|derived/i);
  });
});

describe('states', () => {
  it('says links have no hover tone', () => {
    expect(section('States').trap).toMatch(/underline thickens/);
  });

  it('says direction comes from the label, not the tone index', () => {
    expect(section('States').body.join(' ')).toMatch(/LABEL, not/);
  });
});

describe('the rendered page', () => {
  it('puts the trap in a blockquote so it cannot be skimmed past', () => {
    expect(renderFoundations()).toContain('> **Trap.**');
  });

  it('opens with platforms, because it is the most surprising', () => {
    expect(renderFoundations().split('\n## ')[1]).toMatch(/^Platforms/);
  });

  it('leaves no triple newline', () => {
    expect(renderFoundations()).not.toMatch(/\n{3}/);
  });
});
