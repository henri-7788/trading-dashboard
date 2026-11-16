module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Cool, faintly teal-tinted neutrals — page ground, card fills, hairlines, and text.
        // Conventional scale: 50 is the lightest surface, 900 the primary text.
        ink: {
          50: '#f7f9f9',
          100: '#eef1f2',
          150: '#e6eaeb',
          200: '#dde3e5',
          300: '#c4cdd0',
          400: '#94a2a7',
          500: '#6b7a80',
          600: '#4c5c62',
          700: '#33434a',
          800: '#1f2f36',
          900: '#10212a',
          950: '#08161c'
        },
        // Deep petrol — the hero band, primary actions, and every chart mark.
        teal: {
          50: '#eff6f7',
          100: '#dceaee',
          200: '#bcd6de',
          300: '#8fb9c6',
          400: '#5e97a9',
          500: '#3b7b90',
          600: '#266579',
          700: '#1a5366',
          800: '#134456',
          900: '#0d3646',
          950: '#082733'
        },
        up: {
          DEFAULT: '#1d8556',
          soft: '#e3f3ea'
        },
        down: {
          DEFAULT: '#c4463c',
          soft: '#fbe9e7'
        },
        amber: {
          DEFAULT: '#b4740f',
          soft: '#fbf0dc'
        }
      },
      fontFamily: {
        sans: ['var(--font-ui)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 33, 42, 0.04), 0 8px 24px -12px rgba(16, 33, 42, 0.10)',
        float: '0 18px 40px -18px rgba(8, 39, 51, 0.45)'
      }
    }
  },
  plugins: []
}
