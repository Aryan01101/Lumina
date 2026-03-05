import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/eval/**'],
    coverage: {
      reporter: ['text', 'json'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/main/window.ts']
    }
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main')
    }
  }
})
