/**
 * The studio's own skin must stop at the edge of a [data-theme="Brand"] region.
 *
 * Without the scope, the skin's
 *   [data-theme="Default"] [data-surface="Surface-Dim"]:not([data-theme])
 * (0,3,0) matched every bare data-surface under Brand — Brand sits inside the
 * provider's data-theme="Default" div — and outranked the brand sheet's
 * [data-theme="Brand"] [data-surface="Surface-Dim"] (0,2,0). Studio controls
 * then drew the studio system's Default button (purple sliders, a sage hover)
 * instead of the one the user picked. See scopeStudioSkin().
 */
import { describe, it, expect } from 'vitest';
import { scopeStudioSkin, BRAND_BOUNDARY } from '../utils/studioDesignSystem';

const SKIN = `:root, [data-surface="Surface"], [data-theme="Default"] { --Buttons-Default-Button: var(--Primary-Color-3); }
[data-theme="Default"] [data-surface="Surface-Dim"]:not([data-theme]) { --Buttons-Default-Button: var(--Primary-Color-3); }
@media (max-width: 600px) { :root { --Gap: 8px; } }`;

describe('scopeStudioSkin', () => {
  const out = scopeStudioSkin(SKIN);

  it('wraps the whole skin in one @scope that ends at the Brand region', () => {
    expect(BRAND_BOUNDARY).toBe('[data-theme="Brand"]');
    expect(out.startsWith('@scope (:root) to ([data-theme="Brand"]) {')).toBe(true);
    expect(out.trimEnd().endsWith('}')).toBe(true);
    // Exactly one @scope, so no rule escapes it.
    expect(out.match(/@scope/g)).toHaveLength(1);
  });

  it('rewrites :root to :scope, which is what still matches <html> inside @scope', () => {
    const body = out.slice(out.indexOf('{') + 1);
    expect(body).not.toMatch(/:root\b/);
    expect(body).toContain(':scope, [data-surface="Surface"]');
    expect(body).toContain('@media (max-width: 600px) { :scope { --Gap: 8px; } }');
  });

  it('leaves every other selector and value untouched', () => {
    expect(out).toContain('[data-theme="Default"] [data-surface="Surface-Dim"]:not([data-theme]) { --Buttons-Default-Button: var(--Primary-Color-3); }');
  });
});
