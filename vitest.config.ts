import { defineConfig } from 'vitest/config';

// Many tests run Divinum Officium's engine, and some build a whole day or month;
// on a shared build machine (GitHub Actions) that can take well over the default 5 s.
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
