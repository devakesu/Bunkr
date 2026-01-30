import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    env: {
      NODE_ENV: 'development',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'vitest.setup.ts',
        'vitest.config.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'supabase/**',
        'public/**',
        'scripts/**',
        '**/__tests__/**',
        '**/*.{test,spec}.*',
      ],
      include: ['src/**/*.{ts,tsx}'],
      // @ts-expect-error - 'all' is a valid runtime option but not in Vitest 4.x types
      all: true,
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 10,
        statements: 10,
      },
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'supabase', 'e2e'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
