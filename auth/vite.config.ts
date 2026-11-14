/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// `vite preview` sends the same security headers Vercel will (vercel.json), so a policy mistake shows up locally.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const securityHeaders = Object.fromEntries((vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value]));
const api = { '/api': { target: process.env.VITE_DEV_API ?? 'http://localhost:4000', changeOrigin: true } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5174, proxy: api },
  preview: { port: 4174, headers: securityHeaders, proxy: api },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], css: false },
});
