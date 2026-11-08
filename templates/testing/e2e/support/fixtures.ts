// e2e/support/fixtures.ts
// The merged Playwright test fixture. Every spec imports `test` and `expect`
// from here — never from `@playwright/test` directly.
// Copied from `templates/testing/` in the project template — edit freely once copied.
//
// One import point means a fixture added here reaches every spec without a
// codemod. Helper modules may still import `expect` from `@playwright/test`;
// the rule applies to specs.

import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as base, expect } from '@playwright/test';
import { runA11yScan } from './a11y';
import type { A11yScanOptions } from './a11y';

type WorkerFixtures = {
  /** Guarantees `CLERK_FAPI` and `CLERK_TESTING_TOKEN` exist in THIS worker process. */
  clerkTestingEnv: void;
};

type TestFixtures = {
  /** Installs the Testing Token on this test's browser context. */
  clerkTestingToken: void;

  /**
   * Scan the current page for WCAG 2.1 AA violations and fail on anything unwaived.
   * Navigate and wait for the page to settle before calling it — scanning a
   * half-hydrated page produces inconsistent results.
   */
  a11yScan: (options?: A11yScanOptions) => Promise<void>;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ------------------------------------------- provider-specific: Clerk
  // Both fixtures below are the Clerk seam. A project on another auth provider
  // deletes them and the `@clerk/testing/playwright` import; nothing else in the
  // suite changes.

  clerkTestingEnv: [
    async ({}, use) => {
      // Defensive. The setup project sets these in its own worker process, and
      // Playwright usually reuses that worker — but "usually" is not a
      // guarantee under `workers: '50%'` or a sharded run, and a fresh worker
      // without them fails with "The Clerk Frontend API URL is required".
      // Minting a token is one cheap backend call, and `clerkSetup()` reuses an
      // existing `CLERK_TESTING_TOKEN` rather than minting a second one.
      if (!process.env.CLERK_FAPI || !process.env.CLERK_TESTING_TOKEN) {
        // `dotenv` defaults to true and loads `.env.local` then `.env`. Disable
        // it on CI so CI-injected variables win over any committed file.
        await clerkSetup({ dotenv: !process.env.CI });
      }
      await use();
    },
    { scope: 'worker', auto: true },
  ],

  clerkTestingToken: [
    async ({ context }, use) => {
      // The auth provider runs bot detection on its Frontend API and an
      // automated browser trips it. This registers a route handler that appends
      // the Testing Token to every Frontend API request on this context.
      //
      // It matters most for SIGNED-OUT specs — a spec that does not call
      // `test.use({ storageState: ... })` has no session, so nothing else has
      // installed the token for it. The call is de-duplicated per context by the
      // library, so applying it to every test costs nothing.
      //
      // Worker-scoped auto fixtures run before test-scoped ones, so
      // `clerkTestingEnv` has already guaranteed `CLERK_FAPI` by this point.
      await setupClerkTestingToken({ context });
      await use();
    },
    { auto: true },
  ],

  // --------------------------------------------------- provider-agnostic

  a11yScan: async ({ page }, use) => {
    await use((options?: A11yScanOptions) => runA11yScan(page, options));
  },
});

export { expect };

// Re-exported so a spec needs one import line for the permission assertions too.
// The role registry is NOT re-exported — `ROLES` and `storageStateFor` come from
// `e2e/support/auth.ts`, so there is exactly one way to reach them.
export { expectAbsent, expectForbidden } from './permissions';
export type { AbsenceCheck } from './permissions';
export { WCAG_21_AA } from './a11y';
export type { A11yScanOptions, AcceptedViolations } from './a11y';
