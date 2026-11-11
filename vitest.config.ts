import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/domain/src/**/*.ts',
        'apps/api/src/{app,auth,store,service,routes,reports,portability,offline,report-language,planning,timesheets,time-slices}.ts',
        'apps/api/src/integrations/{ai,mcp}.ts',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
