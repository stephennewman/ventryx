import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Ensure this points to the correct folder for build output
    rollupOptions: {
      input: {
        main: './index.html'
      },
      external: ['vite']
    },
    copyPublicDir: true
  },
  server: {
    port: 5173,  // Ensure this port works locally
  },
});
