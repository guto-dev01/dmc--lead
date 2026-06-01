/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          cyan: '#00e7fc',
          green: '#00ff4d',
        },
        teal: {
          bg: '#0a2a2e',
          surface: '#143e42',
          deep: '#08262a',
        },
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #00e7fc, #00ff4d)',
      },
      boxShadow: {
        'glow-cyan': '0 0 22px rgba(0, 231, 252, 0.35)',
        'glow-green': '0 0 22px rgba(0, 255, 77, 0.30)',
      },
    },
  },
  plugins: [],
};
