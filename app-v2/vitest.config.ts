import path from 'node:path';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

function mockStaticAssets(): Plugin {
  return {
    name: 'mock-static-assets',
    resolveId(source) {
      if (/\.(png|jpe?g|gif|webp)$/i.test(source)) {
        return source;
      }

      return null;
    },
    load(id) {
      if (/\.(png|jpe?g|gif|webp)$/i.test(id)) {
        return 'module.exports = "test-asset";';
      }

      return null;
    },
  };
}

export default defineConfig({
  plugins: [mockStaticAssets()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
