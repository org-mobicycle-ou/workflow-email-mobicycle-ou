/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#090a10',
        'dark-panel': '#12131a',
        'dark-header': '#0d0e14',
        'dark-border': '#2a2b35',
        'dark-border-light': '#1e1f2a',
        'dark-text': '#d0d0d5',
        'dark-text-muted': '#888',
        'dark-text-subtle': '#555',
        'accent-blue': '#7cb5ec',
        'accent-green': '#52c41a',
        'accent-yellow': '#faad14',
        'accent-purple': '#d17bcc',
        'accent-red': '#ff4d4f',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}