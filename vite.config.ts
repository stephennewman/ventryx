import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log(`Building for ${mode} mode`);
  console.log(`Plaid environment: ${env.VITE_PLAID_ENV || 'Not set'}`);

  return {
    // Vite config
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: './index.html'
        }
      },
      copyPublicDir: true
    },
    server: {
      port: 5173,
    },
    // Make env variables available to client code
    define: {
      // Ensure proper environment variables are exposed
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_PLAID_ENV': JSON.stringify(env.VITE_PLAID_ENV),
    }
  };
}); 