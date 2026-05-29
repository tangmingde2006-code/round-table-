/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        indigo: {
          950: '#1a1a2e',
          900: '#16213e',
        },
        gold: {
          50: '#f5f0e8',
          100: '#e8e0d0',
          200: '#d4c9a8',
          300: '#d4a843',
          400: '#c49a38',
          500: '#b08a30',
          600: '#8a6d26',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
