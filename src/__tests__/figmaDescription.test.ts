/**
 * The description is merged, not replaced. Two components already carry
 * hand-written descriptions better than anything generated, and destroying one
 * to gain a do-not list is a bad trade.
 */
import { describe, it, expect } from 'vitest';
import {
  mergeDescription, generatedBlock, descriptionIsCurrent, GENERATED_MARKER,
} from '../utils/docs/figmaDescription';
import { COMPONENT_DOCS } from '../utils/docs/components';

const SELECT = COMPONENT_DOCS.find(d => d.name === 'Select')!;
const BUTTON = COMPONENT_DOCS.find(d => d.name === 'Button')!;

describe('an empty description', () => {
  it('becomes the summary plus the generated block', () => {
    const out = mergeDescription(SELECT, '');
    expect(out.startsWith(SELECT.summary)).toBe(true);
    expect(out).toContain(GENERATED_MARKER);
    expect(out).toContain('Use Autocomplete when');
  });

  it('treats null and whitespace the same as empty', () => {
    expect(mergeDescription(SELECT, null)).toBe(mergeDescription(SELECT, ''));
    expect(mergeDescription(SELECT, '   \n ')).toBe(mergeDescription(SELECT, ''));
  });
});

describe('a hand-written description', () => {
  const HUMAN = 'One day in the calendar grid.\n\nSelection and State are separate axes.';

  it('is kept word for word', () => {
    /* The real Day Cell description. It says something no summary field holds,
       and judging it "good enough" means guessing — a wrong guess silently
       destroys the one thing a person bothered to write. */
    expect(mergeDescription(SELECT, HUMAN).startsWith(HUMAN)).toBe(true);
  });

  it('does NOT get the summary prepended to it', () => {
    // Someone who wrote a description does not need it restating above theirs.
    const out = mergeDescription(SELECT, HUMAN);
    expect(out).not.toContain(SELECT.summary);
  });

  it('gains the generated block beneath a marker', () => {
    const out = mergeDescription(SELECT, HUMAN);
    const [above, below] = out.split(GENERATED_MARKER);
    expect(above.trim()).toBe(HUMAN);
    expect(below).toContain('Use Autocomplete when');
  });
});

describe('running it twice', () => {
  it('does not stack the generated block', () => {
    const once = mergeDescription(SELECT, 'Human text.');
    const twice = mergeDescription(SELECT, once);
    expect(twice).toBe(once);
    expect(twice.split(GENERATED_MARKER)).toHaveLength(2);
  });

  it('refreshes the generated half while leaving the human half alone', () => {
    /* The point of the marker: guidance can change without a person's words
       being touched, and without the two being told apart by guesswork. */
    const stale = `My own words.\n\n${GENERATED_MARKER}\nUse something outdated when it is wrong.`;
    const out = mergeDescription(SELECT, stale);
    expect(out).toContain('My own words.');
    expect(out).not.toContain('outdated');
    expect(out).toContain('Use Autocomplete when');
  });

  it('reports when a write would change nothing', () => {
    const settled = mergeDescription(BUTTON, '');
    expect(descriptionIsCurrent(BUTTON, settled)).toBe(true);
    expect(descriptionIsCurrent(BUTTON, 'something else')).toBe(false);
  });
});

describe('the generated block', () => {
  it('says where the theme goes, in Figma terms', () => {
    /* A designer reading this is IN Figma. "data-theme on an ancestor" is the
       wrong half of the answer for them. */
    expect(generatedBlock(BUTTON)).toContain('Theme:');
    expect(generatedBlock(BUTTON)).toContain(BUTTON.theming[0].inFigma);
  });

  it('reads as a sentence, not a table row', () => {
    expect(generatedBlock(SELECT)).toMatch(/^Use \w+ when [a-z]/);
  });

  it('is non-empty for every documented component', () => {
    for (const doc of COMPONENT_DOCS) {
      expect(generatedBlock(doc), doc.name).toBeTruthy();
    }
  });
});
