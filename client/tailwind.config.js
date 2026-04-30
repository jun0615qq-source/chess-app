/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 체스 보드 색상 팔레트
        board: {
          green: { light: '#eeeed2', dark: '#769656' },
          brown: { light: '#f0d9b5', dark: '#b58863' },
          blue:  { light: '#dee3e6', dark: '#8ca2ad' },
        },
        // 티어 색상
        tier: {
          bronze:   '#cd7f32',
          silver:   '#c0c0c0',
          gold:     '#ffd700',
          platinum: '#e5e4e2',
          diamond:  '#b9f2ff',
        },
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 50%, 90%': { transform: 'translateX(-8px)' },
          '30%, 70%': { transform: 'translateX(8px)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
