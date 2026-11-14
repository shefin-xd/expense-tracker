import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import App from './App';
import './index.css';

// Follow the device's light/dark setting live (the first paint is handled by /theme-init.js).
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const apply = () => document.documentElement.classList.toggle('dark', mq.matches);
apply();
mq.addEventListener('change', apply);

// Zod's just-in-time compiler probes eval, which the strict Content-Security-Policy blocks (noisily). It is not needed here.
z.config({ jitless: true });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
