// e2e/a11y/pages.spec.ts
// WORKED EXAMPLE. Copied from `templates/testing/` in the project template.
//
// A route-by-route WCAG 2.1 AA scan. Extend `PAGES` as routes are built — one
// entry per route that a user can reach. The routes below are placeholders.
//
// axe is the automated gate, and automated scanning catches only a portion of
// WCAG issues — the rest needs manual keyboard and screen-reader verification.
// Keyboard order, focus visibility, alt-text quality and screen-reader
// announcement stay manual — see `docs/general_docs/ACCESSIBILITY.md`.

import { test, expect } from '../support/fixtures';
import type { AcceptedViolations } from '../support/fixtures';
import { storageStateFor } from '../support/auth';

// Scan the authenticated surface as the highest-privilege role, so gated
// components are actually rendered and therefore actually scanned.
//
// No Playwright project sets a default `storageState`. Omitting this line means
// the whole file runs SIGNED OUT — which is the right declaration for a scan of
// the sign-in or marketing pages, and the wrong one for anything behind auth.
test.use({ storageState: storageStateFor('ADMIN') });

/**
 * Rules waived for these scans only, each with a reason and a ticket.
 * Empty this object to zero as the debts are paid.
 */
const ACCEPTED: AcceptedViolations = {
  'color-contrast': {
    reason: 'Secondary brand palette is 4.2:1, pending design sign-off.',
    ticket: 'A11Y-1',
  },
};

const PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Settings', path: '/settings' },
] as const;

for (const route of PAGES) {
  test(`${route.name} has no WCAG 2.1 AA violations`, async ({ page, a11yScan }) => {
    await page.goto(route.path);

    // Wait for real content before scanning — a half-hydrated page gives
    // inconsistent results.
    await expect(page.getByRole('heading', { name: route.name })).toBeVisible();

    await a11yScan({
      include: 'main',
      accepted: ACCEPTED,
    });
  });
}
