import { describe, it, expect } from 'vitest';
import { darkPhotoSelector, darkPhotoDimCSS } from '../utils/darkImageDim';

/* Dark mode dims PHOTOS only. It used to be every <img>, logos included.
   (Selector matching was verified in Chrome on 2026-11-06: photo dims; .svg,
   .svg?v, data-no-dim, data-logo, and images in header / footer / nav /
   a data-no-dim region stay bright. This file pins the rule's shape.) */
describe('dark-mode photo dimming', () => {
  const sel = darkPhotoSelector();

  it('keeps the specificity of a bare img: every exclusion is inside :where()', () => {
    expect(sel).toMatch(/^img:not\(:where\(.*\)\):not\(:where\(.*\) img\)$/);
  });
  it.each(['[src$=".svg"]', '[src*=".svg?"]', '[data-no-dim]', '[data-logo]'])('leaves %s images bright', (s) => {
    expect(sel).toContain(s);
  });
  it.each(['header', 'footer', 'nav', '[role="banner"]', '[role="contentinfo"]'])('leaves images inside %s bright', (s) => {
    expect(sel).toContain(s);
  });
  it('excludes by landmark, never by a bar theme name (a phone frame is Brand-Nav-Bar end to end)', () => {
    expect(sel).not.toMatch(/Nav-Bar|App-Bar|Status/);
  });
  it('scopes for the preview, and the export and preview share one rule', () => {
    expect(darkPhotoSelector('[data-theme="Brand"]')).toBe(`:where([data-theme="Brand"]) ${sel}`);
    expect(darkPhotoDimCSS()).toContain(`${sel} {\n  filter: brightness(0.7);`);
  });
});
