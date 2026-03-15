/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page:            '#F5F5F0',
        surface:         '#FFFFFF',
        'surface-hover': '#F5F5F0',
        'user-bubble':   '#DDD9CE',
        'text-primary':  '#1A1A18',
        'text-secondary':'#6B6A68',
        'text-muted':    '#9A9893',
        accent: {
          DEFAULT: '#AE5630',
          hover:   '#C4633A',
          active:  '#963E22',
        },
        success:         '#1D9E75',
        error:           '#D85A30',
        info:            '#534AB7',
      },
      borderColor: {
        DEFAULT: 'rgba(0, 0, 0, 0.08)',
        strong:  'rgba(0, 0, 0, 0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '16px',
      },
      boxShadow: {
        'soft':    '0 2px 8px rgba(0, 0, 0, 0.06)',
        'dropdown':'0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    }
  },
  plugins: []
}
