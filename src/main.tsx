import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// foundation.css, singular. The plural file was deleted from the lib: it held
// a strict SUBSET of this one (44 of 47 variables) but disagreed on six values
// — --Button-Radius 4px vs 34px, --Button-Icon-Radius 4px vs 61px, and the
// whole bevel system on vs off — so which one you imported silently decided
// whether buttons were flat squares or bevelled pills. It was also missing
// --Input-Radius, which the Dropdown-Frame-Radius chain reads.
import '@omni-design/components/public/styles/foundation.css';
import '@omni-design/components/public/styles/core.css';
import '@omni-design/components/public/styles/Light-Mode.css';
import '@omni-design/components/public/styles/base.css';
import '@omni-design/components/public/styles/styles.css';
// Per-platform typography sizing tokens (Button-Small-Font-Size,
// Body-Small-Line-Height, etc.). Gated on [data-platform="Desktop"] which we
// set on <html> below — without that attribute the tokens stay undefined and
// Typography components fall back to inherited defaults.
import '@omni-design/components/public/styles/typography-tokens.css';
import { applyStudioDesignSystem } from './utils/studioDesignSystem';

document.documentElement.setAttribute('data-platform', 'Desktop');

/* OmniDesign wearing one of its own design systems.
 *
 * The imports above are the LIB's defaults — the fallback skin. This layers
 * "Omni" (09c2d308…) over them so the studio is dressed in something it made
 * itself. Fire-and-forget on purpose: the bundled sheets already style the app
 * from the first frame, so a slow or failed fetch costs the brand, never the
 * UI. */
export const STUDIO_DESIGN_SYSTEM_ID = '09c2d308-27c8-47b1-8117-0fad4f027b48';
applyStudioDesignSystem(STUDIO_DESIGN_SYSTEM_ID).catch(() => {});

import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);
