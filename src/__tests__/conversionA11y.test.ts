import { describe, it, expect } from 'vitest';
import { computeA11y, a11ySummary } from '../utils/conversionA11y';

const kinds = (jsx: string, notes?: string) =>
  computeA11y(jsx, notes).map(f => f.kind).sort();

describe('unnamed controls', () => {
  /* The whole point of the module. None of these render wrong — a button with
     no accessible name looks perfect and is only findable with a screen
     reader, which is why it needs a static check rather than a review. */
  it('flags every labelless Button Type', () => {
    for (const prop of ['iconOnly', 'avatar', 'letterNumber', 'swatch']) {
      expect(kinds(`<Button ${prop}><HomeIcon /></Button>`), prop)
        .toContain('unnamed-control');
    }
  });

  it('accepts a labelless Button that carries a name', () => {
    for (const named of [
      '<Button iconOnly aria-label="Search"><SearchIcon /></Button>',
      '<Button avatar aria-labelledby="acct-label"><Avatar /></Button>',
      '<Button letterNumber title="Notifications">3</Button>',
    ]) expect(kinds(named)).not.toContain('unnamed-control');
  });

  it('does NOT ask a text Button for a name', () => {
    /* Its visible label IS the accessible name. Adding aria-label there makes
       a screen reader announce the control twice, so demanding one would be
       actively wrong rather than merely noisy. */
    expect(kinds('<Button variant="default">Save</Button>')).toEqual([]);
  });

  it('respects an explicitly false flag', () => {
    expect(kinds('<Button iconOnly={false}>Save</Button>')).toEqual([]);
  });
});

describe('names that exist but say nothing', () => {
  /* These are worse than a missing name, and the reason is not obvious: an
     UNNAMED button trips the lib's dev warning and shows up in an audit. A
     button named "button" passes every automated check, silences the warning,
     and is only catchable by reading it. */
  it('flags the control type as a name', () => {
    for (const n of ['button', 'Button', 'icon', 'link', 'image', 'here', 'label'])
      expect(kinds(`<Button iconOnly aria-label="${n}"><X /></Button>`), n)
        .toContain('meaningless-name');
  });

  it('flags the content mistaken for the name', () => {
    // "3" is a count, "JD" is a person — neither says what the control DOES.
    for (const n of ['3', '12', 'JD', 'A', 'ABC', '99+'])
      expect(kinds(`<Button letterNumber aria-label="${n}">${n}</Button>`), n)
        .toContain('meaningless-name');
  });

  it('accepts a name that describes the action', () => {
    for (const n of ['Search', 'Your account', 'Add member', 'Delete item'])
      expect(kinds(`<Button iconOnly aria-label="${n}"><X /></Button>`), n).toEqual([]);
  });

  it('warns, not errors, when the name merely repeats visible text', () => {
    const f = computeA11y('<Button aria-label="Save">Save</Button>');
    expect(f.map(x => x.kind)).toEqual(['redundant-name']);
    expect(f[0].severity).toBe('warning');
  });
});

describe('labelled twice', () => {
  it('flags a named Button containing a named icon', () => {
    expect(kinds('<Button iconOnly aria-label="Delete item"><DeleteIcon aria-label="Delete" /></Button>'))
      .toContain('double-label');
    expect(kinds('<Button iconOnly aria-label="Delete item"><DeleteIcon titleAccess="trash" /></Button>'))
      .toContain('double-label');
  });

  it('accepts the correct shape — button named, icon silent', () => {
    expect(kinds('<Button iconOnly aria-label="Delete item"><DeleteIcon /></Button>')).toEqual([]);
  });
});

describe('elements the library should own', () => {
  /* Here rather than in drift because the consequence is behavioural: a raw
     <button> looks identical and has no focus ring, no minimum target size and
     none of the lib's naming warnings. Nothing about it is visible until
     someone tabs to it. */
  it('flags raw interactive elements', () => {
    for (const el of ['button', 'input', 'select', 'textarea'])
      expect(kinds(`<${el} />`), el).toContain('raw-interactive');
  });

  it('flags an empty link', () => {
    expect(kinds('<a href="/x"></a>')).toContain('link-no-text');
    expect(kinds('<a href="/x">Docs</a>')).not.toContain('link-no-text');
  });

  it('flags a missing alt, and accepts an explicit empty one', () => {
    // alt="" is a decision — decorative. A missing attribute is an omission.
    expect(kinds('<img src="x.png" />')).toContain('image-no-alt');
    expect(kinds('<img src="x.png" alt="" />')).not.toContain('image-no-alt');
  });
});

describe('heading order', () => {
  it('flags a skipped level', () => {
    const f = computeA11y('<H1>A</H1><H3>B</H3>');
    expect(f.map(x => x.kind)).toEqual(['heading-skip']);
    expect(f[0].detail).toBe('H1 → H3');
  });

  it('accepts descending back to any level', () => {
    // H1 > H2 > H3 > H1 is a new section, not a skip — only going DOWN the
    // outline by more than one step breaks it.
    expect(kinds('<H1>A</H1><H2>B</H2><H3>C</H3><H1>D</H1>')).toEqual([]);
  });
});

describe('names the converter had to guess', () => {
  /* The reason the module exists. There is no Accessible Name property in
     Figma, so names are DERIVED — and the prompt is told to flag every guess.
     That flag previously went into notes nobody reads. */
  it('reads the marker out of the emitted JSX', () => {
    /* The marker travels IN the code, like MISSING-LIB-COMPONENT — so it
       survives being copied, saved, or pasted into a PR. A separate notes
       field would be dropped by all three. */
    const jsx = [
      '// DERIVED-ARIA-LABEL: "Dashboard" on Button — house icon, from the layer name',
      '<Button iconOnly aria-label="Dashboard"><HomeIcon /></Button>',
    ].join('\n');
    const derived = computeA11y(jsx).filter(x => x.kind === 'derived-name');
    expect(derived).toHaveLength(1);
    expect(derived[0].severity).toBe('info');
    expect(derived[0].detail).toBe('Dashboard');
    expect(derived[0].message).toContain('house icon');
  });

  it('reads it without a reason clause too', () => {
    const jsx = '// DERIVED-ARIA-LABEL: "Search"\n<Button iconOnly aria-label="Search"><X /></Button>';
    expect(kinds(jsx)).toEqual(['derived-name']);
  });

  it('finds every marker, not just the first', () => {
    const jsx = [
      '// DERIVED-ARIA-LABEL: "Search" on Button — magnifier icon',
      '// DERIVED-ARIA-LABEL: "Your account" on Button — avatar, by convention',
      '<Button iconOnly aria-label="Search"><X /></Button>',
      '<Button avatar aria-label="Your account"><Avatar /></Button>',
    ].join('\n');
    expect(computeA11y(jsx).filter(x => x.kind === 'derived-name')).toHaveLength(2);
  });

  it('stays quiet when nothing was guessed', () => {
    expect(kinds('<Button iconOnly aria-label="Search"><X /></Button>')).toEqual([]);
  });
});

describe('shape', () => {
  it('returns nothing for empty input', () => {
    expect(computeA11y('')).toEqual([]);
    expect(computeA11y('   ')).toEqual([]);
  });

  it('counts by severity', () => {
    const f = computeA11y('<Button iconOnly><X /></Button><img src="a" /><H1>A</H1><H4>B</H4>');
    const s = a11ySummary(f);
    expect(s.errors).toBe(1);      // unnamed-control
    expect(s.warnings).toBe(2);    // image-no-alt, heading-skip
    expect(s.info).toBe(0);
  });

  it('says which element every finding came from', () => {
    /* Without it, "Button has no accessible name" is unactionable on a frame
       with six buttons — the same reason DriftFinding carries `where`. */
    for (const f of computeA11y('<Button iconOnly><X /></Button><input />'))
      expect(f.where, f.kind).toBeTruthy();
  });
});

describe('lists that lost their list-ness', () => {
  /* Figma DRAWS a native list's marker, so a real list's characters never
     contain one. A marker surviving into the JSX therefore proves the text was
     copied verbatim and the list was never recognised — the output is a stack
     of paragraphs with no list role, no item count, and the glyph read aloud
     as content. */
  it('flags a bullet left inside a paragraph', () => {
    for (const m of ['• First item', '- First item', '* First item', '▪ First item'])
      expect(kinds(`<Body>${m}</Body>`), m).toContain('prose-list');
  });

  it('flags a typed number too', () => {
    for (const m of ['1. First', '2) Second', 'a. Alpha'])
      expect(kinds(`<Body>${m}</Body>`), m).toContain('prose-list');
  });

  it('leaves ordinary prose alone', () => {
    for (const t of [
      'First item',
      'A dash-separated word',
      '3D printing is useful',
      'Rates dropped 2.5% last year',
    ]) expect(kinds(`<Body>${t}</Body>`), t).toEqual([]);
  });

  it('is an error — restyling cannot recover it', () => {
    // The markup has to change, so it sits at the same severity as an unnamed
    // control rather than as a warning.
    const f = computeA11y('<Body>• First item</Body>');
    expect(f[0].severity).toBe('error');
  });

  it('catches it in every typography component, not just Body', () => {
    for (const tag of ['Body', 'BodySmall', 'Caption', 'Label', 'Typography', 'p'])
      expect(kinds(`<${tag}>• Item</${tag}>`), tag).toContain('prose-list');
  });
});

describe('a marker typed on top of a real list', () => {
  it('warns when a ListItem keeps its own bullet', () => {
    /* <List> renders the marker itself, so a typed one is duplicate content —
       shown twice and announced twice. The structure is right, so this is a
       warning, not the structural error above. */
    const f = computeA11y('<List><ListItem>• First</ListItem></List>');
    expect(f.map(x => x.kind)).toContain('double-marker');
    expect(f.find(x => x.kind === 'double-marker').severity).toBe('warning');
  });

  it('accepts a clean ListItem', () => {
    expect(kinds('<List><ListItem>First</ListItem></List>')).toEqual([]);
  });
});

describe('lists the converter had to infer', () => {
  it('reads the DERIVED-LIST marker', () => {
    const jsx = [
      '// DERIVED-LIST: 3 items on <List> — markers typed as "• " in one text node',
      '<List><ListItem>First</ListItem></List>',
    ].join('\n');
    const f = computeA11y(jsx).filter(x => x.kind === 'derived-list');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('info');
    expect(f[0].message).toContain('may be a dash');
  });

  it('stays quiet for a list Figma actually knew about', () => {
    /* The whole point of stamping _aaid.list: a list authored with Figma's own
       list control is READ, not guessed, so there is nothing to confirm. Only
       an inferred one gets a marker, so only an inferred one is reported. */
    expect(kinds('<List><ListItem>First</ListItem><ListItem>Second</ListItem></List>')).toEqual([]);
  });
});
