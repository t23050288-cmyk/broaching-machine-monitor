/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        machine: {
          bg: '#0a0e1a',
          panel: '#111827',
          card: '#1a2235',
          border: '#1e3a5f',
          accent: '#00d4ff',
          green: '#00ff88',
          yellow: '#ffd700',
          red: '#ff4444',
          orange: '#ff8c00',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
