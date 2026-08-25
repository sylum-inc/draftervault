import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// SINGLE_FILE=true produces one self-contained bundle (see scripts/build-single.mjs)
const singleFile = process.env.SINGLE_FILE === 'true';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: singleFile ? 'dist-single' : 'dist',
    // Enable source maps for error tracking
    sourcemap: singleFile ? false : mode === 'production' ? 'hidden' : true,
    // Inline every asset when building the standalone single-file bundle
    assetsInlineLimit: singleFile ? Number.MAX_SAFE_INTEGER : 4096,
    cssCodeSplit: !singleFile,
    // Optimize chunk sizes
    rollupOptions: {
      output: singleFile
        ? {
            // One chunk, no dynamic imports, so the whole app can be inlined
            inlineDynamicImports: true,
            entryFileNames: 'app.js',
            assetFileNames: 'app.[ext]',
          }
        : {
            manualChunks: {
              // Vendor chunks
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'ui-vendor': [
                '@radix-ui/react-dialog',
                '@radix-ui/react-dropdown-menu',
                '@radix-ui/react-tabs',
                '@radix-ui/react-tooltip',
                '@radix-ui/react-select',
                '@radix-ui/react-scroll-area',
                '@radix-ui/react-slider',
                '@radix-ui/react-switch',
              ],
              charts: ['recharts'],
              forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
              query: ['@tanstack/react-query'],
            },
          },
    },
    // Increase warning limit for main chunk
    chunkSizeWarningLimit: 500,
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}));
