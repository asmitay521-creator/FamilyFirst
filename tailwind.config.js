/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FCF6FA',
          100: '#EDE5F0',
          500: '#F52F72',
          600: '#F52F72',
          700: '#422988',
          800: '#24133F',
          900: '#211A2E',
        },
        brand: {
          DEFAULT: '#F52F72',
          light: '#FF7A59',
          dark: '#422988',
        },
        sidebarDark: '#24133F',
        sidebarStart: '#422988',
        sidebarEnd: '#CB5F8E',
        hotPink: '#F52F72',
        coralPink: '#FF6B6B',
        btnStart: '#F52F72',
        btnEnd: '#FF7A59',
        softPinkBg: '#FCF6FA',
        softLavender: '#EDE5F0',
        darkPurple: '#211A2E',
        mutedPurple: '#777080',
        freshGreen: '#35C978',
        softRed: '#FF5C7A',
        brightPurple: '#7C3AED',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
