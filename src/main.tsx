import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@dynodesign/components/public/styles/foundations.css';
import '@dynodesign/components/public/styles/core.css';
import '@dynodesign/components/public/styles/Light-Mode.css';
import '@dynodesign/components/public/styles/Dark-Mode.css';
import '@dynodesign/components/public/styles/base.css';
import '@dynodesign/components/public/styles/styles.css';

import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
