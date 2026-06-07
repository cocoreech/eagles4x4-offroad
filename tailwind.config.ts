import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        secondary: 'var(--color-secondary)',
        'text-primary': 'var(--color-text-primary)',
        'text-muted': 'var(--color-text-muted)',
        destructive: 'var(--color-destructive)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.65' }],
        lg:   ['1.125rem', { lineHeight: '1.65' }],
        xl:   ['1.25rem',  { lineHeight: '1.65' }],
        '2xl':['1.5rem',   { lineHeight: '1.15' }],
        '3xl':['1.875rem', { lineHeight: '1.15' }],
        '4xl':['2.25rem',  { lineHeight: '1.15' }],
        '5xl':['3rem',     { lineHeight: '1.1' }],
        '6xl':['3.75rem',  { lineHeight: '1.05' }],
        '7xl':['4.5rem',   { lineHeight: '1.0' }],
        '8xl':['6rem',     { lineHeight: '0.95' }],
        '9xl':['8rem',     { lineHeight: '0.9' }],
      },
      transitionDuration: {
        fast:  '150ms',
        base:  '250ms',
        slow:  '400ms',
        xslow: '700ms',
      },
      transitionTimingFunction: {
        entrance: 'cubic-bezier(0, 0, 0.2, 1)',
        exit:     'cubic-bezier(0.4, 0, 1, 1)',
        loop:     'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient':
          'linear-gradient(135deg, #0C0D0A 0%, #161A12 40%, #1a2010 100%)',
        'gold-gradient':
          'linear-gradient(135deg, #D4A017 0%, #F0BA25 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up':  'fade-up 0.6s cubic-bezier(0, 0, 0.2, 1) forwards',
        'fade-in':  'fade-in 0.4s ease-out forwards',
        shimmer:    'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
