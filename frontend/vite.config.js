// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: true,
    proxy: {
      // En développement local, /api est redirigé vers le backend
      '/api': 'http://localhost:5001',
    },
  },
});
