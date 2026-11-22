/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the bundle works from the Capacitor web view.
  base: './',
  // The bundle ships inside the app, so one larger chunk is fine.
  build: { target: 'es2022', outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
  server: { port: 5173 },
  test: { name: 'app', include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom' },
});
