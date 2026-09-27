/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Restrained, premium palette. Ink for text, slate for structure,
        // a single muted accent — no gradients, no decoration.
        ink: {
          DEFAULT: '#14161a',
          soft: '#3d434d',
          muted: '#6b7280',
        },
        paper: {
          DEFAULT: '#ffffff',
          sunken: '#f7f7f8',
          raised: '#fcfcfd',
        },
        accent: {
          DEFAULT: '#1f3a5f',
          soft: '#e8edf4',
          ring: '#3d6293',
        },
        approve: { DEFAULT: '#1f5136', soft: '#e7f2ec' },
        reject: { DEFAULT: '#7a2c26', soft: '#fbeceb' },
        caution: { DEFAULT: '#7a5620', soft: '#fdf3e3' },
      },
      fontFamily: {
        // Serif display is a deliberate nod to the product's own subject matter.
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,22,26,0.04), 0 1px 3px rgba(20,22,26,0.06)',
        raised: '0 2px 4px rgba(20,22,26,0.05), 0 8px 24px rgba(20,22,26,0.07)',
      },
      borderRadius: { xl: '0.625rem', '2xl': '0.875rem' },
    },
  },
  plugins: [],
};
