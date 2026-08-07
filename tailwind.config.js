module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        board: {
          950: '#08090b',
          900: '#0d0f12',
          850: '#121419',
          800: '#181b21',
          700: '#22262e',
          600: '#2e333d',
          500: '#454b57',
          400: '#6b7280'
        },
        flap: {
          amber: '#e8b95a',
          bone: '#e9e4d8'
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
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace']
      },
      boxShadow: {
        flap: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -6px 10px rgba(0,0,0,0.35), 0 1px 0 rgba(0,0,0,0.6)'
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.035) 1px, transparent 0)"
      }
    }
  },
  plugins: []
}
