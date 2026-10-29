import { describe, it, expect } from 'vitest';
import { buildTypographyTokensCSS } from '../utils/typographyTokens';
import { deviceMediaQueryCSS } from '../utils/typographyPlatform';

// A web page gets the phone / tablet ramp from the screen width — the browser
// applies it as the sheet parses, nothing sets data-device.
const css = buildTypographyTokensCSS(null);
const phone = css.slice(css.indexOf('@media (max-width: 599.98px)'));
const phoneBlock = phone.slice(0, phone.indexOf('\n}\n') + 2);

describe('screen-width device ramps', () => {
  it('emits a phone and a tablet block, scoped so an explicit data-device wins', () => {
    expect(css).toContain('@media (max-width: 599.98px) {\n  :root:not([data-device]) {');
    expect(css).toContain('@media (min-width: 600px) and (max-width: 899.98px) {\n  :root:not([data-device]) {');
  });

  it('the phone block carries the phone sizes and the brand-face hooks', () => {
    expect(phoneBlock).toMatch(/--Display-Large-Font-Size:\s*48px/);
    expect(phoneBlock).toMatch(/--Platform-Font-Families-Body:\s*var\(--Set-Font-Family-Body\)/);
  });

  it('takes nothing from the platform-face (data-fonts) rules — brand faces only', () => {
    // Eyebrow wears the native UI stack on devices by design; body and
    // header must stay on the brand faces.
    expect(phoneBlock).not.toMatch(/--Platform-Font-Families-(Body|Header):\s*[^;]*SF Pro/);
  });

  it('is derived, so it adds nothing for a device the sheet does not define', () => {
    expect(deviceMediaQueryCSS(':root { --x: 1; }')).not.toContain('@media');
  });
});
