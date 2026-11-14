import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Pages are lazy-loaded (the dashboard pulls in the chart library), so give async queries room on slow machines.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no matchMedia; the app uses it to follow the device's light/dark setting.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
