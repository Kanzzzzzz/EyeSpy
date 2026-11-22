import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/outfit';
import './index.css';
import { App } from './App';
import { useGame } from './state/store';

// Development builds expose the store so Playwright can drive scenarios.
if (import.meta.env.DEV) (window as unknown as { __eyespy: typeof useGame }).__eyespy = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
