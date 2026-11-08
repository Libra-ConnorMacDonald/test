// e2e/support/permissions.ts
// Permission-matrix assertion helpers.
// Copied from `templates/testing/` in the project template — edit freely once copied.
//
// Two assertions, and they exist to prove a permission rule rather than merely
// suggest it. Both carry their precondition inside themselves: a permission
// assertion that runs against a page which never rendered, or against a response
// that is the tail of a redirect chain, passes for the wrong reason and reports
// a gate as working when nothing was gated.
//
// The role registry and the storage-state locations live in `e2e/support/auth.ts`.

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The two halves of an absence assertion. Both are required, which is the whole
 * point of the type: an absence assertion without a render proof is unsound, so
 * a caller that supplies only the gated element does not compile.
 */
export type AbsenceCheck = {
  /**
   * THE RENDER PROOF. Something the page renders for this role whatever happens
   * — a heading, a landmark, the page title. Asserted visible FIRST.
   */
  rendered: Locator;
  /** What `rendered` is, for the failure message — e.g. `the "Team" heading`. */
  renderedDescription: string;
  /** The permission-gated element that must not exist in the DOM. */
  absent: Locator;
  /** What `absent` is — e.g. `the "Invite member" button on /settings/team`. */
  absentDescription: string;
};

/**
 * Assert that a permission-gated element is ABSENT from the DOM, on a page that
 * is PROVEN to have rendered.
 *
 * `docs/agent_context/PERMISSIONS_REFERENCE.md` requires gated elements to be
 * not rendered — not disabled, not CSS-hidden. Only `toHaveCount(0)` proves
 * that. Never assert `toBeDisabled()` or `not.toBeVisible()` for permission
 * gating — both pass against a correct implementation AND against a violating
 * one, so they give false assurance about the rule this template emphasises most.
 *
 * `toHaveCount(0)` has the same defect one level deeper, which is why the render
 * proof is in the signature rather than in a comment. A locator matches zero
 * elements on a page that returned 500, on an empty error shell, and on a
 * redirect to a sign-in screen — so a bare absence assertion reports that the
 * gate is working when the page never rendered and nothing was ever gated. The
 * render proof is asserted first, so the absence assertion only ever runs
 * against a page that demonstrably drew itself.
 */
export async function expectAbsent(check: AbsenceCheck): Promise<void> {
  await expect(
    check.rendered,
    `The page did not render, so the absence assertion proves nothing: ${check.renderedDescription} ` +
      `was never visible. A gated element is equally "absent" from a 500, from an empty error ` +
      `shell and from a redirect to sign-in, and none of those gated anything. Fix the page ` +
      `first — this failure says nothing either way about ${check.absentDescription}.`,
  ).toBeVisible();

  await expect(
    check.absent,
    `The gated element was rendered when it must not be: ${check.absentDescription} is in the DOM ` +
      `for this role. The page itself rendered correctly (${check.renderedDescription} is visible), ` +
      `so this is a genuine permission-gating failure. The element must not be rendered at all — ` +
      `not disabled, not hidden.`,
  ).toHaveCount(0);
}

/**
 * Assert that a forbidden route returns HTTP 403 AND that no redirect occurred.
 *
 * A test that only checks the page "looks blocked" cannot tell a 403 from a
 * redirect to a sign-in page. A redirect leaks that the route exists; 403 does not.
 *
 * `page.goto()` follows redirects and returns the response of the FINAL
 * navigation, so a status check on its own is not enough — a 302 to a sign-in
 * page that renders 200 would be read as "not 403" with a misleading message,
 * and a 302 to another route that happened to 403 would pass outright. The
 * redirect-chain check therefore runs first, and the assertions below only ever
 * describe a response that was not redirected.
 *
 * The analogous hole to `expectAbsent`'s — a 403 proving nothing because the
 * session under test was never real — is closed elsewhere, which is why this
 * signature needs no session proof. The `setup` project asserts that each role
 * has genuinely landed on the post-sign-in route before it writes that role's
 * storage state, every project declares `dependencies: ['setup']`, and the
 * storage states are rewritten on every run. A stale or empty session therefore
 * fails in `setup` rather than passing quietly here.
 */
export async function expectForbidden(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);

  expect(response, `No response received for ${path}`).not.toBeNull();

  // No server-side redirect: this response must not be the tail of a redirect
  // chain. `redirectedFrom()` is the request that redirected TO this one.
  expect(
    response!.request().redirectedFrom(),
    `${path} redirected instead of returning 403 — a redirect leaks that the route exists`,
  ).toBeNull();

  // No client-side redirect: the browser must still be on the requested path.
  // The base is a throwaway origin — only the pathname is compared.
  const expectedPath = new URL(path, 'http://base.invalid').pathname;
  expect(new URL(page.url()).pathname, `${path} navigated away instead of returning 403`).toBe(
    expectedPath,
  );

  // Only now is the status read from a response that genuinely belongs to `path`.
  expect(response!.status(), `Expected HTTP 403 for ${path}`).toBe(403);
}
