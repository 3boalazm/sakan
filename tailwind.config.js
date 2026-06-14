/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:   '#1e3a2f',
        'primary-light': '#2d5c47',
        gold:      '#c8a84b',
        'gold-soft': '#e8d5a0',
        ink:       '#1a2318',
        'ink-muted': '#4a6358',
        surface:   '#f8f5ec',
        line:      '#e0d9cc',
        accent:    '#7c4b5b',
        'accent-soft': '#f0e8ec',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
