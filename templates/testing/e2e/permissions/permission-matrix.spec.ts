// e2e/permissions/permission-matrix.spec.ts
// WORKED EXAMPLE. Copied from `templates/testing/` in the project template.
//
// This file is a demonstration of the shape, not real coverage. Regenerate it
// with the `test-author` skill (`--permissions`), which reads the role matrix
// from `docs/agent_context/PERMISSIONS_REFERENCE.md` and emits one MATRIX entry
// per gated route. The routes and control names below are placeholders.
//
// The two rules this file exists to prove:
//   1. A forbidden route returns HTTP 403 and does not redirect.
//   2. A permission-gated element is ABSENT from the DOM for a role that may not
//      use it — never merely disabled, never merely hidden — on a page that is
//      first PROVEN to have rendered. Absence on a page that never rendered
//      proves nothing, so `expectAbsent` takes the render proof as a required
//      argument and asserts it before the absence.
//
// No Playwright project sets a default `storageState`, so a spec runs SIGNED OUT
// until it opts into a role. This file opts in per describe block rather than
// per file, because the whole point is to run the same route as every role.

import { expect, expectAbsent, expectForbidden, test } from '../support/fixtures';
import { ROLES, storageStateFor } from '../support/auth';
import type { Role } from '../support/auth';

type MatrixRow = {
  /** The route under test. */
  route: string;
  /** Roles allowed to load the route at all. Every other role must get a 403. */
  view: readonly Role[];
  /** Roles allowed to use the gated control. Must be a subset of `view`. */
  manage: readonly Role[];
  /** A heading that proves the page loaded, queried by accessible role and name. */
  heading: string;
  /** The gated control, queried by accessible role and name. */
  control: { role: 'button' | 'link'; name: string };
};

const MATRIX: readonly MatrixRow[] = [
  {
    route: '/settings/team',
    view: ['ADMIN', 'MANAGER'],
    manage: ['ADMIN'],
    heading: 'Team',
    control: { role: 'button', name: 'Invite member' },
  },
  {
    route: '/settings/billing',
    view: ['ADMIN'],
    manage: ['ADMIN'],
    heading: 'Billing',
    control: { role: 'button', name: 'Change plan' },
  },
];

for (const row of MATRIX) {
  test.describe(row.route, () => {
    for (const role of ROLES) {
      test.describe(`as ${role}`, () => {
        // Each role runs with its own stored session. Omit this line and the
        // block runs signed out.
        test.use({ storageState: storageStateFor(role) });

        if (!row.view.includes(role)) {
          test('returns 403 without redirecting', async ({ page }) => {
            await expectForbidden(page, row.route);
          });

          return;
        }

        test('renders the page', async ({ page }) => {
          await page.goto(row.route);
          await expect(page.getByRole('heading', { name: row.heading })).toBeVisible();
        });

        if (row.manage.includes(role)) {
          test('renders the gated control', async ({ page }) => {
            await page.goto(row.route);
            await expect(page.getByRole(row.control.role, { name: row.control.name })).toBeVisible();
          });
        } else {
          test('does not render the gated control', async ({ page }) => {
            await page.goto(row.route);

            // TWO assertions, in this order, and `expectAbsent` enforces both.
            // `rendered` proves the page actually drew itself; only then does
            // the absence of the control mean anything, because a locator
            // matches zero elements on a 500, on an empty error shell and on a
            // redirect to sign-in just as readily as on a correctly gated page.
            //
            // The absence itself is `toHaveCount(0)`, never `toBeDisabled()` or
            // `not.toBeVisible()` — those pass against a violating
            // implementation as well as a correct one.
            await expectAbsent({
              rendered: page.getByRole('heading', { name: row.heading }),
              renderedDescription: `the "${row.heading}" heading on ${row.route}`,
              absent: page.getByRole(row.control.role, { name: row.control.name }),
              absentDescription: `the "${row.control.name}" ${row.control.role} on ${row.route}`,
            });
          });
        }
      });
    }
  });
}
