/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#293735',
        panel: '#f1f2eb',
        line: '#cbd4ca',
        sage: '#587767',
        slate: '#657980'
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        paper: '0 8px 24px rgba(48, 64, 58, .06)',
        card: '0 3px 12px rgba(48, 64, 58, .04)'
      }
    }
  },
  plugins: []
};
