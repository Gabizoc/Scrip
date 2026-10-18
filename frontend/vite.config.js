import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Lit le .env a la racine du repo (le meme que le backend)
  const env = loadEnv(mode, resolve(__dirname, '..'), '');
  const backendPort = env.PORT ?? 5001;

  return {
    plugins: [react()],
    server: {
      port: 5000,
      host: true,
      proxy: {
        // En développement local, /api est redirigé vers le backend
        '/api': `http://localhost:${backendPort}`,
      },
    },
  };
});
