/**
 * The six stylesheets that make a rendered component belong to one brand.
 *
 * Shared with GeneratedPreview rather than restated: the list has grown twice
 * (base.css, styles.css), and a second copy would render the docs against a
 * system missing whichever file was added last — silently, because a missing
 * stylesheet does not error, it just leaves tokens unresolved and the component
 * painting its fallbacks.
 */
import { getPublicFileUrl } from '../firebase/storage';

export const SYSTEM_CSS_FILES = [
  'foundation.css', 'core.css', 'Light-Mode.css', 'Dark-Mode.css',
  'base.css', 'styles.css',
] as const;

export interface SystemCssUrls {
  foundationCSS: string;
  coreCSS: string;
  lightModeCSS: string;
  darkModeCSS: string;
  baseCSS: string;
  stylesCSS: string;
}

export function systemCssUrls(designSystemId: string): SystemCssUrls {
  const at = (f: string) => getPublicFileUrl(designSystemId, f);
  return {
    foundationCSS: at('foundation.css'),
    coreCSS: at('core.css'),
    lightModeCSS: at('Light-Mode.css'),
    darkModeCSS: at('Dark-Mode.css'),
    baseCSS: at('base.css'),
    stylesCSS: at('styles.css'),
  };
}

/** Does this id resolve to a published system? Cheap enough to gate on. */
export async function systemExists(designSystemId: string): Promise<boolean> {
  try {
    const res = await fetch(getPublicFileUrl(designSystemId, 'foundation.css'), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}
