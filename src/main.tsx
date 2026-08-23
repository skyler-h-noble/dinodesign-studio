import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// foundation.css, singular. The plural file was deleted from the lib: it held
// a strict SUBSET of this one (44 of 47 variables) but disagreed on six values
// — --Button-Radius 4px vs 34px, --Button-Icon-Radius 4px vs 61px, and the
// whole bevel system on vs off — so which one you imported silently decided
// whether buttons were flat squares or bevelled pills. It was also missing
// --Input-Radius, which the Dropdown-Frame-Radius chain reads.
import '@dynodesign/components/public/styles/foundation.css';
import '@dynodesign/components/public/styles/core.css';
import '@dynodesign/components/public/styles/Light-Mode.css';
import '@dynodesign/components/public/styles/base.css';
import '@dynodesign/components/public/styles/styles.css';
// Per-platform typography sizing tokens (Button-Small-Font-Size,
// Body-Small-Line-Height, etc.). Gated on [data-platform="Desktop"] which we
// set on <html> below — without that attribute the tokens stay undefined and
// Typography components fall back to inherited defaults.
import '@dynodesign/components/public/styles/typography-tokens.css';

document.documentElement.setAttribute('data-platform', 'Desktop');

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
