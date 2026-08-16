/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        graphite: 'rgb(var(--graphite) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        moss: 'rgb(var(--moss) / <alpha-value>)',
        school: 'rgb(var(--school) / <alpha-value>)',
        charq: 'rgb(var(--charq) / <alpha-value>)',
        freelance: 'rgb(var(--freelance) / <alpha-value>)',
        training: 'rgb(var(--training) / <alpha-value>)',
        todaycol: 'rgb(var(--todaycol) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'Arial', 'sans-serif'],
        // Kept as an alias so any stray utility resolves to the product font.
        serif: ['Roboto', 'system-ui', 'Arial', 'sans-serif'],
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.15', fontWeight: '400' }],
        date: ['44px', { lineHeight: '1.05', fontWeight: '300' }],
        title: ['20px', { lineHeight: '1.3', fontWeight: '500' }],
        body: ['16px', { lineHeight: '1.5' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        micro: ['11px', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '0.06em' }],
      },
      borderRadius: {
        card: '16px', // Material large surface
        control: '8px',
      },
      boxShadow: {
        // Google Material elevation 1 & 2
        card: '0 1px 2px rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)',
        sheet: '0 -1px 3px rgba(60,64,67,0.15), 0 -8px 24px rgba(60,64,67,0.20)',
        fab: '0 1px 3px rgba(60,64,67,0.30), 0 4px 8px 3px rgba(60,64,67,0.15)',
      },
      spacing: {
        1.5: '6px',
        18: '72px',
      },
      maxWidth: {
        content: '480px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
}
