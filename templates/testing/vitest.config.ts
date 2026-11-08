// vitest.config.ts
// Unit and integration test configuration. Lives at the project root.
// Copied from `templates/testing/` in the project template — edit freely once copied.
//
// Rename this file to `vitest.config.mts` if Vite warns that ESM syntax is being
// loaded as CommonJS — a Next.js `package.json` has no `"type": "module"`, which
// is what triggers it. The contents do not change.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Native tsconfig `paths` resolution — resolves the Next.js `@/` alias with
    // no plugin and no second copy of the alias map to drift out of step.
    // On an older Vite, delete this and use the `vite-tsconfig-paths` plugin.
    tsconfigPaths: true,
  },

  test: {
    // Pure functions and server logic — `node`, not `jsdom`. Switch to `jsdom`
    // only when component tests are added; it materially slows a node-only suite.
    environment: 'node',
    globals: false,

    // --- Playwright coexistence ------------------------------------------
    // Vitest's default `include` matches `*.spec.ts`, which is Playwright's
    // extension, and Vitest 4 narrowed the default `exclude` to node_modules and
    // .git only. On defaults, Vitest WILL try to run the Playwright specs and
    // fail on the `@playwright/test` import.
    // Convention: `*.test.ts` is Vitest, `*.spec.ts` is Playwright.
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],

    // Setting `exclude` REPLACES the defaults, so node_modules and .git are re-listed.
    exclude: ['**/node_modules/**', '**/.git/**', '**/.next/**', 'e2e/**', '**/*.spec.ts'],
    // ---------------------------------------------------------------------

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],

      // Required on Vitest 4: `coverage.all` was removed, so without an explicit
      // `include` only files imported during the run are counted — an untested
      // file in `lib/` would be invisible and the coverage figure a flattering lie.
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.d.ts', 'lib/constants/**'],

      reportsDirectory: './coverage',

      // Starting point, not a mandate. Agree the real target during onboarding
      // and record it in `docs/general_docs/TECH_STACK.md`.
      //
      // These are ENFORCED, not advisory: Vitest exits non-zero when a threshold
      // is missed, and the CI `quality` job runs `pnpm test:coverage`. A young
      // project whose `lib/` holds mostly untested modules therefore goes red on
      // its first pull request. Set these to what `lib/` reaches today and raise
      // them as tested modules land; never comment the block out
      // (docs/general_docs/TESTING_STANDARDS.md, Coverage).
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
