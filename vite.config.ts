import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':      r('src'),
      '@api':   r('src/services'),
      '@hooks': r('src/hooks'),
      '@pages': r('src/pages'),
      '@comps': r('src/components'),
      '@store': r('src/store'),
      '@utils': r('src/utils'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:      'https://insumitrafinal-20072026.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
