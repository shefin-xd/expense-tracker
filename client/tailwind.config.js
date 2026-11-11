/** Three brand colors (black, white, dark blue) plus neutral grays, exposed as semantic tokens. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), subtle: v('subtle'),
        fg: v('fg'), muted: v('muted'), faint: v('faint'),
        line: v('line'), strong: v('strong'),
        primary: v('primary'), 'primary-fg': v('primary-fg'), 'primary-hover': v('primary-hover'),
        accent: v('accent'),
        danger: v('danger'), warn: v('warn'), good: v('good'),
      },
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { DEFAULT: '6px', md: '6px', lg: '8px' },
      boxShadow: { pop: '0 8px 24px -8px rgb(9 11 16 / 0.25)' },
    },
  },
  plugins: [],
};
