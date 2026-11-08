// playwright.config.ts
// End-to-end test configuration. Lives at the project root.
// Copied from `templates/testing/` in the project template — edit freely once copied.

// ENVIRONMENT LOADING — THIS MUST STAY AT THE TOP OF THE FILE.
//
// Playwright evaluates this config in the main process AND again in every worker
// process, so it is the one place a load reaches every process the suite runs in.
//
// It has to be here rather than anywhere else. `e2e/support/auth.ts` reads
// `E2E_[ROLE]_EMAIL` and `E2E_USER_PASSWORD` at MODULE scope to build
// `TEST_USERS`, and that module is evaluated the instant Playwright loads
// `e2e/support/auth.setup.ts` — before any test body runs. `clerkSetup({ dotenv })`
// cannot cover it: that call lives in a test body and in a worker fixture, both
// of which run after module evaluation. Without the load below, every test-user
// address is `undefined`, the `setup` project signs in as an account nobody
// created, and `flows`, `permissions` and `a11y` are all skipped because each
// declares `dependencies: ['setup']` — the first `pnpm test:e2e` of the project's
// life reports a wholly skipped run.
//
// `.env.local` is listed first and therefore wins: dotenv never overwrites a
// variable that is already set, so CI-injected values still beat any file on disk.
// Missing files are ignored, so a project with neither file still runs.
// Named import — dotenv declares no default export. A default import type-checks
// only where `esModuleInterop` is enabled, which is not guaranteed in every project.
import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// First statement in the file, before any value below is derived from the
// environment and long before Playwright loads a single spec module.
// `quiet` suppresses dotenv's injection banner, which would otherwise print
// once per worker process on every run.
loadEnv({ path: ['.env.local', '.env'], quiet: true });

// Treat an empty variable as unset. `.env.example` ships these keys with empty
// values and the documented first step is `cp .env.example .env.local`, so after
// the load above every unfilled key is `''` rather than `undefined`. `??` does
// not fall back on an empty string — `||` does.
const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const PORT = Number(env('PORT') ?? 3000);

// Set `E2E_BASE_URL` to run the suite against a deployed URL instead of a local
// server. Left unset or empty, Playwright starts the app itself via `webServer` below.
const remoteBaseURL = env('E2E_BASE_URL');
const baseURL = remoteBaseURL ?? `http://localhost:${PORT}`;
const usingRemote = Boolean(remoteBaseURL);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',

  // Only `*.spec.ts` belongs to Playwright. `*.test.ts` belongs to Vitest —
  // without this the two runners collect each other's files.
  testMatch: '**/*.spec.ts',

  outputDir: './test-results',

  // Split work at the individual-test level, so sharded CI runs stay balanced.
  fullyParallel: true,

  // Fail the build if a `test.only` was left in the source.
  forbidOnly: isCI,

  retries: isCI ? 2 : 0,

  // Default is half the logical cores. A percentage string is supported.
  workers: isCI ? '50%' : undefined,

  timeout: 30_000,
  expect: { timeout: 5_000 },

  // HTML on CI, so the uploaded artefact is readable on its own, plus the GitHub
  // annotations reporter. Switch to `'blob'` only alongside a `--shard` matrix
  // and a `playwright merge-reports` job — a blob report from a single unsharded
  // run is an unmergeable zip and nothing can open it.
  reporter: isCI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL,
    trace: 'on-first-retry', // cheap locally, full trace on the retry that matters
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Projects are split by DIRECTORY, never by filename. Each project collects a
  // plain `**/*.spec.ts` under its own directory, so what decides whether a spec
  // runs is where it sits: `e2e/specs/`, `e2e/permissions/` or `e2e/a11y/`. A
  // spec placed anywhere else under `e2e/` belongs to no project and never runs,
  // and Playwright exits 0 on an uncollected file — so the suite reports green
  // with that spec's coverage entirely absent. Filenames are a naming convention
  // that keeps flow ids and files in step; they are not the collection mechanism.
  //
  // NO PROJECT SETS A DEFAULT `storageState`. A spec therefore runs SIGNED OUT
  // unless it opts in at file level:
  //
  //   test.use({ storageState: storageStateFor('ADMIN') });
  //
  // That is fail-closed: forgetting the line produces a signed-out run that
  // fails loudly, rather than a privileged session that proves nothing.
  projects: [
    // 1. Authentication. Runs first; writes one storage-state file per role.
    //    Every other project declares `dependencies: ['setup']`, including the
    //    ones whose specs are signed out — the dependency is not what confers a
    //    session, it is what runs `clerkSetup()` and puts `CLERK_FAPI` and
    //    `CLERK_TESTING_TOKEN` in the environment. Without them a signed-out
    //    spec hitting the auth provider's Frontend API trips bot detection.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // 2. Flow specs — one directory per `CORE_FLOWS.md` area, written by the
    //    `test-author` skill as `e2e/specs/[area]/[flow-id]-[short-slug].spec.ts`.
    //    No role infix: the role is declared inside the file with `test.use()`.
    {
      name: 'flows',
      testDir: './e2e/specs',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // 3. The permission matrix. It switches role per describe block with
    //    `test.use({ storageState })`.
    {
      name: 'permissions',
      testDir: './e2e/permissions',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // 4. Accessibility scans. Kept separate so `test:a11y` is one command.
    {
      name: 'a11y',
      testDir: './e2e/a11y',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  // Playwright starts the application itself. This is what makes E2E runnable in
  // CI without waiting for a preview deployment — see `github-workflow-test.yml`.
  // Skipped entirely when `E2E_BASE_URL` points at an already-running deployment.
  webServer: usingRemote
    ? undefined
    : {
        // Run against the production build on CI, as the Next.js docs recommend.
        // CI runs `pnpm build` as its own step so the build is not inside this timeout.
        command: isCI ? 'pnpm start' : 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        stdout: 'pipe', // default is 'ignore' — server logs are worth having on a failure
        stderr: 'pipe',
      },
});
