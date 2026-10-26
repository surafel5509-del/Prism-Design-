import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        panel: { DEFAULT: 'hsl(var(--panel))', 2: 'hsl(var(--panel-2))' },
        violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
        cyan: { 400: '#22d3ee', 500: '#06b6d4' },
        magenta: { 400: '#e879f9', 500: '#d946ef' },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)', xl: 'calc(var(--radius) + 4px)' },
      backgroundImage: {
        prism: 'linear-gradient(120deg, #8b5cf6 0%, #22d3ee 50%, #e879f9 100%)',
        'prism-soft': 'linear-gradient(120deg, rgba(139,92,246,.18) 0%, rgba(34,211,238,.14) 50%, rgba(232,121,249,.18) 100%)',
        'grid-fade': 'radial-gradient(circle at 50% 0%, rgba(139,92,246,.12), transparent 60%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,.35), 0 8px 32px -8px rgba(139,92,246,.55)',
        panel: '0 1px 0 0 rgba(255,255,255,.04) inset, 0 12px 40px -12px rgba(0,0,0,.6)',
        float: '0 24px 70px -20px rgba(0,0,0,.7)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(139,92,246,.5)' }, '100%': { boxShadow: '0 0 0 12px rgba(139,92,246,0)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.16,1,.3,1) both',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
