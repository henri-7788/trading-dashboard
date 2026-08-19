module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090b',
          900: '#0c0d10',
          850: '#111318',
          800: '#16181d',
          700: '#1e2127',
          600: '#282c33',
          500: '#5b6270',
          400: '#828a99',
          300: '#a8afb9',
          100: '#e7e9ed'
        },
        signal: {
          DEFAULT: '#4f8cff',
          dim: '#2f5bb0'
        },
        up: {
          DEFAULT: '#3fb37f',
          dim: '#1f7a54'
        },
        down: {
          DEFAULT: '#d9564b',
          dim: '#8f3a33'
        }
      },
      fontFamily: {
        sans: ['var(--font-ui)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-data)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
