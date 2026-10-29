/**
 * A bar picked in the current picker ("Tertiary · Bright", stored as
 * "Tertiary/Surface-Bright") must survive into the metadata the Figma import
 * reads. It used to fall through to the legacy name table and come out as
 * Primary — the CSS read the selection directly and was right, Figma was told
 * Primary and themed every bar the wrong palette at no particular level.
 */
import { describe, it, expect } from 'vitest';
import { applyUserSelections, calculateDefaultThemeSettings } from '../utils/cssgen/defaultThemeLogic';

const base = () => calculateDefaultThemeSettings(60, 70, 'light-tonal', 'triadic');

describe('bar selections in the Theme/Surface form', () => {
  it('keep the palette and the selection as picked', () => {
    const s = applyUserSelections(base(), {
      appBar: 'Tertiary/Surface-Bright',
      navBar: 'Secondary/Surface-Dim',
      status: 'Neutral/Surface-Brightest',
    }, 60, 70);
    expect([s.appBar, s.appBarTheme]).toEqual(['Tertiary/Surface-Bright', 'Tertiary']);
    expect([s.navBar, s.navBarTheme]).toEqual(['Secondary/Surface-Dim', 'Secondary']);
    expect([s.status, s.statusTheme]).toEqual(['Neutral/Surface-Brightest', 'Neutral']);
  });

  it('leave the legacy names on their old mapping', () => {
    const s = applyUserSelections(base(), { appBar: 'white' }, 60, 70);
    expect([s.appBar, s.appBarTheme]).toEqual(['White', 'Neutral']);
  });
});
