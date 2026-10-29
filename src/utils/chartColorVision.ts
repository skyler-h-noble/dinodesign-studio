/**
 * Chart colors for color-vision deficiencies — re-exported from the library,
 * which holds the ONE copy (@omni-design/components, Charts/colorVision.js).
 *
 * The values are the same in every brand, so they live in the lib:
 * OmniDesignProvider injects them, and an app gets data-color-vision support
 * on a library update without its design system being regenerated. The
 * generator still writes the same CSS into each published system (via
 * chartGroundCSS) for apps that load a system's sheets without the provider.
 *
 * Figma mirror: the `.Chart` collection holds `<Set>/Colors/...` per set;
 * `Color-Blindness` picks a set by mode; `Chart-Colors` (series) and
 * `Chart-State-Colors` (states) read through it.
 */
export { CHART_COLOR_VISION, COLOR_VISIONS, chartColorVisionCSS } from '@omni-design/components';

export type ColorVision =
  | 'red-weak' | 'red-blind' | 'green-weak' | 'green-blind'
  | 'blue-weak' | 'blue-blind' | 'blue-cone';
