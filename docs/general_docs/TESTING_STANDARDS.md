# Testing Standards

> Read this document before writing any test.
> It defines what must be tested, where tests live, how elements are selected, and which assertions are permitted.
> Several rules here exist because the obvious assertion passes against a correct implementation and against a violating one — those rules are not stylistic preferences.

---

## Standard

Three layers, each with one job. Do not push work down a layer because the lower layer is easier to write.

- **Unit — Vitest, `tests/unit/`** — pure functions in `lib/`. No browser, no database, no network. Fast enough to run on every save.
- **Integration — Vitest, `tests/integration/`** — server logic, Server Actions, and database queries against a real test database. No browser.
- **End-to-end — Playwright, `e2e/`** — anything involving a browser, a route, or a role. This is the only layer that proves a flow works.

Anything that is a pure function is a Vitest test. Anything involving a browser, a route, or a role is a Playwright test. There is no third option — a "unit test" that mounts a page is an end-to-end test with a misleading name and a misleading runtime.

---

## What Must Have a Test

- Every acceptance criterion in the task issue — at least one test that would fail if the criterion were broken
- Every flow the Flow Coverage Map in `docs/agent_context/TEST_REFERENCE.md` marks `required` — one end-to-end spec per flow ID. The map says how that list is decided
- Every row of the permission matrix in `docs/agent_context/PERMISSIONS_REFERENCE.md` — both the permitted case and the denied case
- Every forbidden route — assert the 403
- Every monetary or precision calculation — assert on the Big.js result as a string (`expect(total.toFixed(2)).toBe('19.99')`), never on a value converted back to a number, which reintroduces the float error Big.js exists to remove
- Every derived value — prove it is derived correctly from its inputs, including the boundary cases

What must not have a test:

- Pure copy changes — no behaviour changed, so nothing new can break
- Pure refactors — the existing tests are the proof. If they need editing to pass, it was not a refactor
- Third-party behaviour — never test that the auth provider signs a user in or that the payment provider charges a card. Test what the application does afterwards

A task with no user-facing change records `None — no user-facing change` in its **Tests** field rather than inventing a spec to fill it.

---

## Test Naming and Location

- `tests/unit/` — Vitest unit tests
- `tests/integration/` — Vitest integration tests
- `e2e/specs/[area]/` — Playwright flow specs, one directory per application area in `docs/agent_context/CORE_FLOWS.md`
- `e2e/permissions/permission-matrix.spec.ts` — the permission matrix suite. One file for the whole matrix, regenerated wholesale by `test-author --permissions`
- `e2e/a11y/` — accessibility specs
- `e2e/support/` — fixtures, authentication setup, helpers
- `e2e/.auth/` — storage state files. Gitignored — never commit one, it carries live session cookies

The file extension carries meaning, and the two runners collide without it: `*.test.ts` belongs to Vitest, `*.spec.ts` belongs to Playwright. Vitest's default `include` pattern matches `*.spec.ts` as well, so an unconfigured Vitest run will try to execute the Playwright specs and fail on the `@playwright/test` import.

An end-to-end spec is named after the flow ID it proves — `e2e/specs/booking/BOOK-3-cancel-booking.spec.ts` proves flow `BOOK-3`. The two can then never drift: renaming a flow renames the file, and a flow with no matching file is visible at a glance. The shape is `e2e/specs/[area]/[flow-id]-[short-slug].spec.ts` — the flow ID first, then an optional short descriptive slug that makes a directory listing readable. The filename never carries a role; the role is declared inside the file.

What decides whether a spec runs is its directory, not its name. Every Playwright project collects a plain `**/*.spec.ts` pattern under its own directory: `flows` collects `e2e/specs/`, `permissions` collects `e2e/permissions/`, `a11y` collects `e2e/a11y/`. A spec placed anywhere else belongs to no project — and Playwright does not error on a spec it never collected, it reports green. An uncollected spec is silent absence of coverage, which is the worst failure mode available.

Never place a test file inside `app/`, `components/`, or `lib/`. Tests may import from any layer — no layer may import from tests.

---

## Selecting the Session

No project sets a default `storageState`. A spec therefore runs signed out unless it opts in. That is fail-closed and deliberate: a spec that forgets to declare its role fails visibly rather than silently inheriting whichever session happened to be configured.

A spec declares the session it needs at file level, above every `describe` block:

```ts
import { test, expect } from '../../support/fixtures';
import { storageStateFor } from '../../support/auth';

test.use({ storageState: storageStateFor('ADMIN') });
```

`storageStateFor(role)` is exported from `e2e/support/auth.ts` and returns the path to that role's storage-state file under `e2e/.auth/`. One role per spec file — a flow that must be proven under two roles gets two spec files. The permission suite is the single exception: it loops over roles inside one file and selects each role's session with `test.use` inside that role's `describe` block.

A spec that proves signed-out behaviour declares nothing and takes the default. It still depends on the setup project, because that is what mints the auth provider's testing token — a signed-out request to the provider's frontend API without one trips bot detection. Every project declares `dependencies: ['setup']` for that reason, never to acquire a session.

---

## Selector Policy

Query by accessible role and name first, in this order: `getByRole`, `getByLabel`, `getByText`.

`docs/general_docs/ACCESSIBILITY.md` mandates ARIA roles and labels on every UI component, so a role-based query doubles as an accessibility assertion — a component that cannot be located by its role has already failed the accessibility standard, and the failing test is the correct signal.

`getByTestId` is permitted only for an element with no accessible identity — a chart canvas, a map container. The spec must carry a one-line comment stating why. Reaching for a test ID anywhere else hides an accessibility defect behind a passing test.

Never locate by CSS class or XPath — both bind the test to implementation detail the user never sees, and both break on any restyle.

---

## The Permission Assertion Rule

`docs/agent_context/PERMISSIONS_REFERENCE.md` requires that an element the user has no access to is **not rendered** — not disabled, not CSS-hidden, not present behind a tooltip. It does not exist in the DOM.

The correct assertion is therefore absence — but absence has a precondition, and the assertion is always two parts in this order: prove the page rendered, then prove the control is gone. `expectAbsent` in `e2e/support/permissions.ts` is that pair, and it takes the render proof as a required part of its argument, so a caller cannot omit it:

```ts
// Correct — asserts the "Team" heading is visible FIRST, then that the gated
// button has count zero. Omit `rendered` and this does not compile.
await expectAbsent({
  rendered: page.getByRole('heading', { name: 'Team' }),
  renderedDescription: 'the "Team" heading',
  absent: page.getByRole('button', { name: 'Invite member' }),
  absentDescription: 'the "Invite member" button',
});
```

The precondition is not ceremony, and hand-rolling a bare `await expect(locator).toHaveCount(0)` is a defect rather than a shortcut. A locator matches zero elements on a page that returned 500, on a page that rendered an empty error shell, and on a page that redirected to a sign-in screen — so the bare form passes while the matrix reports the gate is working and nothing was ever gated. That is the same false assurance as `toBeDisabled()`, one level deeper, in the rule this template emphasises most.

Choose the render proof deliberately: something the page draws for this role whatever happens — a heading, a landmark, the page title. Never the container the gated element sits in, which may itself be gated.

Both of these are forbidden for permission gating:

```ts
// FORBIDDEN — passes when the button is rendered and disabled, which violates the rule.
await expect(page.getByRole('button', { name: 'Delete project' })).toBeDisabled();

// FORBIDDEN — passes when the button is rendered and hidden with CSS, which violates the rule.
await expect(page.getByRole('button', { name: 'Delete project' })).not.toBeVisible();
```

The reason is mechanical, not stylistic. `toBeDisabled()` and `not.toBeVisible()` both pass against a correct implementation *and* against a violating one, so neither can distinguish them — the suite reports green while the rule this template emphasises most is being broken, and the false assurance is worse than no test. `toHaveCount(0)` on a page proven to have rendered is the only assertion that tells the two apart.

Every permission matrix row needs both directions: the permitted role sees the element, the denied role gets an `expectAbsent` call. A spec that checks only the permitted case proves nothing about the gate.

The whole matrix lives in one file, `e2e/permissions/permission-matrix.spec.ts`, regenerated wholesale from `docs/agent_context/PERMISSIONS_REFERENCE.md` by `test-author --permissions`. Hand edits to it are lost on the next regeneration — anything hand-written belongs in a flow spec. Run the suite with `pnpm test:permissions`.

---

## Forbidden Route Assertions

A forbidden route returns HTTP 403. It never redirects — a redirect leaks that the route exists, and 403 does not.

Assert both facts, the status and the absence of a redirect. `expectForbidden` does both:

```ts
await expectForbidden(page, '/config/billing');
```

Hand-rolling the pair is where this goes wrong. `page.goto()` follows redirects and returns the response of the *final* navigation, so a status check alone reads a 302 to a sign-in page that rendered 200 as "not 403" and reads a 302 to another route that happened to 403 as a pass. `expectForbidden` checks the redirect chain first and only then reads the status.

A test that only asserts the page "looks blocked" — an error heading, a missing navigation item — cannot distinguish a 403 from a redirect to a sign-in page. Both look identical to the user and only one is correct.

API routes get the same treatment: a request made as the denied role must return 403, not 200 with an empty payload.

When `expectForbidden` fails, fix the gate, never the assertion. A 200 on a route that shows the forbidden page means the gate runs below a `loading.tsx` or `<Suspense>` boundary, after streaming fixed the status. A 404 usually means Clerk's `auth.protect({ role })` was used instead of `auth()` with `forbidden()`. Where gates must sit: Where Role Gates Sit in `docs/agent_context/ROUTING.md`.

---

## Shipped Assertion Helpers

The harness copied from `templates/testing/` ships the assertions these rules require, already written. Use them rather than hand-rolling weaker versions.

| Export | From | What it does |
|---|---|---|
| `expectAbsent` | `e2e/support/permissions.ts` | Takes `{ rendered, renderedDescription, absent, absentDescription }`. Asserts `rendered` is visible, then asserts `absent` has count zero. The render proof is part of the type, so the two-part shape cannot be skipped |
| `expectForbidden` | `e2e/support/permissions.ts` | Asserts a route returned HTTP 403 and that no redirect, server-side or client-side, occurred |
| `a11yScan` | `e2e/support/fixtures.ts` | Test-scoped fixture bound to the test's own page — destructure it in the test signature, call it, and it fails on any unwaived WCAG 2.1 AA violation |
| `runA11yScan` | `e2e/support/a11y.ts` | The function behind that fixture, for the rare scan that needs a page the fixture does not hold |
| `WCAG_21_AA` | `e2e/support/a11y.ts` | The cumulative tag set `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`. Pass it rather than retyping the tags |

`e2e/support/fixtures.ts` provides the `a11yScan` fixture and re-exports `expectAbsent`, `expectForbidden` and `WCAG_21_AA`, so a spec reaches all of them through the same import line it already uses for `test` and `expect`.

---

## Determinism

- Never `page.waitForTimeout()` — it is a race that has not failed yet. Web-first assertions such as `await expect(locator).toBeVisible()` auto-wait and retry until the assertion timeout
- Never `expect(await locator.isVisible()).toBe(true)` — that samples the DOM at one instant and never retries. Use `await expect(locator).toBeVisible()`
- Never raise a timeout to make a test pass. A test that needs a longer timeout is reporting a real race or a real performance problem — investigate it, do not accommodate it
- Locators are strict by default. A strict-mode violation means two elements match — fix the query or fix the page. `.first()`, `.last()` and `.nth()` used to escape strictness hide the ambiguity instead of resolving it
- Control the data. A test that depends on a record it did not create fails the first time somebody else edits that record
- Generate unique identifiers per test, derived from `testInfo.testId`, so two concurrent tests cannot collide on the same email address, slug or reference
- Pin time. Any assertion involving "today", an expiry or an age must fix the clock, or it passes until the next month boundary
- Never depend on execution order. Playwright workers are separate OS processes that share no state, and Vitest files run in parallel

### Mocking

- Never mock the thing under test — a test of `calculateVat` that mocks `calculateVat` proves only that the mock works
- Never mock the application's own database in an end-to-end test. The entire point of the layer is that the real stack works end to end — run against a real test database
- Always stub third-party payment, email and SMS providers. Intercept with `page.route()`. Only test what the project controls
- Mock at the boundary, never in the middle. A mock inside the module under test is a rewrite of that module

---

## Accessibility Testing

- `@axe-core/playwright` is the automated gate. Every new page or major UI area gets a spec in `e2e/a11y/` that scans it and asserts zero violations. Run with `pnpm test:a11y`
- Scan against WCAG 2.1 AA using the tag set `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`. WCAG levels are cumulative, so dropping the Level A tags silently skips most of the rules
- Suppress a known issue with an explicit allowlist keyed by rule ID, each entry carrying a reason and a ticket reference. Never use `disableRules()` — it disables the rule across the whole page, so a new instance of the same defect elsewhere goes undetected
- A clean axe run is necessary, never sufficient. It covers only a portion of WCAG, and it reports zero false positives by design, which means it under-reports: anything it cannot decide lands in `results.incomplete`, which the standard assertion ignores completely. Surface `incomplete` and review it by hand
- Keyboard navigation, focus order, visible focus, meaningful alternative text, heading hierarchy and screen-reader announcement are not detectable by axe and remain manual checks
- Lighthouse remains a periodic manual audit — it is not a per-task gate. axe in CI is the gate

---

## Test Data and Isolation

Playwright runs fully parallel across N worker processes. Each worker is an independent OS process with its own browser, sharing no state and no global variables — so N workers means N concurrent database clients.

Choose one isolation strategy per suite and apply it consistently:

- **Per test** — every test creates the records it needs, with identifiers derived from `testInfo.testId`, and never reads a record it did not create. Preferred, because it scales to any worker count
- **Per worker** — a worker-scoped fixture keyed on `test.info().parallelIndex` gives each worker its own schema, tenant or account. Use when the flow under test cannot be scoped to a single record

Authentication state is captured once per role by a Playwright setup project and written to `e2e/.auth/[role].json`. Specs select a role with `test.use({ storageState: storageStateFor('ROLE') })` rather than signing in through the UI — a sign-in re-run in every test is slow, and sign-in is itself the thing exactly one spec should be testing. Clerk is the documented default; the fixture layer is written so the provider can be swapped without editing a single spec.

The test users are fixed. One user per role is created by hand in the auth provider and reused by every run. Never derive a per-run address: it names a user nothing ever creates, so the setup project fails on the first sign-in and every dependent project is skipped. The addresses live in `.env.local` as `E2E_ADMIN_EMAIL` plus one `E2E_[ROLE]_EMAIL` per additional role, with a single shared `E2E_USER_PASSWORD`. `.env.local` is the file the Clerk setup helper reads — nothing in the harness loads `.env.test`.

Fixed users are shared, including by concurrent CI jobs, so no test may treat its user as private. Every test scopes its own data with a unique per-test identifier derived from `testInfo.testId`, and asserts only against records it created itself. A team that needs full per-run isolation seeds and deletes users through the Clerk Backend API instead — that is a deliberate addition to the harness, not the default.

Never commit `e2e/.auth/` — those files contain live session cookies for real test accounts.

Setting `workers: 1` is the documented escape hatch for a suite that cannot be isolated. It is a standing cost paid on every run, not a fix.

---

## What Is Never Allowed

- Never edit application code solely to make a test pass — that inverts the entire purpose of the test
- Never commit `.only` — it silently reduces the suite to a single test. Set `forbidOnly` in CI so the build rejects it
- Never `.skip` a failing test to get a build green — a skipped test is an untested requirement with a green tick beside it
- Never raise a timeout to mask a race — see Determinism
- Never weaken an assertion to make it pass — `not.toBeVisible()` in place of `toHaveCount(0)`, a substring in place of an exact value, a soft assertion in place of a hard one
- Never delete a test because it is inconvenient. If it is genuinely wrong, replace it and record why in the execution log entry

If a test cannot be made to pass, stop and report it. A failure is information — suppressing it destroys the information and leaves the defect in place.

---

## Coverage

- Target 80% line coverage for `lib/` — pure logic is cheap to cover, and it is the layer where an uncovered branch is most likely to be a real defect
- No coverage target on `app/` or `components/`. UI coverage is measured by flow coverage, not by line coverage — a page with every line executed and no flow spec is untested
- Configure coverage with an explicit `include` list. Without one, only files imported during the run appear in the report, so an entirely untested module is invisible and the percentage is a flattering lie
- Coverage is a floor, not a target. Full line coverage with weak assertions proves nothing — chase the uncovered branch, not the number
- The thresholds in `vitest.config.ts` are enforced, so a young project whose `lib/` holds few tested modules fails `pnpm test:coverage`. Set them to what `lib/` reaches today and raise them as tested modules land. Never comment the `coverage` block out or delete it to get a build green

Run the suite before reporting any task complete, once the project's test harness is configured — the harness is copied from `templates/testing/` during the Phase A setup task, never during onboarding:

```bash
pnpm test              # unit and integration
pnpm test:watch        # unit and integration, watch mode
pnpm test:coverage     # coverage report against the lib/ threshold
pnpm test:e2e          # end-to-end
pnpm test:e2e:ui       # end-to-end, interactive runner
pnpm test:permissions  # the permission matrix suite only
pnpm test:a11y         # the accessibility scans only
```

---

*Keep this document up to date. A testing standard that no longer matches the suite trains every agent to ignore it.*
