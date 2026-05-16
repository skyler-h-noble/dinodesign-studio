import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@dynodesign/components/public/styles/foundations.css';
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
