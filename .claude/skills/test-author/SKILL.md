---
name: test-author
description: Write the end-to-end specs for a flow, an application area, or the whole permission matrix, with the template's testing conventions enforced. Use this skill AFTER the implementation exists and runs, and before Self-Verify — or whenever a flow's coverage is missing, stale, or contradicted by the application. Accepts a flow ID from CORE_FLOWS.md (e.g. `INV-2`), an application area name, or `--permissions` to regenerate the permission-matrix suite from PERMISSIONS_REFERENCE.md. The skill reads CORE_FLOWS.md, PERMISSIONS_REFERENCE.md, TEST_REFERENCE.md, TESTING_STANDARDS.md and DECISIONS.md, then drives the running application through the `playwright` MCP server to resolve real selectors and observe real rendered states before writing a single assertion. Decides single-agent vs parallel fan-out per application area, never per flow, because flows within an area share fixtures. On completion, updates the Flow Coverage Map and the Selector Registry in TEST_REFERENCE.md, appends to the active execution log, and commits on the contributor branch. Trigger words: "write the tests", "author the specs", "generate the spec", "test this flow", "cover INV-2", "add e2e coverage", "regenerate the permission tests", "write specs for the area", "fill the coverage gap", "spec out this flow". Do NOT use this skill to run tests or triage failures — that is the `test-runner` skill — and do NOT use it during onboarding, when there is no application to explore and no populated context documents.
---

# Test Author

Writes end-to-end specs against the flows recorded in `CORE_FLOWS.md` and the role matrix recorded in `PERMISSIONS_REFERENCE.md`. Resolves selectors by driving the running application rather than inventing them from the documents. Fans out to parallel workers per application area only when genuinely beneficial.

---

## Prerequisites

- Claude Code CLI installed and authenticated (`claude` command available)
- `jq` and Python 3 installed — the skill drives its workers through `.claude/skills/task-dispatcher/scripts/orchestrate.sh`, which uses `jq` for JSON processing and Python 3 for cycle detection and safe template substitution
- GitHub CLI (`gh`) 2.94.0 or later, authenticated — the shared orchestrator requires `gh` on every run and its onboarding gate runs `gh auth status`, even though test-author itself never edits an issue
- The test harness copied from `templates/testing/` into the project and configured by the Phase A setup task — `playwright.config.ts` at the project root, fixtures under `e2e/support/`
- The role test users created by hand in the auth provider, with their addresses and shared password in `.env.local` — `E2E_ADMIN_EMAIL`, one `E2E_[ROLE]_EMAIL` per additional role, and `E2E_USER_PASSWORD`
- The `playwright` MCP server registered in the repo-root `.mcp.json` and connected. Without it the skill runs the degraded path described below.
- The application running at the `baseURL` in `playwright.config.ts`. Without it the skill runs the degraded path.
- The project must have completed onboarding — `docs/agent_context/CURRENT_STATE.md` must name a real active phase and active execution log, not scaffold placeholders. The skill checks this and refuses to run if onboarding is still pending.

---

## When to invoke this skill

The skill is invoked **after**:

1. The implementation of the flow exists and can be driven in a browser
2. `CORE_FLOWS.md` documents the flow, or `PERMISSIONS_REFERENCE.md` documents the roles being covered
3. The developer has agreed which flows or areas need coverage

The skill is not a planning tool and not a test runner. It turns documented behaviour plus observed behaviour into committed specs. Executing those specs and triaging their failures is the `test-runner` skill's job.

---

## Three input paths

The skill accepts one argument and routes to one of three paths based on what it finds.

### Path 1 — Single flow

Input looks like a flow ID (e.g. `INV-2`, `AUTH-1`). The skill:

1. Reads the flow entry from `docs/agent_context/CORE_FLOWS.md` — trigger, roles, steps, business rules, DB tables, API routes, UI states
2. Reads the rows of `docs/agent_context/PERMISSIONS_REFERENCE.md` for every role named in the flow
3. Reads `docs/agent_context/TEST_REFERENCE.md` — the Flow Coverage Map entry for this flow and the Selector Registry entries for its area
4. Explores the running application to resolve selectors and observe the Loading, Empty and Error states
5. Writes one spec file at `e2e/specs/[area]/[flow-id]-[short-slug].spec.ts` — the flow ID first, no role infix — which declares its session at file level with `test.use({ storageState: storageStateFor('ROLE') })`
6. On completion: updates the Flow Coverage Map and Selector Registry, appends an entry to the active phase execution log, and commits on the contributor branch with a `test([area]): [flow-id] [flow name]` message

### Path 2 — Application area

Input matches an `## Area:` heading in `CORE_FLOWS.md`. The skill does everything Path 1 does, for every flow in that area, and additionally:

1. Reads every flow in the area before writing anything, so shared fixtures are written once rather than per flow
2. Places any helper used by more than one spec in `e2e/support/`, never duplicated inside a spec
3. Writes one spec file per flow under the same `e2e/specs/[area]/` directory

An area is the fan-out unit. Flows within an area share fixtures and selectors, so splitting an area across workers produces duplicated helpers and merge conflicts.

### Path 3 — Permission matrix (`--permissions`)

Input is the literal flag `--permissions`. The skill regenerates the entire permission-matrix suite from `PERMISSIONS_REFERENCE.md`:

1. Reads every role definition and the Permission Matrix Summary table
2. Reads the Forbidden Route Behaviour section
3. Generates one `describe` block per feature row, looping over every role column, with each role's `describe` selecting its own session through `test.use({ storageState: storageStateFor('ROLE') })` and the signed-out block declaring nothing
4. Writes the whole matrix to the single file `e2e/permissions/permission-matrix.spec.ts`, replacing the previous generation of that file entirely
5. On completion: updates the Permission Matrix Coverage table in `TEST_REFERENCE.md`, appends to the active execution log, and commits on the contributor branch with a `test(permissions): regenerate the role matrix suite` message

One file, always that name. The `permissions` project collects `**/*.spec.ts` under `e2e/permissions/`, so a regeneration written under any other name leaves the previous file in place and both run — the stale one against routes that no longer exist.

This path regenerates rather than amends. Hand edits made to a generated permission spec are lost — put anything hand-written in a flow spec instead.

---

## Exploring the running application

This is the step that makes the skill worth having. A spec written from `CORE_FLOWS.md` alone asserts selectors that were invented, against states nobody has seen. The skill resolves both against the real application before writing anything.

Requirements: the application running at the config's `baseURL`, and the `playwright` MCP server available from the repo-root `.mcp.json`.

| Tool | Use it for |
|---|---|
| `browser_navigate` | Opening the route the flow's trigger starts at |
| `browser_find` | Locating one element by text or regular expression — cheaper than a full snapshot, use it first |
| `browser_snapshot` | Reading the accessibility tree when the whole page structure matters |
| `browser_generate_locator` | Turning a snapshot ref into a committable Playwright locator string |
| `browser_console_messages` | Observing the real error behaviour behind the flow's documented Error state |
| `browser_network_requests` | Observing the real loading behaviour and confirming which API routes each step calls |

`browser_generate_locator` is available because the committed `.mcp.json` passes `--caps=testing`. It is the bridge between exploration and a committed spec — the locator string it returns goes into the spec verbatim and into the Selector Registry in `TEST_REFERENCE.md`.

Work one flow step at a time. Navigate, find, generate the locator, then act — and only then move to the next step. Snapshotting a whole page for a flow that touches three elements wastes the context window the rest of the session needs.

**Concurrency constraint.** A persistent browser profile can only be held by one browser instance at a time, so parallel workers driving the browser at once will conflict. The committed `.mcp.json` passes `--isolated` for exactly this reason. Never remove it to make a single debugging session more convenient.

**The degraded path.** If the application is not running, or the `playwright` MCP server is not available, the skill does not stop. It generates from the documents alone and:

1. Marks every generated spec with this header comment, as the first lines of the file:

```ts
// UNVERIFIED SELECTORS — generated from CORE_FLOWS.md without driving the
// application. Re-run test-author with the application running, or fix the
// locators on the first failing run.
```

2. Records `exploration: unverified` in the plan and states it in the summary
3. Marks the affected rows of the Flow Coverage Map as unverified rather than covered

Be honest about what this produces. Unverified specs will need a fixing pass on their first run — the assertions are right, the locators are guesses. An unverified spec is worth committing; an unverified spec presented as verified is not.

---

## How conventions are enforced

The planner reads the template's governance and reference documents and injects their rules into every worker prompt it generates. Workers never read these documents themselves — the planner has already pulled the relevant material in.

Every worker prompt includes:

- **Rules that must never be violated** — every item from `DECISIONS.md`
- **Critical Patterns** — every pattern listed in the Critical Patterns section of `AGENTS.md`
- **The flow verbatim** — trigger, roles, steps, business rules, DB tables, API routes and all three UI states, copied out of `CORE_FLOWS.md` without paraphrase
- **The role matrix rows** — every row of `PERMISSIONS_REFERENCE.md` that applies to the flow, plus its forbidden route rules
- **Resolved selectors** — the locator strings produced during exploration, or the unverified header comment if exploration did not run
- **Testing conventions** — the block reproduced in `scripts/planner-prompt.md`, injected without modification
- **Files this worker owns** — explicit list, with instruction not to touch anything outside it

A worker that violates any of these rules has produced broken work. The synthesis phase flags violations where detectable.

---

## Generation rules

- One `describe` block per flow, titled with the flow ID and flow name exactly as they appear in `CORE_FLOWS.md` — the title is what links a spec back to its documentation
- One `test` per documented step or business rule. Assertions are derived from the flow's Steps, Business rules and UI states verbatim, not from what the spec author thinks the flow ought to do
- Every UI state the flow documents gets a test — Loading, Empty and Error. A spec that covers only the happy path is incomplete
- Query by accessible role and name first — `getByRole`, `getByLabel`, `getByText`. `getByTestId` is permitted only for an element with no accessible identity, such as a chart canvas or a map container, and the line must carry a one-line comment saying why. `ACCESSIBILITY.md` mandates ARIA roles and labels on every component, so role-based queries double as accessibility assertions
- **Permission-gated elements must be asserted absent from the DOM, in two parts** — prove the page rendered, then prove the control is gone. Always go through `expectAbsent` from `e2e/support/permissions.ts`, which takes `{ rendered, renderedDescription, absent, absentDescription }`, asserts `rendered` is visible first and `absent` has count zero second, and does not compile without the render proof. A bare `toHaveCount(0)` also passes on a page that returned 500, on an empty error shell, and on a redirect to a sign-in screen — nothing was gated because nothing rendered — so on its own it cannot tell a working gate from a broken page:

  ```ts
  await expectAbsent({
    rendered: page.getByRole('heading', { name: 'Team' }),
    renderedDescription: 'the "Team" heading',
    absent: page.getByRole('button', { name: 'Invite member' }),
    absentDescription: 'the "Invite member" button',
  });
  ```

- Never assert `toBeDisabled()` or `not.toBeVisible()` for permission gating — both pass against a correct implementation and against a violating one, which gives false assurance about the rule this template emphasises most
- Forbidden routes must assert an HTTP 403 status **and** assert that no redirect occurred. A test that only checks the page looks blocked does not distinguish a 403 from a redirect. `expectForbidden` in `e2e/support/permissions.ts` asserts both
- The permission suite is one file, `e2e/permissions/permission-matrix.spec.ts`, and it loops over roles. One `describe` per feature, one `test` per role column of the Permission Matrix Summary — a `✓` cell generates a presence assertion, a `✗` cell generates an `expectAbsent` call, render proof included
- Accessibility specs use `@axe-core/playwright` and live in `e2e/a11y/`. Axe is the automated gate, and automated scanning catches only a portion of WCAG issues — keyboard and screen-reader checks stay manual
- Name every flow spec `e2e/specs/[area]/[flow-id]-[short-slug].spec.ts` — the flow ID first, then an optional short descriptive slug. The filename never carries a role. What decides whether a spec runs is its directory: each Playwright project collects a plain `**/*.spec.ts` under its own directory, so a spec placed outside `e2e/specs/`, `e2e/permissions/` or `e2e/a11y/` belongs to no project, never runs, and the suite still reports green
- Declare the spec's session at file level, above every `describe` block: `test.use({ storageState: storageStateFor('ROLE') })`, imported from `e2e/support/auth.ts`. No project sets a default `storageState`, so a spec that declares nothing runs signed out — correct for a spec proving signed-out behaviour, and a whole-file failure for any other. One role per spec file; a flow proven under two roles is two files
- Scope every test's data with a unique identifier derived from `testInfo.testId`, and assert only against records the test created. The role test users are fixed and shared, including by concurrent CI jobs — no spec may treat its user as private
- Import fixtures from `e2e/support/`. Never authenticate inside a spec, and never commit anything under `e2e/.auth/`
- Use web-first assertions. Never wrap a manual boolean check in `expect()`, and never insert a fixed delay
- Never use `.only`, `.skip`, or an inflated timeout to get a suite green, and never edit application code to make a spec pass — both hide the failure the spec was written to surface

---

## Documentation drift

If the running application contradicts `CORE_FLOWS.md`, that is a finding to report, not something to paper over.

The skill must never edit `CORE_FLOWS.md` to match the application, and must never write an assertion it knows to be wrong in order to make a spec pass. Both actions destroy the only record of what the flow was supposed to do.

When drift is found, the skill:

1. Writes the spec against the documented behaviour, and marks that test `test.fail()` with a comment naming the contradiction
2. Records the contradiction in the summary as a finding, quoting the document line and the observed behaviour
3. Leaves the decision to the developer — either the document is stale and gets amended, or the application is wrong and gets fixed

A skill that silently reconciles the two produces a green suite and a document nobody can trust.

---

## Single agent vs fan-out

The planner decides. Generation runs as a single agent when:

- The input is a single flow ID
- The input is `--permissions` — the whole matrix is one file, so a split would have two workers writing it
- The area contains fewer than four flows
- The flows share so much state that splitting would duplicate fixtures

Generation fans out to 2–5 parallel agents when:

- The input names several areas
- Each worker owns a whole area directory under `e2e/specs/`, with no shared files
- Parallel execution produces genuine wall-clock savings

Fan out per area, never per flow. Flows within an area share fixtures and selectors, so a per-flow split produces duplicated helpers and the merge conflicts the `task-dispatcher` skill already lists under Troubleshooting.

---

## How it works under the hood

Four phases, driven by `.claude/skills/task-dispatcher/scripts/orchestrate.sh` with this skill's own plan, summary and planner prompt passed in as overrides — see Script reference for the exact invocation.

### Phase 1 — Explore

The skill drives the application through the `playwright` MCP server in its own session and resolves one locator per element each spec will touch, as described above. The resolved locator strings are appended to a copy of `scripts/planner-prompt.md` written to `.tasks/test-author/planner-prompt.md`, and that copy is the path handed to `--planner-prompt` — the orchestrator's planner agent runs with `Read,Glob,Grep` and has no browser of its own. If exploration cannot run, the planner is run against `scripts/planner-prompt.md` unchanged, sets `exploration: unverified`, and every worker prompt carries the unverified header comment instead.

### Phase 2 — Plan

The planner reads the input, the flow or role entries it names, the governance documents, and the selectors resolved in Phase 1. It outputs `.tasks/test-author/plan.json` with this structure:

```json
{
  "task_summary": "Brief description of the coverage being written",
  "path": "flow | area | permissions",
  "flow_ids": ["INV-2"],
  "area": "Inventory or null",
  "exploration": "verified | unverified",
  "close_out": {
    "log_file": "docs/agent_context/EXECUTION_LOG_B.md",
    "update_test_reference": true,
    "update_tracker": false,
    "commit_prefix": "test(inventory)",
    "commit_subject": "[derived from the flow or area name]"
  },
  "agents": [
    {
      "id": 1,
      "name": "short-kebab-case-label",
      "prompt": "Fully self-contained prompt including all injected conventions...",
      "depends_on": [],
      "estimated_complexity": "low | medium | high"
    }
  ]
}
```

The plan file lives in this skill's own `.tasks/test-author/` directory and is passed to the orchestrator with `--plan-file`, so it never overwrites the `task-dispatcher` plan at `.tasks/plan.json`. The orchestrator derives its logs directory and status file from the plan file's directory, so worker logs and the status map land under `.tasks/test-author/` too, clear of the dispatcher's. Omitting the flag writes `.tasks/plan.json` instead and destroys whatever dispatch plan was there.

### Phase 3 — Dispatch

Workers are launched respecting dependency order, as `claude -p --model opus --effort <medium|high> --allowedTools "Read,Edit,Write,Bash"` in the project directory, with the prompt on stdin. Effort follows each worker's `estimated_complexity` (the routing table in `docs/general_docs/TOOLKIT.md`). Worker output is captured to `.tasks/test-author/logs/agent-<id>-<name>.log` — the logs directory follows the overridden plan file's directory. Workers write specs only — a worker that finds itself editing application code has misread its brief and must stop and report back.

### Phase 4 — Synthesis & close-out

Once all workers finish, a synthesis agent reads the worker logs and the generated specs, then:

1. Updates the Flow Coverage Map in `docs/agent_context/TEST_REFERENCE.md` — one row per flow, marked covered or unverified
2. Updates the Selector Registry in the same file with every locator resolved during exploration
3. Appends an entry to the active phase execution log named in `CURRENT_STATE.md`
4. Writes a summary to `.tasks/test-author/summary.md` — passed with `--summary-file` for the same reason as the plan file — with: which specs were written, which selectors were verified, any documentation drift found, and the commit the close-out made

`orchestrate.sh` carries its own synthesis prompt and exposes no override for it, so the synthesis agent it launches performs the dispatcher's close-out — the execution log entry and the summary. It reads `close_out.update_tracker`, which this skill always sets to `false` because writing specs completes no backlog task. Steps 1 and 2 above are the skill's own work, made once the orchestrator returns and the generated specs are on disk.

The orchestrator's close-out commits the specs and the log entry on the contributor branch, per the commit rule in `AGENTS.md` (Collaborative working). Commit the updates from steps 1 and 2 as a slice of their own. The skill never pushes or opens a pull request.

---

## Script reference

The skill ships no orchestrator of its own. It reuses `.claude/skills/task-dispatcher/scripts/orchestrate.sh` for the three-phase pattern, the dependency handling and the log layout, and passes its own paths through the script's three override flags.

Planner prompt: `.claude/skills/test-author/scripts/planner-prompt.md`. It takes the same `{{TASK_INPUT}}`, `{{PROJECT_DIR}}`, `{{MAX_AGENTS}}` and `{{PROJECT_TREE}}` substitutions the dispatcher's planner prompt takes, so the orchestrator's Python substitution step works on it unchanged.

All three overrides are mandatory. The defaults belong to `task-dispatcher` — `.tasks/plan.json`, `.tasks/summary.md` and the dispatcher's own planner prompt — so a run that omits any of them drives the workers from the wrong planner and destroys the dispatch output the developer is told to review. They are also the whole contract: the orchestrator derives its logs directory and status file from the plan file's directory unless they are set explicitly, so the three overrides fully isolate a test-author run — no `LOGS_DIR` or `STATUS_FILE` override needed.

```bash
# Start the application the exploration step drives
pnpm dev

# Confirm the playwright MCP server is registered and connected
claude mcp get playwright

# Drive the workers — this skill's planner prompt, plan file and summary file.
# Point --planner-prompt at the Phase 1 copy carrying the resolved selectors
bash .claude/skills/task-dispatcher/scripts/orchestrate.sh \
    --planner-prompt .tasks/test-author/planner-prompt.md \
    --plan-file .tasks/test-author/plan.json \
    --summary-file .tasks/test-author/summary.md \
    "INV-2"

# Degraded path — no exploration, so the shipped planner prompt is used as-is.
# --plan-only stops after planning so the worker prompts can be inspected
bash .claude/skills/task-dispatcher/scripts/orchestrate.sh \
    --planner-prompt .claude/skills/test-author/scripts/planner-prompt.md \
    --plan-file .tasks/test-author/plan.json \
    --summary-file .tasks/test-author/summary.md \
    --plan-only "INV-2"

# Launch a single generation worker by hand — one per agent entry in .tasks/test-author/plan.json
claude -p "<agent prompt>" --model opus --effort medium --allowedTools "Read,Edit,Write,Bash"

# Confirm every generated spec is collected — a file that lists no tests is misnamed
pnpm exec playwright test --list

# Run the specs the skill produced, once the project's test harness is configured
pnpm test:e2e
```

Environment variables:

- `AGENT_TIMEOUT` — per-agent timeout in seconds (default: 600)
- `MAX_AGENTS` — maximum parallel agents (default: 5)
- `PLAN_FILE`, `SUMMARY_FILE`, `PLANNER_PROMPT` — the same three overrides, if passing flags is inconvenient
- `LOGS_DIR`, `STATUS_FILE` — derived from `PLAN_FILE`'s directory unless set explicitly, so with the overrides above they land at `.tasks/test-author/logs/` and `.tasks/test-author/status.json`

**Exploration and the orchestrator's planner.** `orchestrate.sh` launches its planner agent with `--allowedTools "Read,Glob,Grep"`, which carries no `playwright` MCP tools, so the planner cannot resolve a selector itself. That is why Phase 1 explores in the skill's own session and appends the resolved locators to `.tasks/test-author/planner-prompt.md`. Passing the shipped `scripts/planner-prompt.md` instead is the degraded path, and every spec the run produces carries the unverified header comment.

---

## Onboarding gate

Before doing anything else, the skill inspects `docs/agent_context/CURRENT_STATE.md` and verifies two things:

1. `Active phase:` has a non-placeholder value (does not start with `[` and does not contain "e.g.")
2. `Active execution log:` points at a file path that actually exists on disk

If either check fails, the skill exits immediately with a clear message:

> Onboarding has not been run. The test-author skill requires populated context documents. Run `docs/agent_context/ONBOARDING.md` first, then return.

It is the same check `task-dispatcher` runs. The onboarding check at the top of `AGENTS.md` reaches the same answer another way, by looking for project content in the context documents. It also stops the skill generating specs against `CORE_FLOWS.md` while that document still holds nothing but the Area Template.

---

## Troubleshooting

**Skill refuses to run — "Onboarding has not been run".** Expected. Complete onboarding first, then try again.

**Every generated spec carries the unverified header comment.** Exploration did not run. Either the application was not reachable at the config's `baseURL` or the `playwright` MCP server was not connected. Start the application, check `claude mcp get playwright`, and re-run the same input — the skill overwrites unverified specs with verified ones.

**MCP browser tools hang or report a profile conflict.** Two instances are competing for one browser profile. Confirm `--isolated` is present in the repo-root `.mcp.json`, and do not run two exploration passes concurrently.

**Planner cannot find the flow ID.** The input did not match any flow heading in `CORE_FLOWS.md`. Check the exact ID — flow IDs are `[Area Prefix]-[N]`, not issue numbers — and confirm the flow has actually been documented.

**A generated spec reports no tests found, or the suite goes green without running it.** The spec sits outside every project's directory, so no project collects it. Flow specs must sit under `e2e/specs/[area]/`, the permission suite must be `e2e/permissions/permission-matrix.spec.ts`, and accessibility specs must sit under `e2e/a11y/`. Each project collects a plain `**/*.spec.ts` under its own directory, and Playwright never errors on a spec that belongs to no project — move the file and re-run.

**Every test in a generated spec fails as though nobody is signed in.** The file is missing its `test.use({ storageState: storageStateFor('ROLE') })` declaration. Signed out is the default because no project sets a default `storageState` — add the declaration above the first `describe` block.

**A generated permission spec passes but the element is only disabled.** The spec asserted `toBeDisabled()` or `not.toBeVisible()` instead of `toHaveCount(0)`. That is a convention violation, not a passing test. Fix the assertion and re-run — never accept it because it is green.

**A generated permission spec passes but the page under it is broken.** The spec hand-rolled `toHaveCount(0)` instead of calling `expectAbsent`, so it asserted absence without first proving the page rendered — it passes on a 500, on an empty error shell, and on a redirect to sign-in, and the gate was never exercised. Replace it with an `expectAbsent` call, which cannot be made without a render proof.

**Generated spec contradicts the documented flow.** Documentation drift. The skill reports it as a finding rather than resolving it. Decide whether `CORE_FLOWS.md` or the application is wrong, fix that, then re-run the skill.

**The task-dispatcher's plan or summary was overwritten by a test-author run.** The orchestrator was invoked without `--plan-file` and `--summary-file`, so it wrote its own defaults, `.tasks/plan.json` and `.tasks/summary.md` — and because the logs directory and status file follow the plan file's directory, `.tasks/logs/` and `.tasks/status.json` too. Everything is regenerated by the next dispatch, so nothing is permanently lost, but any dispatch summary not yet reviewed is gone. Always pass all three overrides — see Script reference.

**Every generated spec follows the task-dispatcher's conventions rather than the testing conventions.** The orchestrator was invoked without `--planner-prompt`, so the plan came from the dispatcher's planner prompt and no worker was given the testing block. Discard the specs and re-run with the flag.

**Merge conflicts between parallel workers.** The planner split one area across multiple workers. Treat this as a planner bug — areas are the fan-out unit. Re-run with `--max-agents 1` for this input.
