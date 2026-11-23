import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/anton/400.css';
import '@fontsource-variable/outfit';
import './index.css';
import { App } from './App';
import { CourtPreview } from './screens/CourtPreview';
import { Gallery } from './screens/Gallery';
import { useGame } from './state/store';

// Development builds expose the store so Playwright can drive scenarios.
if (import.meta.env.DEV) (window as unknown as { __eyespy: typeof useGame }).__eyespy = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && location.search.includes('gallery') ? <Gallery /> : import.meta.env.DEV && location.search.includes('court') ? <CourtPreview /> : <App />}
  </StrictMode>,
);
