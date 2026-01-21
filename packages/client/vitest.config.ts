import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@siege/shared': resolve(__dirname, '../shared/src'),
    },
  },
});
