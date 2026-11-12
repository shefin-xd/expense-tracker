/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// `vite preview` serves the production build with the exact security headers Vercel will send (vercel.json),
// so a Content-Security-Policy mistake shows up locally instead of after deploy.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const securityHeaders = Object.fromEntries((vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value]));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // In development the API is proxied, so cookies stay same-origin and no CORS is needed.
    proxy: { '/api': { target: process.env.VITE_DEV_API ?? 'http://localhost:4000', changeOrigin: true } },
  },
  preview: { port: 4173, headers: securityHeaders, proxy: { '/api': { target: process.env.VITE_DEV_API ?? 'http://localhost:4000', changeOrigin: true } } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], css: false },
});
