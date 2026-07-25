// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',

    // Or if using `src` directory:
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#333333', // Dark grey as a lighter variant of black
          DEFAULT: '#000000', // Black
          dark: '#0A0A0A' // Even darker black
        },
        secondary: {
          light: '#87CEEB', // Light sky blue
          DEFAULT: '#00BFFF', // Sky blue shiny
          dark: '#1E90FF' // Dark sky blue
        },
        info: {
          light: '#87CEFA', // Light sky blue
          DEFAULT: '#00BFFF', // Sky blue shiny
          dark: '#1E90FF' // Dark sky blue
        },
        success: {
          light: '#87CEFA', // Light sky blue (for consistency)
          DEFAULT: '#00BFFF', // Sky blue shiny
          dark: '#1E90FF' // Dark sky blue
        },
        warning: {
          light: '#FAB833', // Keeping warning as is
          DEFAULT: '#F9A600', // Keeping warning as is
          dark: '#C78500' // Keeping warning as is
        },
        error: {
          light: '#E5342F', // Keeping error as is
          DEFAULT: '#E5342F', // Keeping error as is
          dark: '#B72A26' // Keeping error as is
        },
        grey: {
          0: '#FFFFFF', // White
          100: '#F9FAFB', // Light grey
          200: '#F4F6F8', // Slightly darker grey
          300: '#DFE3E8', // Neutral grey
          400: '#C4CDD5', // Mid grey
          500: '#919EAB', // Grey with blueish tint
          600: '#637381', // Darker grey
          700: '#454F5B', // Even darker grey
          800: '#212B36', // Darkest grey
          900: '#161C24' // Almost black
        }
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(145.42deg, #F7A93F, #2288EB 120%)',
        'gradient-info': 'linear-gradient(145.42deg, #85D3F0, #33B5E6 120%)',
        'gradient-background': 'radial-gradient(#DBEAFF, #F3DFE0, #DBCFF3, #DBEAFF)',
        'gradient-success': 'linear-gradient(145.42deg, #7DDAC0, #26C196 120%)',
        'gradient-warning': 'linear-gradient(145.42deg, #FAB833, #F9A600 120%)',
        'gradient-error': 'linear-gradient(145.42deg, #E5342F, #B72A26 120%)'
      }
    }
  },
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
  daisyui: {
    themes: [
      {
        customtheme: {
          primary:    '#F7A93F',
          secondary:  '#2288EB',
          accent:     '#85D3F0',
          neutral:    '#212B36',
          'base-100': '#F9FAFB',
          info:       '#33B5E6',
          success:    '#26C196',
          warning:    '#F9A600',
          error:      '#E5342F'
        }
      }
    ]
  }
};
