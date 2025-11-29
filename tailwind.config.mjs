/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F25B45',
          hover: '#E04A35',
          light: '#FEE5E2',
        }
      }
    }
  },
  plugins: []
};



