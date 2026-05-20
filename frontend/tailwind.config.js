// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-base':        'rgb(var(--bg-base) / <alpha-value>)',
        'bg-elevated':    'rgb(var(--bg-elevated) / <alpha-value>)',
        'text-primary':   'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-tertiary':  'rgb(var(--text-tertiary) / <alpha-value>)',
        'accent':         'rgb(var(--accent) / <alpha-value>)',
        'status-success': 'rgb(var(--success) / <alpha-value>)',
        'status-warning': 'rgb(var(--warning) / <alpha-value>)',
        'status-danger':  'rgb(var(--danger) / <alpha-value>)',
      },
      borderRadius: {
        'sm':  '6px',
        'md':  '10px',
        'lg':  '14px',
        'xl':  '18px',
        '2xl': '24px',
      },
      backdropBlur: {
        'glass':    '20px',
        'glass-lg': '40px',
      },
      fontFamily: {
        sans:    ['Onest', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        orbPulse: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%':      { opacity: '0.85', transform: 'scale(1.07)' },
        },
      },
      animation: {
        'fade-in-up':    'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in':       'fadeIn 0.3s ease both',
        'scale-in':      'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'orb-pulse':     'orbPulse 9s ease-in-out infinite',
        'orb-pulse-slow':'orbPulse 14s ease-in-out infinite',
        'orb-pulse-fast':'orbPulse 6s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
