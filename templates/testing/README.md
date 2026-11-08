# Test Scaffolding

> Runnable test scaffolding, held here as inert payload. Nothing in this directory
> runs, is loaded, or is type-checked while it sits in the template repository —
> there is no `package.json` at this level and no application to test.
>
> It is copied into a real project during the Phase A setup task. Read this file
> before copying anything.

---

## What this is

The template repository is documentation. This directory is the one exception, and
it earns the exception by being payload rather than configuration: a mirror of the
test layout a real project ends up with, kept in a subdirectory so the repository
root stays documentation-only.

The files here are deliberately complete rather than skeletal. An agent reading
`e2e/support/permissions.ts` learns the permission assertion rule from working
code, which is more durable than learning it from prose.

Nothing here is active until it is copied into a project that has a
`package.json`, a `tsconfig.json`, and application routes to point at.

---

## What gets copied where

| From `templates/testing/` | To the project | Purpose |
|---|---|---|
| `playwright.config.ts` | `playwright.config.ts` | End-to-end configuration — projects, reporters, `webServer` |
| `vitest.config.ts` | `vitest.config.ts` | Unit and integration configuration — coverage, Playwright coexistence |
| `e2e/support/` | `e2e/support/` | Fixtures, per-role authentication, accessibility and permission helpers |
| `e2e/permissions/` | `e2e/permissions/` | `permission-matrix.spec.ts` — regenerated wholesale by the `test-author` skill |
| `e2e/a11y/` | `e2e/a11y/` | Accessibility scans, one entry per route |
| `e2e/specs/` | `e2e/specs/` | Flow specs, one directory per `CORE_FLOWS.md` area — ships one worked example |
| `tests/unit/` | `tests/unit/` | Vitest unit tests — ships one worked example |
| `github-workflow-test.yml` | `.github/workflows/test.yml` | CI workflow |
| `package-scripts.json` | merged into `package.json` | Scripts and pinned dependency versions |

The resulting layout in the project:

```
├── playwright.config.ts       # E2E configuration
├── vitest.config.ts           # Unit and integration configuration
│
├── tests/
│   ├── unit/                  # Vitest unit tests
│   └── integration/           # Vitest integration tests
│
└── e2e/
    ├── specs/[area]/          # Flow specs, one directory per CORE_FLOWS area
    ├── permissions/           # permission-matrix.spec.ts — one generated file
    ├── a11y/                  # Accessibility specs
    ├── support/               # Fixtures, auth setup, helpers
    └── .auth/                 # Storage state — GITIGNORED, never committed
```

---

## Copy instructions

This is the Phase A setup task, not an onboarding step. Onboarding produces no
`package.json` and no application routes, so nothing here can be installed or run
until Phase A has scaffolded the project.

Run these from the project root, in Git Bash on Windows. Everything is a plain
copy — no file needs editing to land in the right place.

```bash
cp templates/testing/playwright.config.ts .
cp templates/testing/vitest.config.ts .

mkdir -p e2e tests/integration
cp -r templates/testing/e2e/. e2e/
cp -r templates/testing/tests/. tests/

mkdir -p e2e/.auth .github/workflows
cp templates/testing/github-workflow-test.yml .github/workflows/test.yml
```

Then merge the `scripts` and `devDependencies` blocks from
`templates/testing/package-scripts.json` into the project's `package.json`. The
script names are fixed — `TECH_STACK.md`, the CI workflow, the skills and the
task-dispatcher worker prompts all invoke them by name.

Add these entries to `.gitignore` in the same change:

```
e2e/.auth/
test-results/
playwright-report/
blob-report/
coverage/
```

`e2e/.auth/` is the one that matters. Storage-state files hold live session
cookies — committing them hands anyone with repository access a signed-in session
as every test role.

Delete `templates/` once the copy is done. It is template payload, not project code.

---

## Install the dependencies

```bash
pnpm add -D @axe-core/playwright @clerk/testing @playwright/test @vitest/coverage-v8 axe-core dotenv vitest
```

That list is exactly the `devDependencies` block in `package-scripts.json` —
nothing more. The harness installs no runtime dependency of its own.

Then download the browser binaries. This is a one-off per machine, roughly 150 MB:

```bash
pnpm exec playwright install chromium
```

On Linux and in CI containers the browsers also need system libraries:

```bash
pnpm exec playwright install --with-deps chromium
```

If `pnpm test:e2e` fails with "Executable doesn't exist", this step has not been run.

Three notes on the pinned versions. `@vitest/coverage-v8` must track `vitest`
exactly — a mismatch fails at startup. `axe-core` is listed only for its
TypeScript types; the engine that actually runs is the copy vendored inside
`@axe-core/playwright`. `dotenv` is a real runtime requirement of
`playwright.config.ts`, which loads `.env.local` and `.env` at the top of the
file — omit it and the config fails to resolve its import.

---

## Environment variables

Add these to `.env.example` and to the Required Variables table in
`docs/general_docs/TECH_STACK.md`. The names below are canonical — the
scaffolding reads these exact strings.

| Variable | Required by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `e2e/support/auth.setup.ts` | Identifies the auth instance. Not secret |
| `CLERK_SECRET_KEY` | `e2e/support/auth.setup.ts` | Mints the Testing Token and the per-role sign-in tokens. Secret |
| `E2E_ADMIN_EMAIL` | `e2e/support/auth.ts` | Address of the fixed admin test user. Not secret |
| `E2E_[ROLE]_EMAIL` | `e2e/support/auth.ts` | One per additional role — `E2E_MANAGER_EMAIL`, `E2E_MEMBER_EMAIL`, and so on |
| `E2E_USER_PASSWORD` | `e2e/support/auth.ts` | Shared password for the test users. Unused on the Clerk path — read only by the generic sign-in fallback in `e2e/support/auth.setup.ts`. Secret |
| `E2E_BASE_URL` | `playwright.config.ts` | Runs the suite against a deployed URL. Skips `webServer` when set |

Locally these live in `.env.local`, which is already gitignored. That file is not
an arbitrary choice — `playwright.config.ts` calls `dotenv.config({ path: ['.env.local', '.env'] })`
as its first statement, and nothing in the harness loads any other file. The load
belongs there because Playwright evaluates the config in the main process and again
in every worker, so it is the only place that reaches every process before
`e2e/support/auth.ts` builds `TEST_USERS` at module scope. `clerkSetup({ dotenv })`
cannot cover that — it runs inside a test body and a worker fixture, both after
module evaluation. Do not create a `.env.test` — no part of the suite reads one.
On CI the workflow injects the values directly; dotenv never overwrites a variable
that is already set, so the injected values win.

Never commit real values.

---

## Test users

The test users are fixed. Create one per role by hand in the auth provider before
the first run, each carrying its role in `publicMetadata.role`, and give each an
address containing the `+clerk_test` subaddress so the provider suppresses all
email delivery. The suite never creates, repairs or deletes a user.

Fixed users mean concurrent CI jobs share them. Every test must therefore scope
its own data rather than rely on a private user — derive a unique identifier per
test, for example from `testInfo.testId`, and create, assert against and clean up
only the rows carrying that identifier. A test that asserts on "the first row in
the table" or on a global count will fail the moment a second job runs beside it.

A team that needs full isolation can seed and tear down a per-run set of users
through the Clerk Backend API instead — `createUser` with `publicMetadata`, a
`replaceUserMetadata` repair path, and a Playwright teardown project that deletes
what it created. That is deliberately not implemented here: it adds a runtime
dependency, and development instances cap total users, so a suite that seeds
without a reliable teardown eventually stops being able to sign in at all.

---

## Conventions the scaffolding encodes

- Query by accessible role and name first — `getByRole`, `getByLabel`, `getByText`. `getByTestId` is permitted only for elements with no accessible identity, such as a chart canvas or a map container, and the spec must carry a one-line comment saying why
- Permission-gated elements are asserted ABSENT in two parts, through `expectAbsent`: it asserts a render-proof locator is visible FIRST, then asserts the gated locator has count zero. The render proof is part of the argument type, so a call that omits it does not compile. That is deliberate — a bare `toHaveCount(0)` also passes on a page that returned 500, on an empty error shell, and on a redirect to sign-in, so on its own it cannot tell a working gate from a broken page. Never assert `toBeDisabled()` or `not.toBeVisible()` for permission gating either — both pass against a violating implementation as well as a correct one
- Forbidden routes are asserted with `expectForbidden`, which checks an HTTP 403 status and that no redirect occurred. A test that only checks the page "looks blocked" cannot tell a 403 from a redirect
- `*.test.ts` belongs to Vitest, `*.spec.ts` belongs to Playwright. Both runners are configured to ignore the other's files — breaking the naming convention breaks that separation
- Flow specs are named `e2e/specs/[area]/[flow-id]-[short-slug].spec.ts` — the flow ID first, then an optional short descriptive slug, and the role never appears in the filename. What decides whether a spec runs is its directory, since each project collects a plain `**/*.spec.ts` under its own. The permission matrix is a single file, `e2e/permissions/permission-matrix.spec.ts`, regenerated wholesale
- No project sets a default `storageState`, so a spec runs SIGNED OUT unless it opts in. Declare the role at file level with `test.use({ storageState: storageStateFor('ADMIN') })`, where `storageStateFor` comes from `e2e/support/auth.ts`. This is fail-closed by design — a spec that forgets fails as an anonymous visitor rather than silently passing with an administrator session
- Every spec imports `test` and `expect` from `e2e/support/fixtures.ts`, never from `@playwright/test` directly
- axe-core is the automated accessibility gate and runs on every build. Lighthouse remains a periodic manual check, not a per-task gate. Automated scanning catches only a portion of WCAG issues — keyboard order, focus visibility, alt-text quality and screen-reader announcement stay manual
- Clerk is the documented default for test authentication, not a hard dependency. The provider-specific code is confined to two functions in `e2e/support/auth.setup.ts`, with a commented generic fallback beside them

---

## What to do next

1. Copy the files, merge `package.json`, install the dependencies
2. Create the fixed test users in the auth provider, one per role, each carrying its role in `publicMetadata.role`, and record their addresses in `.env.local`
3. Point the sign-in verification in `e2e/support/auth.setup.ts` at this project's real post-login route and heading — set `POST_SIGN_IN_ROUTE` and `POST_SIGN_IN_HEADING` at the top of that file, where the placeholders are `/dashboard` and a heading named `Dashboard`. This is the single most important per-project edit: the file runs as the `setup` project, and `flows`, `permissions` and `a11y` all depend on it, so a wrong placeholder skips the entire suite on the first `pnpm test:e2e` of the project's life
4. Replace the placeholder routes in `e2e/a11y/pages.spec.ts` with real ones
5. Delete `e2e/specs/example/` once the `test-author` skill has written a real flow spec — the shipped file asserts the same placeholder route and heading
6. Regenerate `e2e/permissions/permission-matrix.spec.ts` from `docs/agent_context/PERMISSIONS_REFERENCE.md` using the `test-author` skill — the shipped file is a worked example, not real coverage
7. Delete `tests/unit/example.test.ts` once `lib/` has real modules to test. It is self-contained and passes as shipped — it exists to demonstrate the assertion style for precision arithmetic, including the pattern to copy when the project adds Big.js as its own application dependency
8. Run `pnpm test` and `pnpm test:e2e` to confirm the harness is wired correctly

---

*Keep this file in step with the scaffolding beside it. A copy instruction that no longer matches the files is worse than none.*
