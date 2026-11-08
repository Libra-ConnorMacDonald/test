// e2e/support/auth.setup.ts
// Per-role authentication. Runs as the Playwright `setup` project, before every
// other project, and writes one storage-state file per role.
// Copied from `templates/testing/` in the project template — edit freely once copied.
//
// Clerk is the documented default, not a hard dependency. Everything provider
// specific is inside `prepareAuthProvider()` and `signInAs()` below — swap those
// two and the role loop, the file naming and every spec that opts into a role
// all keep working.
//
// The test users are fixed and created by hand in the auth provider, one per
// role. Nothing here creates them — see `e2e/support/auth.ts` for why, and for
// what that means for test data.
//
// THIS FILE CARRIES A PER-PROJECT EDIT — see the placeholder block below.
//
// Never commit `e2e/.auth/` — the files hold live session cookies that can be
// used to impersonate the test account.

import fs from 'node:fs';
import path from 'node:path';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { AUTH_DIR, ROLES, TEST_USERS, storageStateFor } from './auth';
import type { TestUserSpec } from './auth';

// ==========================================================================
// CHANGE THESE TWO BEFORE THE FIRST RUN — they are template placeholders
// ==========================================================================
//
// They are the proof that a sign-in actually landed, checked before the session
// is saved. Nothing else in this file is project specific.
//
// Leaving them wrong is not a small failure. This file runs as the `setup`
// project, and `flows`, `permissions` and `a11y` all declare
// `dependencies: ['setup']` — so a failure here SKIPS every spec in the suite.
// The first `pnpm test:e2e` of the project's life reports a broken placeholder
// as a wholly skipped run.
//
// Set them to the route this project really lands on after signing in, and to a
// heading that route always renders. If different roles land on different
// routes, replace both with a per-role lookup keyed by `Role`.
// ==========================================================================

/** PLACEHOLDER. The route every role lands on after signing in. */
const POST_SIGN_IN_ROUTE = '/dashboard';

/** PLACEHOLDER. An accessible heading that `POST_SIGN_IN_ROUTE` always renders. */
const POST_SIGN_IN_HEADING = 'Dashboard';

// ==========================================================================

// Serial: `clerkSetup()` must finish before any sign-in, and serialising the
// sign-ins keeps the run under the auth provider's rate limit.
setup.describe.configure({ mode: 'serial' });

// ------------------------------------------------- provider-specific: Clerk

/**
 * One-time suite bootstrap. Mints a Testing Token so the automated browser is
 * not blocked by bot detection, and publishes it to the worker environment.
 *
 * This MUST run as a setup project, not as a function-based `globalSetup` — a
 * function-based global setup runs in a separate process, so the environment
 * variables it sets never reach the test workers.
 */
async function prepareAuthProvider(): Promise<void> {
  // `dotenv` defaults to true and loads `.env.local` then `.env` — those two
  // files and no others. Nothing here reads `.env.test`, so put the E2E
  // variables in `.env.local`. Disable dotenv on CI so CI-injected variables
  // win over any committed file.
  await clerkSetup({ dotenv: !process.env.CI });
}

/**
 * Bring `page` to a signed-in state for `spec`. The caller saves the storage state.
 *
 * The `emailAddress` form mints a server-side sign-in token and applies it
 * directly — no password, no verification code, no form interaction. It needs
 * `CLERK_SECRET_KEY`, and it installs the Testing Token itself, so there is no
 * separate `setupClerkTestingToken()` call here.
 */
async function signInAs(page: Page, spec: TestUserSpec): Promise<void> {
  // Required: land on an UNPROTECTED page that loads the auth provider first.
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: spec.email });
}

// ------------------------------------------- provider-swappable alternative
//
// For a project that does not use Clerk, delete the two functions above and the
// `@clerk/testing/playwright` import, then use these instead. Nothing else in
// the suite changes.
//
// async function prepareAuthProvider(): Promise<void> {
//   if (!process.env.E2E_USER_PASSWORD) {
//     throw new Error('E2E_USER_PASSWORD must be set for E2E runs.');
//   }
// }
//
// async function signInAs(page: Page, spec: TestUserSpec): Promise<void> {
//   await page.goto('/sign-in');
//   await page.getByLabel('Email address').fill(spec.email);
//   await page.getByLabel('Password').fill(spec.password);
//   await page.getByRole('button', { name: 'Sign in' }).click();
//   // Wait on a real post-login signal, never on a fixed delay.
//   await page.waitForURL(`**${POST_SIGN_IN_ROUTE}`);
// }

// ------------------------------------------------------------- role loop

setup('prepare the auth provider', async () => {
  fs.mkdirSync(path.resolve(AUTH_DIR), { recursive: true });
  await prepareAuthProvider();
});

// Playwright gives every test its own browser context, so N sign-ins produce N
// clean storage-state files with no bleed between them.
for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const spec = TEST_USERS[role];

    await signInAs(page, spec);

    // Prove the session is real AND that the role landed BEFORE saving state.
    // State saved from a half-authenticated page is the single most common
    // cause of confusing failures later in the run.
    await page.goto(POST_SIGN_IN_ROUTE);
    await expect(
      page.getByRole('heading', { name: POST_SIGN_IN_HEADING }),
      `Signed in as ${role}, but ${POST_SIGN_IN_ROUTE} rendered no heading named ` +
        `"${POST_SIGN_IN_HEADING}". If sign-in itself is working, POST_SIGN_IN_ROUTE and ` +
        `POST_SIGN_IN_HEADING at the top of this file are still the template placeholders — ` +
        `point them at this project's real post-login route and heading. Until they are ` +
        `correct the setup project fails and every flow, permission and a11y spec is skipped.`,
    ).toBeVisible();

    await page.context().storageState({ path: storageStateFor(role) });
  });
}
