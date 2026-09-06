/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        retro: {
          dark: '#121019',
          card: '#1e1a29',
          panel: '#282238',
          border: '#3c3452',
          primary: '#ff3366',
          purple: '#9933ff',
          cyan: '#00f0ff',
          yellow: '#ffcc00',
          green: '#00ff66',
          orange: '#ff5500',
          warm: '#f4efe6',
          text: '#282238',
        },
      },
      fontFamily: {
        arcade: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        retro: '0 4px 14px 0 rgba(255, 51, 102, 0.25)',
        'retro-neon': '0 0 20px rgba(0, 240, 255, 0.35)',
      },
    },
  },
  plugins: [],
};
