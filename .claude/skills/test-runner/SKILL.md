---
name: test-runner
description: Run the project's test suites and triage every failure into a classified, evidence-backed verdict. Use this skill AFTER an implementation and its tests exist, or whenever a suite is red and the cause is not yet known. Accepts no argument (runs the full suite) or a path, area name, or spec filename (runs that subset only). The skill reads `docs/agent_context/TEST_REFERENCE.md`, the structured Playwright and Vitest reports, `docs/agent_context/CORE_FLOWS.md`, and the last entries of `EXECUTION_LOG_BUGFIX.md`, then classifies each failure as an application regression, a stale test, a flake, or an environment problem, and produces a verdict carrying the failing assertion, the expected and actual values, and the trace file path. It never weakens or deletes an assertion, never adds `.skip` or `.only`, never raises a timeout to mask a race, and never edits application code solely to satisfy a test — a failure that cannot be resolved honestly is reported as unresolved. On completion it appends findings to `EXECUTION_LOG_BUGFIX.md`, updates the Current Coverage block and the Quarantine table in `TEST_REFERENCE.md`, and commits on the contributor branch. Trigger words: "run the tests", "run the suite", "tests are failing", "triage the failures", "why is this test failing", "is this a flake", "run test:e2e", "check the suite is green", "diagnose the red build", "re-run the failing spec". Do NOT use this skill during onboarding — it requires populated context documents and a configured test harness.
---

# Test Runner

Runs the project's unit and end-to-end suites and turns a red result into a set of classified verdicts, each backed by evidence. Never edits a test or the application to make a suite green — a failure that cannot be resolved honestly is reported as unresolved.

---

## Prerequisites

- Claude Code CLI installed and authenticated (`claude` command available)
- GitHub CLI (`gh`) ≥ 2.94.0, authenticated — the triage phase reads task issues and the quarantine protocol requires a fixing issue
- The project must have completed onboarding — `docs/agent_context/CURRENT_STATE.md` must name a real active phase and active execution log, not scaffold placeholders. The skill checks this and refuses to run if onboarding is still pending.
- The project must have a configured test harness — a `package.json` carrying the `test` and `test:e2e` scripts, plus `vitest.config.ts` and `playwright.config.ts` at the project root. The skill checks this separately and reports it as an absent harness, never as a test failure.
- Playwright browser binaries downloaded — `pnpm exec playwright install chromium`, once per machine
- The role test users present in the auth provider, with their addresses and shared password in `.env.local` — `E2E_ADMIN_EMAIL`, one `E2E_[ROLE]_EMAIL` per additional role, and `E2E_USER_PASSWORD`. They are fixed users created by hand; the setup project signs in as them, it does not create them
- `docs/agent_context/TEST_REFERENCE.md` present, since the close-out writes to its Current Coverage block and Quarantine table

---

## When to invoke this skill

The skill is invoked in three situations:

1. Immediately after an implementation and its tests have been written, to prove the acceptance criteria hold
2. When a suite has gone red and the cause is not yet known
3. Before the session close in `docs/general_docs/CLOSE_OUT.md`, to confirm nothing was left broken

The skill is not a test-writing tool. Writing a new spec or repairing a stale one belongs to the `test-author` skill — this skill decides whether a repair is warranted and what shape it must take, then hands over.

---

## Two execution paths

The skill accepts one optional argument — a path, an area name, or a spec filename — and routes to one of two paths based on what it finds.

### Path 1 — Full suite verification

No argument. The skill:

1. Runs the onboarding gate and the harness gate
2. Runs `pnpm test` and captures the structured report
3. Runs `pnpm test:e2e` and captures the structured report
4. Collects every failure from both reports into a single list
5. Triages each failure into exactly one of the four categories below
6. Attaches evidence to every verdict — the failing assertion, the expected and actual values, the trace file path
7. On completion: appends findings to `EXECUTION_LOG_BUGFIX.md`, updates the Current Coverage block and the Quarantine table in `TEST_REFERENCE.md`
8. Commits on the contributor branch with a `fix(tests): [short description]` message, then presents a summary

Both suites always run, even when the first is red. A green unit suite is not evidence about a user-facing flow, and a red unit suite does not predict which end-to-end specs fail.

### Path 2 — Targeted run

The argument names a spec file, a directory under `e2e/specs/`, or an area from `CORE_FLOWS.md`. The skill:

1. Runs the onboarding gate and the harness gate
2. Resolves the argument to a concrete path or `--grep` pattern
3. Runs only the matching specs
4. Triages the failures exactly as in Path 1
5. On completion: appends findings to `EXECUTION_LOG_BUGFIX.md` and updates the Quarantine table if a test was quarantined
6. Does **not** update the Current Coverage block — a partial run observed a partial suite, and recording it as coverage would overstate what was proved
7. Commits on the contributor branch, then presents a summary

Use this path for reproducing a single failure, not for verifying a task complete. A task is verified by Path 1.

---

## The four failure categories

Every failure is classified into exactly one category. This taxonomy is the substance of the skill — a run that reports "3 failures" without classifying them has done nothing useful.

| Category | What it means | What is wrong | Resolution |
|---|---|---|---|
| Application regression | The test is correct and the code broke | The application | Fix the application code |
| Stale test | The application changed on purpose and the test encodes the old behaviour | The test | Update the test, and flag `CORE_FLOWS.md` for review |
| Flake | The result is non-deterministic | Neither, yet | Fix the race, or quarantine with a fixing issue |
| Environment | The suite could not run correctly | The machine or the configuration | Report the remedy — change no code |

A failure that does not meet the criteria for any category is reported as **unclassified**, with the evidence gathered so far. Never default an unexplained failure to flake — that is the classification that makes a real regression disappear.

### Application regression

The default classification. Assume the test is right until there is evidence otherwise.

Criteria — all must hold:

- The failure reproduces on every run of the spec in isolation
- The assertion matches an acceptance criterion in the task's issue body or a documented step in `CORE_FLOWS.md`
- No intentional change to that behaviour appears in the last entries of the active phase log or `EXECUTION_LOG_BUGFIX.md`

Resolution: fix the application. Do not touch the assertion.

### Stale test

The application changed deliberately and the spec still asserts the previous behaviour. This classification requires positive proof of intent, not an assumption.

Criteria — all must hold:

- The last entries of the active phase log or `EXECUTION_LOG_BUGFIX.md` record a change to this behaviour
- The new behaviour is the one the current task or a completed task asked for
- The assertion, not the application, contradicts the documented intent

Resolution: hand the spec to `test-author` for an update, and flag that `docs/agent_context/CORE_FLOWS.md` may now describe the old flow. A stale test almost always means stale documentation — report both.

Never classify a failure as stale merely because the application's current output differs from the assertion. That is what every regression looks like.

### Flake

Non-deterministic. This classification is earned by reproduction, never asserted.

Criteria — all must hold:

- The spec has been re-run in isolation `TRIAGE_REPEAT_COUNT` times with `--workers=1` (default 10)
- It passed on some runs and failed on others
- The failure mode varies, or the failure is a timeout on an element that does appear on a passing run

The re-runs are executed, not estimated — this is why the triage agent is given `Bash`. A flake asserted without a recorded reproduction is an `unclassified` verdict wearing a category name.

If the spec fails on every attempt, it is not a flake — reclassify it as a regression. If it passes on every isolated attempt but fails in the full run, the cause is shared state between parallel workers, which is a genuine defect in the test or the fixtures, not a flake to be tolerated.

Resolution: fix the race — replace a fixed wait with a web-first assertion, scope the data per test, or give the worker its own account. Quarantine only when the fix is not available in this session, and only under the Quarantine protocol below.

### Environment

The suite never got a fair chance to run. No code is at fault.

Common shapes and their remedies:

- `Executable doesn't exist` — browser binaries were never downloaded. Run `pnpm exec playwright install chromium`.
- Connection refused on `baseURL` — no dev server. Check the `webServer` block in `playwright.config.ts` and whether the port is already occupied.
- Every authenticated spec fails at the first navigation — the storage state in `e2e/.auth/` has expired. Delete the directory and re-run the setup project.
- An assertion reads `undefined` where a configured value belongs — a required environment variable is absent. Name the variable, point at `.env.example` for the canonical name, and say the value belongs in `.env.local`.
- The setup project fails on the first sign-in with no such user — the addresses in `E2E_ADMIN_EMAIL` or an `E2E_[ROLE]_EMAIL` do not exist in the auth provider. Test users are fixed and created by hand; nothing in the harness creates them.
- The setup project signs in successfully and then fails the assertion that follows — `e2e/support/auth.setup.ts` ships placeholder scaffolding that navigates to `/dashboard` and expects a heading named `Dashboard`. Point both at this project's real post-login route and heading.

Resolution: report the remedy to the developer. Never work around an environment failure by editing a spec.

---

## What the skill may never do

This is the central guardrail. It applies to every run, every path, and every worker the skill launches.

- **Never weaken or delete an assertion to make a suite pass.** Loosening `toHaveText` to `toContainText`, dropping a count assertion, or removing a failing expectation is falsifying the result.
- **Never add `.skip`, `.only`, `test.fixme`, or a conditional early return** to get a suite green. Playwright's `forbidOnly` catches `.only` on CI — do not rely on that as the safety net.
- **Never raise a timeout to mask a race.** A timeout increase converts a reproducible failure into an intermittent one. Fix the wait, not the clock.
- **Never edit application code solely to satisfy a test.** If the code is right and the test is wrong, the test changes. If both look right, the requirement is ambiguous — report it and stop.
- **Never replace an absence assertion with a weaker one, and never accept one that stands alone.** A permission-gated element must be asserted absent from the DOM, and the absence assertion is only evidence when the spec has first proved the page rendered. The shape is two assertions, in this order:

  ```ts
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete project' })).toHaveCount(0);
  ```

  A count of zero is also what a 500, an empty error shell and a redirect to a sign-in screen produce, so the absence assertion on its own reports the gate as working on a page where nothing was ever gated. `expectAbsent` in `e2e/support/permissions.ts` requires the render proof as an argument, so a spec that calls the helper cannot omit it — a spec that hand-rolls the bare `toHaveCount(0)` can, and that is a defect in the spec even while it passes. `toBeDisabled()` and `not.toBeVisible()` pass against a correct implementation *and* against a violating one, so swapping them in destroys the only check that proves the rule.
- **Never report a suite green while any failure is unresolved.** Report it as unresolved and stop.

The reason is not pedantry. An agent permitted to edit assertions will always find an edit that turns the suite green, because that is the cheapest available action — and a suite degraded that way becomes noise within a few sessions. A green suite that proves nothing is worse than a red one, because a red suite still tells the truth.

---

## Quarantine protocol

Quarantine is a debt entry, not a resolution. A test may be quarantined only when all of the following hold:

1. It has been reproduced as a flake under the criteria above — `TRIAGE_REPEAT_COUNT` isolated runs, mixed results
2. The underlying race has been identified and written down, even if it is not fixed
3. A fixing GitHub issue, labelled `task` or `bug`, exists for the fix. Where one is already open, the triage verdict names its number. Where none exists yet — the usual case for a newly discovered flake — the triage agent is read-only and cannot create one, so its verdict returns `"fixing_issue": null` with quarantine recommended, and the close-out phase creates the issue before the quarantine lands: `gh issue create --label bug --title "…" --body-file <file>`, with the body following the sections of `.github/ISSUE_TEMPLATE/task.md`
4. A row is added to the Quarantine table in `docs/agent_context/TEST_REFERENCE.md` naming the spec, the date, the reason, and the fixing issue number (`#123`) — the `test.skip` comment names the same number. Where the close-out created the issue, the number `gh` returned is what goes in both places

A quarantined test still counts as an unproven acceptance criterion. The close-out summary must say which criteria are now unproven, so the developer sees the cost.

Quarantine without a fixing issue is forbidden — no fixing issue means abandoned work, indistinguishable from deletion, because nothing will ever bring the test back. A triage verdict may recommend quarantine before the issue exists; a Quarantine table row may never land without the number.

---

## How it works under the hood

Three phases.

### Phase 1 — Run

The skill runs each configured suite and captures a structured report rather than scraping console text. Reports are written under `.tasks/` so the triage phase reads data, not terminal noise.

Both JSON reporters write to stdout by default, so naming the destination is not optional — `--reporter=json` on its own prints the report to the terminal and creates no file, and Phase 2 is then handed a path that does not exist. Create `.tasks/` first with `mkdir -p .tasks`, then name the destination on each command:

- Unit and integration: `pnpm test --reporter=json --outputFile=.tasks/unit-report.json`
- End-to-end: `PLAYWRIGHT_JSON_OUTPUT_NAME=.tasks/e2e-report.json pnpm exec playwright test --reporter=json`

The Playwright report carries the spec title, the project, the error message, the failing location, the retry outcomes, and the attachment paths for traces, screenshots, and video. The project names the suite — `setup`, `flows`, `permissions` or `a11y` — not the role. A spec declares its own session at file level with `test.use({ storageState: storageStateFor('ROLE') })`, and a spec that declares nothing runs signed out, so the role behind a failure is read from the top of the spec file rather than from the project name. Retry outcomes matter — a test bucketed `flaky` by Playwright passed on retry, which is a signal for the triage phase, not a verdict on its own.

If a suite exits non-zero without producing a report, that is an environment failure by definition — the runner itself did not start.

### Phase 2 — Triage

Every failure in the collected reports is handed to a triage agent running `scripts/triage-prompt.md`, which returns one verdict per failure. Reproduction runs happen here: the triage agent may re-run a single spec in isolation, and may re-run it repeatedly to test a flake hypothesis.

The agent is launched with `--allowedTools "Read,Glob,Grep,Bash"`. It has read access to the whole tree, and `Bash` because the flake and regression criteria are met by executing the suite, not by reasoning about it — an agent that cannot re-run a spec cannot earn either classification, and every intermittent failure would fall to `unclassified`. `Bash` also carries the `gh issue view` read that cross-checks an assertion against the task's acceptance criteria. It may not edit any source, spec, or documentation file, and the only writes it produces are the run's own artefacts under `test-results/` and the JSON verdict it returns.

Each verdict must carry:

- The spec file path and the test title
- The failing assertion, verbatim
- The expected value and the actual value
- The trace file path, where one exists
- The category, and the specific criterion that justified it
- The proposed remedy, and who owns it — the application, the spec, or the developer

A verdict without evidence is rejected and re-run. Confidence is not evidence.

### Phase 3 — Close-out

Once every failure has a verdict:

1. Appends an entry to `docs/agent_context/EXECUTION_LOG_BUGFIX.md` — test failures are bug fixes, not phase work, so they never go in the phase log
2. Updates the Current Coverage block in `docs/agent_context/TEST_REFERENCE.md` (full-suite path only)
3. Updates the Quarantine table in `docs/agent_context/TEST_REFERENCE.md` if anything was quarantined or released — first creating the fixing issue with `gh issue create --label bug` wherever a verdict recommended quarantine with `"fixing_issue": null`, per the Quarantine protocol above
4. Writes a summary to `.tasks/test-run-summary.md` with: the counts per category, every verdict with its evidence, every unresolved failure, every acceptance criterion now unproven, and the commit it made

The summary filename is deliberate. `.tasks/summary.md` belongs to `task-dispatcher` and `.tasks/test-author/summary.md` to `test-author`. Writing either would destroy the output a developer has been told to review. Never write to a filename another skill owns.

The skill commits its log and reference updates on the contributor branch, per the commit rule in `AGENTS.md` (Collaborative working), and never on a protected branch: there it leaves them uncommitted and says so. It never pushes or opens a pull request.

---

## Script reference

This skill ships no orchestration script and does not reuse the one in `task-dispatcher`. It ships one prompt file — `.claude/skills/test-runner/scripts/triage-prompt.md` — which is handed to the triage agent in Phase 2 with its template variables substituted. There is no plan file and no planner, so none of the orchestrator's path overrides — `--plan-file`, `--summary-file`, `--planner-prompt` and any added alongside them — apply here.

The three files the skill writes under `.tasks/` are `unit-report.json`, `e2e-report.json` and `test-run-summary.md`. None of them is a filename another skill owns: `task-dispatcher` writes `plan.json`, `summary.md`, `status.json` and `logs/`, and `test-author` keeps everything it writes under `.tasks/test-author/` (`planner-prompt.md`, `plan.json`, `summary.md`, `status.json` and `logs/`).

The triage prompt declares six template variables and the skill substitutes every one of them. An unsubstituted variable reaches the agent as the literal string `{{NAME}}`, which is how a triage agent ends up reading a report path that does not exist:

| Variable | Substituted with |
|---|---|
| `{{UNIT_REPORT}}` | `.tasks/unit-report.json` |
| `{{E2E_REPORT}}` | `.tasks/e2e-report.json` |
| `{{FAILURE_LIST}}` | Every failure collected from the two reports |
| `{{PROJECT_DIR}}` | The project root the run executed in |
| `{{REPEAT_COUNT}}` | `TRIAGE_REPEAT_COUNT` |
| `{{ACTIVE_LOG}}` | The active phase log named in `docs/agent_context/CURRENT_STATE.md` |

The prompt declares no variable outside this table, and the skill substitutes none the prompt does not declare.

The commands the skill runs, in order:

```bash
# Create the report directory once — both report commands write into it
mkdir -p .tasks

# Full suite — unit and integration first, then end-to-end.
# Both reporters print to stdout unless the destination is named, so the
# output path is what makes the file exist at all.
pnpm test --reporter=json --outputFile=.tasks/unit-report.json
PLAYWRIGHT_JSON_OUTPUT_NAME=.tasks/e2e-report.json pnpm exec playwright test --reporter=json

# Confirm which specs are collected — a file that lists no tests is in a
# directory no project matches, so it never runs
pnpm exec playwright test --list

# Targeted run — a single spec, a directory, or a title pattern
pnpm exec playwright test e2e/specs/[area]/[flow-id]-[short-slug].spec.ts
pnpm exec playwright test --grep "[test title fragment]"

# Reproduce a suspected flake — isolated, single worker, ten attempts
pnpm exec playwright test e2e/specs/[area]/[flow-id]-[short-slug].spec.ts --repeat-each=10 --workers=1

# Inspect the evidence for a failure
pnpm exec playwright show-trace test-results/[test-dir]/trace.zip

# Re-capture expired authentication state
pnpm exec playwright test --project=setup
```

Environment variables:

- `TRIAGE_REPEAT_COUNT` — isolated re-runs used to test a flake hypothesis (default: 10)
- `TRIAGE_TIMEOUT` — per-triage-agent timeout in seconds (default: 900)

---

## Onboarding gate

Before doing anything else, the skill inspects `docs/agent_context/CURRENT_STATE.md` and verifies two things:

1. `Active phase:` has a non-placeholder value (does not start with `[` and does not contain "e.g.")
2. `Active execution log:` points at a file path that actually exists on disk

If either check fails, the skill exits immediately with a clear message:

> Onboarding has not been run. The test-runner skill requires populated context documents. Run `docs/agent_context/ONBOARDING.md` first, then return.

The skill then runs a second, distinct check for the test harness. It verifies that `package.json` exists and defines the `test` and `test:e2e` scripts, and that `playwright.config.ts` and `vitest.config.ts` are present at the project root. If any is missing, it exits with:

> No test harness is configured. `[the missing file or script]` was not found. Copy the scaffolding from `templates/testing/` into the project and complete the Phase A setup task, then return.

Keeping the two gates separate is deliberate. An absent harness is not a test failure, and reporting it as one would put a fabricated red result into the execution log for every task in early Phase A.

---

## Troubleshooting

**Skill refuses to run — "Onboarding has not been run".** Expected. Complete onboarding first, then try again.

**Skill refuses to run — "No test harness is configured".** Expected on a project whose Phase A setup task has not run yet. Copy `templates/testing/` into the project, add the seven `package.json` scripts, and run `pnpm exec playwright install chromium`.

**Every test in one spec fails as though nobody is signed in.** The file is missing its `test.use({ storageState: storageStateFor('ROLE') })` declaration, imported from `e2e/support/auth.ts`. No project sets a default `storageState`, so signed out is the default. Hand the file to `test-author` to add the declaration — never work around it by weakening the assertions.

**A spec that should exist reports no tests, and the suite is green.** The spec sits in a directory no project collects. Each project matches a plain `**/*.spec.ts` under its own directory — `flows` under `e2e/specs/`, `permissions` under `e2e/permissions/`, `a11y` under `e2e/a11y/` — so a spec placed anywhere else belongs to no project and never runs, whatever it is called. Confirm with `pnpm exec playwright test --list`, which names every collected spec. Playwright never errors on a spec that belongs to no project, so a green run proves nothing until the list is checked.

**The setup project fails after a successful sign-in, and every other project is skipped.** The placeholder in `e2e/support/auth.setup.ts` was never changed. It navigates to `/dashboard` and asserts a heading named `Dashboard` as its proof that the session is real, and every other project declares `dependencies: ['setup']`, so one failed assertion there skips the whole suite. Point the route and the heading at this project's real post-login page. Report it as environment, never as a regression — nothing is broken except the scaffolding nobody edited.

**Every end-to-end spec fails at the first navigation.** Almost always environment, not code. Check that the dev server started, that `baseURL` in `playwright.config.ts` matches the port in use, and that `e2e/.auth/` holds current storage state. Delete `e2e/.auth/` and re-run the setup project to re-capture it.

**A failure is classified as a flake but keeps recurring.** The reproduction threshold was too low, or the non-determinism comes from shared state rather than timing. Re-run with a higher `TRIAGE_REPEAT_COUNT`, and separately run the spec inside the full suite with `--workers=1`. If it passes in isolation and fails in parallel, the defect is in the fixtures, not the spec.

**Triage returns a verdict with no evidence.** The report file was missing or truncated, so the agent had nothing to quote. Almost always the run named no output destination and the reporter printed to stdout instead — confirm `.tasks/e2e-report.json` exists and is valid JSON, re-run Phase 1 with the destination named, then re-run the triage phase. Do not accept the verdict.

**A test cannot be made to pass without changing an assertion.** Stop. This is the case the guardrail exists for. Report the failure as unresolved with both readings — what the test asserts and what the application does — and let the developer decide which one is the requirement.

**A trace file is not written for a failing spec.** `trace` is set to `on-first-retry` in the default config, so a failure with `retries: 0` locally produces no trace. Re-run the single spec with `--trace on`.

**Reproducing a failure interactively.** The Playwright MCP server is registered in the repo-root `.mcp.json` and gives the agent a live browser for stepping through a failing flow. Use it to understand a failure — never to alter the spec that found it.
