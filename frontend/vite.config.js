// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En développement local, /api est redirigé vers le backend
      '/api': 'http://localhost:3001',
    },
  },
});
