export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        uber: {
          black: '#000000',
          dark: '#121212',
          card: '#1e1e1e',
          cardHover: '#292929',
          gray: '#757575',
          lightGray: '#f6f6f6',
          accent: '#276ef1',
          green: '#06c167',
        }
      },
    },
  },
  plugins: [],
}
