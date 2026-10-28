import { describe, it, expect } from 'vitest';
import { DEFAULT_MORPH, encodeMorphState, readMorphState, morphCode } from '../utils/addOns/morph/morphButton';

describe('Morph Button add-on', () => {
  const st = { ...DEFAULT_MORPH, shape: 'sunny', morphTo: 'flower', morphOn: 'hover' as const, icon: 'Star' };
  const link = `https://x.test/add-ons/morph-button/abc#spec=${encodeMorphState(st)}`;

  it('round-trips through the link and through the exported file', () => {
    expect(readMorphState(link)).toEqual(st);
    expect(readMorphState(morphCode(st, link))).toEqual(st);
  });

  it('writes a ShapeButton with the pair, the trigger and a name', () => {
    const code = morphCode(st, link);
    expect(code).toContain('shape="sunny"');
    expect(code).toContain('morphTo="flower"');
    expect(code).toContain('morphOn="hover"');
    expect(code).toContain('aria-label="Add to favourites"');
    expect(code).toContain("import StarIcon from '@mui/icons-material/Star';");
  });

  it('a toggle keeps its own state', () => {
    const code = morphCode({ ...st, morphOn: 'selected' });
    expect(code).toContain('const [on, setOn] = useState(false);');
    expect(code).toContain('selected={on}');
  });

  it('ignores links that are not a Morph Button', () => {
    expect(readMorphState('https://x.test/add-ons/nav#spec=abc')).toBeNull();
  });
});
