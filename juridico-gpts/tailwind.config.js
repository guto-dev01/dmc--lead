/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta "Precision" do ImobPro (travada)
        brand: {
          cyan: '#12e7ff',
          green: '#00ff6a',
          amber: '#f59e0b',
        },
        teal: {
          bg: '#071417',
          muted: '#0e2528',
          surface: '#0d2427',
          deep: '#08262a',
        },
        ink: {
          DEFAULT: '#ffffff',
          muted: '#c9e9ee',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #12e7ff, #00ff6a)',
      },
      boxShadow: {
        'glow-cyan': '0 0 22px rgba(18, 231, 255, 0.35)',
        'glow-green': '0 0 22px rgba(0, 255, 106, 0.30)',
        card: '0 8px 24px -8px rgba(0, 0, 0, 0.45)',
        'card-lg': '0 24px 60px -24px rgba(0, 0, 0, 0.6)',
      },
      borderColor: {
        neon: 'rgba(18, 231, 255, 0.14)',
        'neon-strong': 'rgba(18, 231, 255, 0.28)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
