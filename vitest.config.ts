import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    exclude: ['tests/eval/**'],
    // Use different environments based on test location
    environmentMatchGlobs: [
      ['tests/unit/**', 'node'],
      ['tests/component/**', 'happy-dom']
    ],
    setupFiles: ['./tests/component/setup.ts'],
    coverage: {
      reporter: ['text', 'json'],
      include: ['src/main/**/*.ts', 'src/renderer/**/*.tsx'],
      exclude: ['src/main/index.ts', 'src/main/window.ts', '**/*.d.ts']
    }
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
