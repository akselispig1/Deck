/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      // Colours are driven by CSS custom properties (see src/index.css) held as
      // space-separated RGB triplets, so Tailwind's `/opacity` modifiers work
      // and dark mode is a pure variable swap — no `dark:` variants needed.
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        graphite: 'rgb(var(--graphite) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        clay: 'rgb(var(--clay) / <alpha-value>)',
        moss: 'rgb(var(--moss) / <alpha-value>)',
        // Lane identity colours
        school: 'rgb(var(--school) / <alpha-value>)',
        charq: 'rgb(var(--charq) / <alpha-value>)',
        freelance: 'rgb(var(--freelance) / <alpha-value>)',
        training: 'rgb(var(--training) / <alpha-value>)',
        // Subtly warmer wash behind today's column in the week grid
        todaycol: 'rgb(var(--todaycol) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      fontSize: {
        // Named to the spec's type scale
        display: ['34px', { lineHeight: '1.1' }],
        date: ['48px', { lineHeight: '1.0' }],
        title: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['16px', { lineHeight: '1.5' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        micro: ['11px', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '0.06em' }],
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
      boxShadow: {
        // Almost invisible — the only elevation in the app.
        card: '0 1px 2px rgba(29,27,24,0.04), 0 4px 12px rgba(29,27,24,0.04)',
        sheet: '0 -1px 2px rgba(29,27,24,0.04), 0 -8px 30px rgba(29,27,24,0.08)',
        fab: '0 2px 6px rgba(29,27,24,0.12), 0 8px 24px rgba(29,27,24,0.10)',
      },
      spacing: {
        // 8px base unit; the padding steps the spec calls out
        1.5: '6px',
        18: '72px', // desktop left rail width
      },
      maxWidth: {
        content: '480px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
