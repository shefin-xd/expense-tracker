import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import App from './App';
import './index.css';

// Zod's just-in-time compiler probes eval, which the strict Content-Security-Policy blocks (noisily). It is not needed here.
z.config({ jitless: true });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
