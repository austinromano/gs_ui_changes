import tokens from './tokens.json';

const preset = {
  theme: {
    extend: {
      colors: {
        ghost: tokens.colors,
      },
      boxShadow: {
        'popup': '0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(120,40,200,0.06)',
        'glow-green': '0 0 24px rgba(0, 255, 200, 0.12)',
        'glow-purple': '0 0 24px rgba(124, 58, 237, 0.12)',
      },
      fontFamily: {
        sans: ['gg sans', 'Noto Sans', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Consolas', 'Andale Mono WT', 'Andale Mono', 'monospace'],
      },
      borderRadius: {
        sm: tokens.radii.sm,
        md: tokens.radii.md,
        lg: tokens.radii.lg,
        xl: '12px',
        '2xl': '16px',
        full: tokens.radii.full,
      },
      fontSize: {
        xs: tokens.fontSizes.xs,
        sm: tokens.fontSizes.sm,
        md: tokens.fontSizes.md,
        lg: tokens.fontSizes.lg,
        xl: tokens.fontSizes.xl,
        '2xl': tokens.fontSizes.xxl,
      },
    },
  },
};

export default preset;
