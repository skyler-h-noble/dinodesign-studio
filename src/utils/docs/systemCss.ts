/**
 * The seven stylesheets that make a rendered component belong to one brand.
 *
 * Shared with GeneratedPreview rather than restated: the list has grown twice
 * (base.css, styles.css), and a second copy would render the docs against a
 * system missing whichever file was added last — silently, because a missing
 * stylesheet does not error, it just leaves tokens unresolved and the component
 * painting its fallbacks.
 */
import { getPublicFileUrl } from '../firebase/storage';

/* typography-tokens.css is the one that went missing, and it is the one whose
   absence is hardest to read as a bug. Every other sheet here was passed; this
   one was not, so the LIB's bundled copy stayed in force and supplied the whole
   type ramp — sizes, weights and variable-font axes — to every system the studio
   rendered. The bundled file is one brand's export (byte-identical to Cocktail
   Hour's), so opening any hosted design system showed that brand's typography
   over the system's own, and nothing errored: the tokens were all defined, just
   defined by somebody else. */
export const SYSTEM_CSS_FILES = [
  'foundation.css', 'core.css', 'typography-tokens.css',
  'Light-Mode.css', 'Dark-Mode.css', 'base.css', 'styles.css',
] as const;

export interface SystemCssUrls {
  foundationCSS: string;
  coreCSS: string;
  typographyCSS: string;
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
    typographyCSS: at('typography-tokens.css'),
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
