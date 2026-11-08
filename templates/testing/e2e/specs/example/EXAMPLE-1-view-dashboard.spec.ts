// e2e/specs/example/EXAMPLE-1-view-dashboard.spec.ts
// WORKED EXAMPLE. Copied from `templates/testing/` in the project template.
//
// Delete `e2e/specs/example/` once the `test-author` skill has written real flow
// specs. It exists to demonstrate the two things nothing else in the scaffolding
// shows: where a flow spec lives, and how it declares the session it runs as.
//
// The path is `e2e/specs/[area]/[flow-id]-[short-slug].spec.ts`, where the area
// is an area from `docs/agent_context/CORE_FLOWS.md`, the flow id is that
// document's id for the flow, and the slug is a few words that make a directory
// listing readable. There is no role infix in the filename — the role is
// declared inside the file, below.
//
// The directory is what decides whether the spec runs at all: the `flows`
// project collects `**/*.spec.ts` under `e2e/specs/` only, so a spec placed
// outside the three collected directories belongs to no project and never runs.

import { test, expect } from '../../support/fixtures';
import { storageStateFor } from '../../support/auth';

// THE ROLE DECLARATION. No Playwright project sets a default `storageState`, so
// without this line the whole file runs SIGNED OUT. That is the correct
// declaration for a spec covering the signed-out surface — sign-in, sign-up,
// public marketing routes — which simply omits it.
test.use({ storageState: storageStateFor('ADMIN') });

test.describe('EXAMPLE-1 — view the dashboard', () => {
  test('an administrator lands on the dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Query by accessible role and name. `getByTestId` is permitted only for
    // elements with no accessible identity — a chart canvas, a map container —
    // and the spec must carry a one-line comment saying why.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
