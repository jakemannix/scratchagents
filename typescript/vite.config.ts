import { defineConfig } from 'vite';

export default defineConfig({
  // Base public path - adjust if deploying to a subdirectory
  base: './',

  // Development server configuration
  server: {
    port: 5173,
    open: true, // Auto-open browser
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
