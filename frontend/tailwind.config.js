/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ClientOS design tokens.
        //
        // Neutrals carry the interface: a warm off-white canvas, white surfaces,
        // charcoal ink. Colour is reserved for meaning, and there are only four:
        //   memory  — green. Client memory, grounding, approvals, success.
        //   accent  — slate blue. Interaction, selection, focus, a decision to make.
        //   caution — amber. Constraints, superseded history, unconfirmed changes.
        //   reject  — brick. Rejections and genuine failures.
        canvas: '#f7f6f3',
        ink: {
          DEFAULT: '#1b1d21',
          soft: '#41454d',
          muted: '#65686f',
          faint: '#9b9da3',
        },
        paper: {
          DEFAULT: '#ffffff',
          sunken: '#f3f2ee',
          raised: '#fbfaf8',
        },
        line: {
          DEFAULT: '#e5e2da',
          strong: '#d5d1c7',
          soft: '#eeece6',
        },
        memory: {
          DEFAULT: '#1d6a4c',
          strong: '#15523a',
          soft: '#eaf4ee',
          line: '#c3dfcf',
          bright: '#3f9e76',
        },
        accent: {
          DEFAULT: '#2d4f86',
          soft: '#edf2fa',
          line: '#c7d5ec',
          ring: '#5178b8',
        },
        // Approval shares the memory hue on purpose: an approval is the client
        // confirming something ClientOS should keep doing.
        approve: { DEFAULT: '#1d6a4c', soft: '#eaf4ee', line: '#c3dfcf' },
        reject: { DEFAULT: '#a13a2f', soft: '#fbefed', line: '#eecdc7' },
        caution: { DEFAULT: '#87580f', soft: '#fcf4e4', line: '#ead6ac' },
      },
      fontFamily: {
        // A serif for the product's own voice — page titles and the
        // recommendation itself — and a neutral sans for everything else.
        display: ['"Source Serif 4"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: [
          'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto',
          '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Tiny labels and metadata.
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.625rem',
        '2xl': '0.75rem',
      },
      boxShadow: {
        // Elevation is mostly border and contrast; shadows only hint at it.
        card: '0 1px 2px rgba(31, 27, 18, 0.04)',
        raised: '0 1px 2px rgba(31, 27, 18, 0.04), 0 6px 16px -6px rgba(31, 27, 18, 0.10)',
        overlay: '0 2px 6px rgba(31, 27, 18, 0.06), 0 18px 48px -12px rgba(31, 27, 18, 0.28)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'drawer-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        // An indeterminate bar: says "working", claims nothing about progress.
        indeterminate: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(300%)' },
        },
        'status-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.45' },
          '70%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'dialog-in': 'dialog-in 180ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'drawer-in': 'drawer-in 200ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'overlay-in': 'overlay-in 160ms ease-out both',
        indeterminate: 'indeterminate 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'status-ring': 'status-ring 2.6s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
