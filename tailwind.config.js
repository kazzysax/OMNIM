/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        omnim: {
          bg: '#0B0C10',
          card: '#16181E',
          cardElevated: '#1F222B',
          border: 'rgba(255, 255, 255, 0.08)',
          gold: '#E5B887',
          goldLight: '#F7D6B5',
          goldDark: '#B88755',
          text: '#F3F4F6',
          muted: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 25px -5px rgba(229, 184, 135, 0.25)',
        'card-dark': '0 10px 30px -10px rgba(0, 0, 0, 0.6)',
      }
    },
  },
  plugins: [],
}

