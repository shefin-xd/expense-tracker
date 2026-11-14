/** Full-page navigation to another origin (the app). Replaceable in tests. */
export const nav = { go: (url: string) => window.location.assign(url) };
