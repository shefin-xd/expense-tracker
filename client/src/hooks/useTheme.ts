import { useEffect, useState } from 'react';
import { useUi } from '@/store/ui';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Keeps <html class="dark"> in sync with the chosen theme (light, dark or system). Returns the resolved theme. */
export function useTheme(): 'light' | 'dark' {
  const theme = useUi((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() => query().matches);
  useEffect(() => {
    const mq = query();
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => { document.documentElement.classList.toggle('dark', resolved === 'dark'); }, [resolved]);
  return resolved;
}

/** Hex colours for charts (SVG), per resolved theme. All blues are tints of the brand dark blue. */
export function useChartColors() {
  const dark = useTheme() === 'dark';
  return dark
    ? { main: '#8AAAE2', grid: '#242934', axis: '#757C8A', ramp: ['#8AAAE2', '#6C8FCC', '#5173B0', '#3C5C94', '#2D4777', '#4B5262', '#363D4D'], track: '#242934' }
    : { main: '#142B52', grid: '#E5E7EC', axis: '#8B929E', ramp: ['#142B52', '#2B4A7E', '#4A6A9F', '#7189B3', '#9FB0CC', '#B8BEC9', '#D5D9E0'], track: '#E5E7EC' };
}
