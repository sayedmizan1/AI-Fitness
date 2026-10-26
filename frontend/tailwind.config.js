/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        dark: {
          900: '#030712',
          800: '#0d1117',
          700: '#161b27',
          600: '#1c2333',
          500: '#21262d',
          400: '#30363d',
          300: '#484f58',
        },
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #0d1117 0%, #1a0533 50%, #0d1117 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        'brand-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'accent-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        'glow-green': 'radial-gradient(circle at center, rgba(34,197,94,0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          from: { boxShadow: '0 0 20px rgba(34,197,94,0.3)' },
          to: { boxShadow: '0 0 40px rgba(34,197,94,0.6)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-green': '0 0 30px rgba(34, 197, 94, 0.3)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
