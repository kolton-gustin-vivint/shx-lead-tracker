import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@project/components': fileURLToPath(new URL('./packages/components', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API_URL,
      '/auth': API_URL,
      '/uploads': API_URL,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
