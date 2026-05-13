// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // toggle via classe .dark sur <html>
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
        'sm':  '8px',
        'md':  '14px',
        'lg':  '20px',
        'xl':  '28px',
        '2xl': '36px',
      },
      backdropBlur: {
        'glass': '24px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
