module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Deep neutral base the ambient background gradient sits on and glass panels blur against.
        ink: {
          950: '#050609',
          900: '#0a0c11',
          850: '#0f121a',
          800: '#151a23',
          700: '#1d2330',
          600: '#2a3242',
          500: '#5c6577',
          400: '#8891a3',
          300: '#aeb6c4',
          100: '#f2f4f8'
        },
        // Apple system-palette accents — chosen to read as saturated color through frosted glass.
        signal: {
          DEFAULT: '#0a84ff',
          dim: '#0060df'
        },
        up: {
          DEFAULT: '#32d74b',
          dim: '#1fa834'
        },
        down: {
          DEFAULT: '#ff453a',
          dim: '#d92e24'
        },
        amber: {
          DEFAULT: '#ff9f0a',
          dim: '#c97800'
        }
      },
      fontFamily: {
        sans: ['var(--font-ui)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '32px'
      }
    }
  },
  plugins: []
}
