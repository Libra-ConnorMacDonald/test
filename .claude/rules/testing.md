---
paths:
  - "tests/**"
  - "e2e/**"
  - "templates/testing/**"
  - "**/*.test.{ts,tsx,js,mjs}"
  - "**/*.spec.{ts,tsx,js,mjs}"
  - "vitest.config.*"
  - "playwright.config.*"
---

# Tests

Loads when you work on a test file. The one-line rules in `AGENTS.md` (permission absence, 403, definition of done) still apply everywhere.

Read first: `docs/general_docs/TESTING_STANDARDS.md` for how to write a test, and the areas the task names in `docs/agent_context/TEST_REFERENCE.md`.

- **Every acceptance criterion has a test** that would fail if the criterion were broken, and every test named in the issue's **Tests** section exists. Missing tests fail Self-Verify; they are never a follow-up item.
- **Permission absence is two assertions.** First prove the page rendered: a heading or landmark this role does see. Then assert the gated element is not in the DOM. A bare absence assertion also passes on a 500, an empty error shell or a redirect to sign-in, so on its own it proves nothing. Use `expectAbsent` from `e2e/support/permissions.ts`, which takes the render proof as a required argument.
- **Absent, never disabled or not visible.** Both of those pass against a violating implementation as well as a correct one.
- **Forbidden routes:** assert an HTTP 403 status and that no redirect occurred.
- **Accessibility:** every page or major UI area the change touches is covered by an axe-core scan in `e2e/a11y/` (`docs/general_docs/ACCESSIBILITY.md`).
- **Who writes what:** the `test-author` skill writes end-to-end specs once the implementation runs and before Self-Verify. Unit and integration tests are written as part of the task. The `test-runner` skill runs and triages the suites and never edits application code to make a test pass.
- **Run them:** once the harness is configured, `pnpm test` for every task and `pnpm test:e2e` for any task that changes a user-facing flow, with zero failures. Where the harness is not configured yet, configuring it is the blocking task.
- **Layering:** `tests/` and `e2e/` may import from any layer, and no layer imports from them. Never put a fixture or helper in `lib/` for a test to reuse.
- **Data:** seed and fixture data is synthetic only: fictional names, `@example.com` addresses. Storage state in `e2e/.auth/` is gitignored and never committed.
