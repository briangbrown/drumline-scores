import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/**/*.tsx',
        'src/main.tsx',
        'src/import.ts',
        'src/data.ts',
        'src/hooks/**',
        'src/pipeline/cli/**',
        'src/pipeline/commit.ts',
        'src/pipeline/pollerCron.ts',
        'src/pipeline/reportIssue.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
