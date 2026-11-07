import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Override with API_PROXY_TARGET when the API runs on another port.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});
