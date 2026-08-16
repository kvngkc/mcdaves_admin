/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/vto-pipeline/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf7ee',
          100: '#f5ebd5',
          200: '#ebd6ab',
          300: '#deb977',
          400: '#d29e4b',
          500: '#c5842d',
          600: '#ab6923',
          700: '#894e1f',
          800: '#713f1f',
          900: '#5e351d',
          950: '#351b0d',
        },
      },
    },
  },
  plugins: [],
};
