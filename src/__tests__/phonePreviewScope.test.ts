import { describe, it, expect } from 'vitest';
import { scopePhoneCSS } from '../components/PhonePreview';

/* The phone mock-up's stylesheet used to be injected bare. Its page-level
   selectors matched the whole studio and, mounting last, overrode the user's
   shadows on every card of the Assign Colors stage with the defaults. */
describe('scopePhoneCSS', () => {
  const css = ':root { --A: 1; }\n[data-theme], [data-surface] { --Effect-Level-1: none; }';
  const out = scopePhoneCSS(css);

  it('fences every rule inside the phone wrapper', () => {
    expect(out.startsWith('@scope (.phone-preview-scope) {')).toBe(true);
    expect(out.trimEnd().endsWith('}')).toBe(true);
  });

  it('moves root-level tokens onto the scope root', () => {
    expect(out).toContain(':scope { --A: 1; }');
    expect(out).not.toContain(':root');
  });
});
