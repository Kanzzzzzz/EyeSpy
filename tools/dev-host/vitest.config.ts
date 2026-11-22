import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'dev-host', include: ['test/**/*.test.ts'], testTimeout: 120_000 },
});
