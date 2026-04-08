import type { Config } from 'tailwindcss';
import ghostPreset from '@ghost/tokens/tailwind-preset';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [ghostPreset as any],
  plugins: [],
} satisfies Config;
