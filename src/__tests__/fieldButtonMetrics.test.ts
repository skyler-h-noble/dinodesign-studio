/**
 * Field Button and NumberField sizes — Component-Size › Button/FieldButton-Width,
 * Button/FieldButton-Height, Input/Numberfield (added in the file 2026-10-24).
 */
import { describe, it, expect } from 'vitest';
import { FIELD_BUTTON_WIDTH, numberfieldFlat, fieldButtonFlat, fieldMetricsVars } from '../utils/componentSize';

describe('Field Button / NumberField metrics', () => {
  it("reproduce the file's numbers at the studio's button heights", () => {
    expect(FIELD_BUTTON_WIDTH).toEqual({ small: 40, medium: 48, large: 64 });
    // 2 x button height + 2 (the column's border) + the divider (0.5 / 1 / 2)
    expect(numberfieldFlat({ small: 24, medium: 32, large: 56 })).toEqual({
      'Numberfield': 67, 'Sm-Numberfield': 50.5, 'Lg-Numberfield': 116,
    });
  });

  it('the field follows a brand that picks other button heights', () => {
    expect(numberfieldFlat({ small: 28, medium: 40, large: 48 })['Numberfield']).toBe(83);
  });

  it('FieldButton-Height is NOT written to Figma — it should alias Button-Height there', () => {
    expect(Object.keys(fieldButtonFlat())).toEqual(['FieldButton-Width', 'Sm-FieldButton-Width', 'Lg-FieldButton-Width']);
  });

  it('CSS derives height and the field from the live tokens', () => {
    const v = fieldMetricsVars();
    expect(v['--FieldButton-Width']).toBe('48px');
    expect(v['--Lg-FieldButton-Width']).toBe('64px');
    expect(v['--FieldButton-Height']).toBe('var(--Button-Height)');
    expect(v['--Sm-Numberfield']).toBe('calc(2 * var(--Sm-Button-Height) + 2px + var(--Sm-Divider, 0.5px))');
  });
});
