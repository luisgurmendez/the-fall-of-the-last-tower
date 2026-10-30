import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '',
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@siege/shared': path.resolve(__dirname, './packages/shared/src'),
      '@siege/client': path.resolve(__dirname, './packages/client/src'),
    },
  },
  build: {
    minify: true,
    target: 'es2020',
    modulePreload: { polyfill: false },
    assetsDir: 'assets',
  },
});
