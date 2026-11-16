/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  corePlugins: { preflight: true },
  theme: {
    extend: {
      colors: {
        sci: {
          blue: '#2563eb',
          indigo: '#4f46e5',
          cyan: '#0891b2',
          teal: '#0d9488',
          ink: '#0f172a',
          muted: '#64748b',
          line: '#e6ebf3',
          canvas: '#f7f9fc',
          wash: '#f1f5fb'
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['Manrope', 'DM Sans', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,.04), 0 10px 30px -14px rgba(15,23,42,.14)',
        card: '0 1px 2px rgba(15,23,42,.03), 0 18px 45px -24px rgba(15,23,42,.18)',
        lift: '0 2px 4px rgba(15,23,42,.04), 0 24px 55px -20px rgba(37,99,235,.22)',
        glow: '0 0 0 1px rgba(37,99,235,.08), 0 18px 45px -18px rgba(37,99,235,.32)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        }
      },
      animation: {
        'fade-up': 'fade-up .6s cubic-bezier(.22,1,.36,1) both',
        floaty: 'floaty 7s ease-in-out infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        shimmer: 'shimmer 2.6s linear infinite'
      }
    }
  },
  plugins: []
}
