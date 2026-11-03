/**
 * The end-user doc (DINO-TOKENS.md, the "CLAUDE.md URL") must carry THIS
 * system's choices and the rules an AI tool needs — and must not silently drop
 * either. It used to teach `Primary-Light` themes, `variant="solid"` buttons,
 * an `npx @dynodesign/init` that does not exist on npm, and nothing at all
 * about which background, bars or cards the designer picked.
 */
import { describe, it, expect } from 'vitest';
import { buildDesignSystemDoc, selectionLabel } from '../utils/endUserDocs';
import type { UserSelections } from '../types';

const THEME_URL = 'https://example.test/design-systems%2Fabc%2Ftheme.json?alt=media';

function doc(sel: Partial<UserSelections>, style: 'professional' | 'modern' | 'bold' | 'playful' = 'modern') {
  return buildDesignSystemDoc({
    uuid: 'abc-123',
    themeUrl: THEME_URL,
    designSystemName: 'Harbor',
    colors: ['#1d5c63', '#e07a5f', '#f2cc8f'],
    userSelections: sel,
    componentStyle: style,
  });
}

/** The row of the choices table for one part. */
function row(md: string, part: string): string {
  const line = md.split('\n').find((l) => l.startsWith(`| ${part} |`));
  if (!line) throw new Error(`no "${part}" row`);
  return line;
}

const SAMPLE: Partial<UserSelections> = {
  background: 'Primary/Surface-Brightest',
  appBar: 'Secondary/Surface-Bright',
  navBar: 'black',
  status: 'white',
  button: 'laddered',
  buttonTone: 'tonal',
  cardColoring: 'white',
  textColoring: 'black-white',
};

describe('end-user doc: this system\'s choices', () => {
  const md = doc(SAMPLE, 'playful');

  it('names the page background and how the root reproduces it', () => {
    const r = row(md, 'Page background');
    expect(r).toContain('Primary · Surface-Brightest');
    expect(r).toContain('data-theme="Default"');
    expect(r).toContain('data-surface="Surface"');
  });

  it('names the app bar, nav bar and status bar choices and their themes', () => {
    expect(row(md, 'App bar')).toContain('Secondary · Surface-Bright');
    expect(row(md, 'App bar')).toContain('<ThemedZone theme="App-Bar" surface="Surface">');
    expect(row(md, 'Phone bottom bar')).toContain('Neutral · Surface-Dimmest (black)');
    expect(row(md, 'Phone bottom bar')).toContain('Nav-Bar');
    expect(row(md, 'Phone status bar')).toContain('Neutral · Surface-Brightest (white)');
  });

  it('names the button, card, text and shape choices', () => {
    expect(row(md, 'Main button')).toMatch(/Laddered.*tonal/);
    expect(row(md, 'Main button')).toContain('variant="default"');
    expect(row(md, 'Cards')).toContain('White');
    expect(row(md, 'Text')).toContain('Black & white');
    expect(row(md, 'Shape')).toContain('Playful');
    expect(md).toContain('`#1d5c63`');
  });

  it('loads the system through its published theme.json', () => {
    expect(md).toContain(`<OmniDesignProvider themeURL="${THEME_URL}">`);
    expect(md).toContain('@omni-design/icons');
    expect(md).not.toContain('@dynodesign/init');
  });

  it('follows the selections — a different system gets a different table', () => {
    const other = doc({ background: 'white', appBar: 'primary', navBar: 'primary-light', button: 'black-white', cardColoring: 'tonal' });
    expect(row(other, 'Page background')).toContain('Neutral · Surface-Brightest (white)');
    expect(row(other, 'App bar')).toContain('Primary · Surface |');
    expect(row(other, 'Phone bottom bar')).toContain('Primary · Surface-Brightest');
    expect(row(other, 'Main button')).toContain('Black & white');
    expect(row(other, 'Cards')).toContain('Tonal');
  });

  it('labels every background the picker can store', () => {
    expect(selectionLabel({ theme: 'Neutral', surface: 'Surface-Dimmest' })).toBe('Neutral · Surface-Dimmest (black)');
    expect(selectionLabel({ theme: 'Primary', surface: 'Surface' })).toBe('Primary · Surface');
  });
});

describe('end-user doc: the rules', () => {
  const md = doc(SAMPLE);

  it.each([
    // every theme and surface by name
    ...['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error', 'App-Bar', 'Nav-Bar', 'Status'].map((t) => `\`${t}\``),
    ...['Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest',
      'Container-Lowest', 'Container-Low', 'Container', 'Container-High', 'Container-Highest'].map((t) => `\`${t}\``),
    'no `-Light` / `-Medium` / `-Dark` themes',
    '<Section theme surface>',
    '<ThemedZone>',
    'Never `background: var(--Surface)`',
    'never `style={{ color }}`',
    'not `@mui/icons-material`',
    'aria-label="Delete item"',
    '<Subtitle>',
    '<ToggleButtonGroup>',
    '<Tabs navigation>',
    '<Card href>',
    '<Dropdown><MenuButton/><Menu>',
    '<Popover>',
    '<CodeBlock',
    'don\'t change color on hover',
    'floating things cast black ones',
    '<Eyebrow>',
    'color="tertiary"',
    '<Alert color="success">',
    'MISSING-LIB-COMPONENT',
    'node_modules/@omni-design/components/CLAUDE.md',
  ])('teaches %s', (needle) => {
    expect(md).toContain(needle);
  });

  it('teaches none of the removed names', () => {
    expect(md).not.toMatch(/data-theme="\w+-(Light|Medium|Dark)"/);
    expect(md).not.toMatch(/variant="\w+-light"/);
    expect(md).not.toContain('variant="solid"');
    expect(md).not.toContain("from '@mui/icons-material");
  });

  it('stays compact', () => {
    // Read on every prompt by a token-conscious user. The previous file was
    // ~24,000 characters, most of it wrong; this one should stay well under.
    expect(md.length).toBeLessThan(11000);
  });
});
