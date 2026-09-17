/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        surface: '#f5f5f5',
        'surface-dark': '#0a0a0a',
        border: '#e0e0e0',
        'border-dark': '#1f1f1f',
        primary: '#0a0a0a',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
}
