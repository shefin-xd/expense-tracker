// Applies the saved theme before first paint so dark mode never flashes light.
// Kept as an external file so the Content-Security-Policy can forbid inline scripts.
try {
  var t = (JSON.parse(localStorage.getItem('cl-theme') || '{}').state || {}).theme || 'light';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
