/**
 * --Modal-Max and --Sm- / -- / --Lg-Dialog-Width: the widths Modal.js and
 * Dialog.js read. They were Figma-only (Devices-Type › Modal Max, Dialog-Small
 * / -Medium / -Large), so code always fell back to 960 / 560 — including on a
 * phone, where Figma narrows both to the screen less its margins.
 *
 * foundation.css is built inside the upload path, so — like deviceChrome's
 * offsets — the emission is asserted on the generator's source: one call per
 * device block, plus the preview, which is a separate implementation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { overlayWidthCSS, DEVICE_MODAL_MAX, DEVICE_DIALOG_WIDTH } from '../utils/deviceChrome';

describe('overlay widths', () => {
  it('match the Figma Default device sizes', () => {
    expect(DEVICE_MODAL_MAX.Desktop).toBe(960);
    expect(DEVICE_MODAL_MAX['IOS-Tablet-Vertical']).toBe(720);
    expect(DEVICE_MODAL_MAX['Android-Mobile']).toBe(328);
    expect(DEVICE_DIALOG_WIDTH.Desktop).toEqual({ small: 400, medium: 560, large: 720 });
    expect(DEVICE_DIALOG_WIDTH['IOS-Mobile'].medium).toBe(361);
  });

  it('render as the four CSS variables the components read', () => {
    expect(overlayWidthCSS('Desktop')).toEqual([
      '  --Modal-Max: 960px;',
      '  --Sm-Dialog-Width: 400px;',
      '  --Dialog-Width: 560px;',
      '  --Lg-Dialog-Width: 720px;',
    ]);
  });

  it('are emitted in every foundation.css device block and in the preview', () => {
    const gen = readFileSync(resolve(__dirname, '../utils/generateDesignSystem.ts'), 'utf8');
    for (const d of ['Desktop', 'IOS-Mobile', 'IOS-Tablet-Vertical', 'Android-Tablet-Vertical', 'Android-Mobile']) {
      expect(gen).toContain(`overlayWidthCSS('${d}')`);
    }
    const preview = readFileSync(resolve(__dirname, '../utils/buildPreviewCSS.ts'), 'utf8');
    expect(preview).toContain(`overlayWidthCSS('Desktop')`);
  });
});
