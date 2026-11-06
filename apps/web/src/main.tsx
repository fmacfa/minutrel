import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@minutrel/ui';
import '@minutrel/ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Point d’entrée introuvable.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
