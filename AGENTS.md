# AI Agent Instructions

> The always-on instructions, loaded every session. `CLAUDE.md` imports this file, so edit
> only this one. Keep it short: detail belongs in `docs/`, and a convention for one folder
> belongs in that folder's rule in `.claude/rules/`.
>
> **Changing this file:** propose the change and wait for the developer's approval. Onboarding's
> Critical Patterns and a security step's Critical Pattern lines are the exceptions
> (`docs/general_docs/CLOSE_OUT.md`, "Changing AGENTS.md").
>
> **The Next.js block.** `next dev` (Next.js 16.3 and later) appends a block marked
> `nextjs-agent-rules` to the end of this file. Keep it, never edit inside its markers, and
> commit it with your work: it needs no approval and is not someone else's change.
>
> **Built for Next.js (App Router). All conventions assume Next.js unless otherwise stated.**

---

## ONBOARDING — RUN THIS FIRST ON A NEW PROJECT

First check whether this repository is the template itself: `.claude/template.json` has `"isTemplate": true` and `gh repo view --json nameWithOwner --jq .nameWithOwner` prints its `templateRepo` (if `gh` cannot answer, compare the `owner/name` part of `git remote get-url origin`). Every project made from the template inherits the marker, so never decide on the marker alone. If it is the template, do not onboard: follow `.template/MAINTENANCE.md` and skip the rest of this section.

Otherwise, if `docs/agent_context/CURRENT_STATE.md`, `CORE_FLOWS.md` and `SCHEMA_REFERENCE.md` hold only scaffolds, onboarding has not run. Stop and run it now:

1. Read `docs/agent_context/ONBOARDING.md` in full
2. Run its Step 0: check the repository, then ask the developer for Route A (questionnaire) or Route B (document upload)
3. Follow `ONBOARDING.md` exactly for that route
4. Do no development work until onboarding is complete: context documents and phase logs generated, the backlog in GitHub issues with phase milestones, infrastructure confirmed, and the developer has chosen what to work on first

If the documents are populated, go to the Agent Session Protocol.

---

## AGENT SESSION PROTOCOL

### When a new request arrives

A new request is anything not already an open issue. Before any planning or reading, run the Request Intake Checklist in `docs/agent_context/SCOPE.md`. It ends in a task issue, a ledger line, or a scope decision for the developer. A request heading to a task also gets its branch name and the file-collision check (`docs/general_docs/COLLABORATION.md`). If `SCOPE.md` is unpopulated, ask the developer for the scope verdict, then populate it from the scaffold.

The reading order starts only when intake exits to a task. The matched In Scope line scopes the flow, table and role reading in step 5; the other step 5 documents apply on their own conditions.

### Before starting any task

Read in this order, and no more:

1. **`docs/agent_context/CURRENT_STATE.md`**, always first: active phase, active log, blockers. Derive in progress, last completed and next up with its query commands, never from stored text.
2. **`docs/agent_context/DECISIONS.md`** in full: rules never to violate.
3. **The last 3–5 entries of the current phase log** only. If the task touches a completed area, also the last 3 of `EXECUTION_LOG_BUGFIX.md`.
4. **The task issue only:** `gh issue view <number> --comments`. Never the whole backlog.
5. **Reference sections the task touches**, in `docs/agent_context/`: `CORE_FLOWS.md`, `SCHEMA_REFERENCE.md`, `PERMISSIONS_REFERENCE.md`, `UI_PATTERNS.md`, `ROUTING.md`, `SERVER_LOGIC.md`, `DATABASE.md`, `TEST_REFERENCE.md`.
6. **Standards the task needs**, in `docs/general_docs/`: `ACCESSIBILITY.md` (UI); `ENGINEERING_STANDARDS.md` (dependencies, performance, design system, editing practice); `TESTING_STANDARDS.md` (any behaviour change); `COLLABORATION.md` (whenever the branch is not obvious); `SECURITY.md` (auth, API routes, user data, uploads, AI calls, public routes, client storage, headers or config, dependencies, CI; §4 before every push, PR or merge); **`ESTIMATING.md` whenever you state a duration or effort** (wall-clock build / gates / human time, never developer-days).
7. **`docs/project_docs/`**: the relevant section of any PRD or spec for the task's domain.

### Rules that load by folder

Claude Code loads each when you read or edit a matching file; other agents read it before working there. `.claude/rules/testing.md` for tests, `.claude/rules/api.md` for API routes, Server Actions, `lib/` and `proxy.ts`, `.claude/rules/db.md` for `db/`, and `.claude/rules/ui.md` for components, pages and styles.

### After completing any task

Run the close-out checklist in `docs/general_docs/CLOSE_OUT.md`.

---

## TASK TRACKER

The backlog is **GitHub Issues**, one issue per task; there is no markdown backlog. Full model, views and `gh` version: `docs/general_docs/TASK_HIERARCHY.md`.

- **ID:** the issue number is the only identifier. Branches (`ste/123-booking-form`), log entries, quarantine rows and PRs carry `#123`
- **Phases:** one milestone per phase, titled exactly as the phase (`Phase A — Foundation`)
- **Hierarchy:** epics contain tickets, tickets may contain subtasks (native sub-issues). An epic (type `Epic` or label `epic`) is never assigned, branched or dispatched
- **Body:** `.github/ISSUE_TEMPLATE/task.md` (epics: `epic.md`). Acceptance criteria describe behaviour, never file paths
- **Claim:** `gh issue edit <n> --add-assignee @me` before any work
- **Dependencies:** native blocked-by. "Next up" is always the frontier query (open, unblocked, unassigned, not an epic, no open sub-issues, lowest number in the active milestone), never a stored list
- **Completion:** the merged PR's `Closes #<n>` closes the issue; agents comment, and do not close issues on the `github-pr` route. A split ticket's last subtask PR closes subtask and parent
- **Never delete:** close as not planned with an outcome comment. Split with sub-issues
- **Disclosure:** every comment an agent posts on any issue starts with the line `> Posted by an agent session — YYYY-MM-DD`

---

## WORKING PRINCIPLES

- **Be honest, not agreeable.** If a request rests on a shaky assumption or a better option exists, say so before acting.
- **Code is the source of truth.** A doc that disagrees with the code is a bug: fix the doc in the same pass.
- **Work to the end of the task**, tedious half included. Stop only for a genuine blocker or a question only the developer can answer; never guess between two readings. If the doubt is partial, build what does not depend on it, then ask.
- **Check current best practice online**, against official docs and the installed version, not recall.
- **British English, plain copy.** British spelling in user-facing text; identifiers keep ecosystem convention (`color`). No em dashes, no subtitle repeating its heading, no filler. Keep domain vocabulary.
- **Small, focused changes.** Touch only what the task needs and reuse before adding. A file nearing 2,000 lines: flag it, suggest extractions, wait for a decision. Practice: `ENGINEERING_STANDARDS.md`.
- **No debug residue:** no `console.log`, `debugger`, commented-out code or unused imports. Clean up what you orphaned; mention pre-existing dead code.
- **Commit in slices.** Imperative subject; body says why. Commit only your own work: if other changes are mingled in the tree, stop and flag it.
- **`pnpm`** over `npm` where installed. Keep chat concise.
- **Big.js** for complex monetary or precision arithmetic, never native JavaScript floats.

---

## COLLABORATIVE WORKING

Work never lands directly on a protected branch: every task is built on a contributor branch cut from the integration branch and merged back through a pull request.

- The integration branch is named in `.claude/collab.json`. Never assume `main` or `dev`
- The branch name is assigned at intake and recorded in the issue's **Branch** section; `task-dispatcher` cuts it
- A hook asks the developer before the first file write on a protected branch. If declined, cut a branch. Never disable the guard or set `COLLAB_GUARD=off` or `COLLAB_GUARD_MODE`; say so if you think the decision is wrong
- **The commit rule.** Commit on your own contributor branch without asking, in coherent slices. Always ask before a push, merge or rebase, and before opening or merging a pull request. Never commit to a protected branch, even where the guard let a write through. Where another document says otherwise, this rule wins
- Development sessions never point at the production database

Full model and the go-live cut: `docs/general_docs/COLLABORATION.md`.

---

## DATA SAFETY

**Ask before every data-altering operation**, even when the request implies it: seed scripts, applying migrations (generating the file is fine), `db:push` against a shared or production database, bulk rewrites, destructive commands. State the exact commands and stop. One yes covers one action.

- Before staging, committing or pushing, check the diff for real names, IDs, client exports or fixtures derived from them, `.env*` files, keys and connection strings. If any is already staged or committed, stop and flag it.
- Seed and fixture data is synthetic only: fictional names, `@example.com` addresses.
- Never open raw data files (gitignored exports) without asking: that loads real PII into context. Docs describing their shape are fine.

---

## SECURITY

Full standard, checklists and gates: `docs/general_docs/SECURITY.md`. Read the section §0 names for the task.
Security work runs end to end without asking: the developer is asked only to push or merge, or for a decision that changes the whole app (`SECURITY.md` §4, "Who decides").

- Sanitise and validate every input, parameterise every query, enforce a strong CSP, use CSRF protection where it applies, enforce role-based access with least privilege, and log and monitor errors without ever logging sensitive user information
- Cookies: the auth provider owns its session cookie; the app's own are `HttpOnly`, `Secure` and `SameSite=Lax` or `Strict` (`SECURITY.md` §5.5)
- **G2:** before pushing commits that touch code, run `/security-review` on them (`SECURITY.md` §4)

---

## NEXT.JS

- Prefer Server Components, Server Actions and server functions over API routes unless strictly necessary. API routes respond with `NextResponse.json()`
- **Forbidden is 403, never a redirect.** Gate with `auth()` and `forbidden()` from `next/navigation` (needs `experimental: { authInterrupts: true }`) above any Suspense boundary, or a 403 from `proxy.ts`; never Clerk's `auth.protect({ role })`, which returns 404. Placement: `docs/agent_context/ROUTING.md`
- **Permission-gated elements are not rendered**, not disabled or CSS-hidden. Tests prove the page rendered before asserting absence (`expectAbsent` in `e2e/support/permissions.ts`)
- Browser-only libraries are imported dynamically with `ssr: false`

---

## SUBAGENTS AND SKILLS

- Use parallel agents freely for research and analysis, one focused task each. Their output is advisory: the lead session decides. After major changes, run a review pass
- Model and effort per role: the routing table in `docs/general_docs/TOOLKIT.md`. The lead session runs on Opus at `high` effort
- **`task-dispatcher`** executes an approved plan for an issue or an ad-hoc fix. Plan in conversation first (read the issue with `gh issue view <n> --comments` and the references, propose, wait for approval), then invoke it with the issue number or a description. It injects these conventions into every worker, runs `docs/general_docs/CLOSE_OUT.md`, commits on the task branch and proposes the PR with `Closes #<n>`. It refuses to run before onboarding
- **`test-author`** writes end-to-end specs (a flow, an area, or `--permissions`) once the implementation runs, before Self-Verify. Unit and integration tests are part of the task
- **`test-runner`** runs and triages the suites and never edits application code to make a test pass
- **`handoff`** (`/handoff [issue]`) brings an unfinished ticket to a clean point, commits it on its branch and posts the handoff comment on its issue (`docs/general_docs/HANDOFF.md`). It also covers resuming one
- **`journey-export`** renders `docs/project_docs/USER_JOURNEYS.md` as the customer PDF. Offer it after onboarding and when a fresh version is needed

Each skill's `SKILL.md` under `.claude/skills/` has the detail.

---

## TASK EXECUTION PROTOCOL

Every task follows this sequence. Skip no step.

### 1. Plan
Name every function, section or component to change, their order, what you will implement and every file you will touch. Flag risks and ask if anything is unclear. Verify a provided plan before acting on it. Effort figures follow `docs/general_docs/ESTIMATING.md`. Straightforward: state the plan and proceed. Complex or risky: planning mode, and wait for approval before touching files.

### 2. Implement
Follow this file and the rules for the folders you work in.

### 3. Self-Verify
- **Correctness:** meets the acceptance criteria exactly; permissions, empty, error and loading states handled; a validation schema and role checks on every API route that needs them; `tsc --noEmit` and the linter report zero errors
- **Data:** tables and fields per `SCHEMA_REFERENCE.md`; derived values not stored; audit rows written where required; protected fields protected at the API layer
- **UI:** follows `UI_PATTERNS.md`; colours only from the CSS custom properties in `app/globals.css`, never hex (`THEME_GUIDELINES.md` §2); forbidden routes return 403; gated elements not rendered
- **Security:** `SECURITY.md` §3 for each area touched (G1); G2 before pushing
- **Testing:** a test per acceptance criterion that fails if it breaks, and every test the issue names. Once the harness exists, `pnpm test` passes (a clean type check is not proof of behaviour), and `pnpm test:e2e` for user-facing flow changes. Absence assertions prove render first; forbidden routes assert 403 and no redirect; each page or major UI area touched has an axe-core scan. Detail: `.claude/rules/testing.md`

### 4. Fix
Fix every failing check first. A task is not complete until its tests exist and pass: missing tests are a failing check, never a follow-up, and the close-out (`docs/general_docs/CLOSE_OUT.md`) never runs with tests outstanding. If the harness is not configured, configuring it is the blocking task: say so.

### 5. Report
What was implemented, which checks passed, any departure from the spec and why, and anything that should change in `AGENTS.md` or `docs/agent_context/`.

### 6. Session Close
At the end of every session, and as soon as the developer says they are wrapping up, run "Before the session ends" in `docs/general_docs/CLOSE_OUT.md`. Hand off every unfinished ticket with `/handoff`.

---

## PROJECT SPECIFIC

Stack: `docs/general_docs/TECH_STACK.md`. Folder layout: `docs/general_docs/ENGINEERING_STANDARDS.md`, File Structure.

**Layering rules (enforced):**
- `app/`: pages and API routes only. Server Components by default; mark Client Components with `'use client'`
- `components/`: UI only; may import from `lib/`, never the reverse
- `lib/`: business logic and utilities; never imports from `components/`
- `db/`: schema and migrations only
- `tests/` and `e2e/`: may import from any layer; no layer imports from them. Never put a test fixture or helper in `lib/`
- No circular dependencies between layers

### Critical Patterns

> Populated during onboarding and kept up to date as the project evolves.
> Project-specific implementation rules the agent must never violate.
> Every application will have different patterns — do not assume any pattern applies
> unless it is explicitly listed here.
> If a pattern changes, propose the update before continuing any development work.

*Populated during onboarding from Section 7 of `docs/agent_context/ONBOARDING.md`.*

---

*Propose an update to this file whenever a new universal pattern is established that should apply to all future sessions.*

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
