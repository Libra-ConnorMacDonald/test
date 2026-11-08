---
name: task-dispatcher
description: Execute an approved plan against this project template with the template's conventions enforced. Use this skill AFTER the main agent has proposed a plan in plan mode and the developer has approved it. Accepts either a GitHub issue number (backlog task path) or a free-text description (ad-hoc bug fix path). The skill reads DECISIONS.md, the Critical Patterns in AGENTS.md, and the relevant reference documents for the task domain, then injects those conventions into every worker prompt so no worker can violate project rules. Decides single-agent vs parallel fan-out based on genuine benefit. On completion, runs the close-out checklist in docs/general_docs/CLOSE_OUT.md (the issue steps on backlog tasks only), commits the work on the task branch, and stops at a proposed pull request for the developer to approve. Trigger words: "dispatch", "dispatch the task", "run task 123", "dispatch #123", "execute the plan", "run this with conventions", "fan out this work", "parallel agents for this", "dispatch next task", "run the fix with the conventions", "kick off the approved plan". Do NOT use this skill during onboarding — it requires populated context documents.
---

# Task Dispatcher

Executes an approved plan against a project built from this template. Enforces the template's documentation system, conventions, and Agent Session Protocol automatically. Fans out to parallel workers only when genuinely beneficial.

---

## Prerequisites

- Claude Code CLI installed and authenticated (`claude` command available)
- `jq` installed for JSON processing
- Python 3 installed (used for cycle detection, branch-name derivation, and safe template substitution). The script accepts either `python3` or `python` on `PATH` — Windows installs the latter with no `python3` alias
- `git`, and `gh` CLI ≥ 2.94.0 authenticated (`gh auth login`) — `gh` is required on every run: the skill reads, claims, and comments on issues with it. The merge-back commands the close-out proposes wait for the developer's yes
- The project must have completed onboarding — `docs/agent_context/CURRENT_STATE.md` must name a real active phase and active execution log, not scaffold placeholders. The skill checks this and refuses to run if onboarding is still pending.

---

## When to invoke this skill

The skill is invoked **after** the main agent has already:

1. Understood what work is being asked for (either a backlog task or an ad-hoc fix)
2. Read the relevant context documents
3. Proposed a plan to the developer in conversation
4. Received the developer's approval

The skill is not a planning tool. It is an execution tool. The plan-mode conversation that precedes it is where the developer retains control.

---

## Two execution paths

The skill accepts one argument — an issue number or a free-text description — and routes to one of two paths based on what it finds.

### Path 1 — Backlog task

Input looks like an issue number (e.g. `123` or `#123`). The skill:

1. Claims the issue — validates that it is open, not an epic (issue type `Epic`, or the `epic` label where org issue types are not configured, aborts — epics are never dispatched; work its tickets), has no open sub-issues (aborts — the subtasks are the work; dispatch a subtask), not blocked (any open blocked-by issue aborts with a "work the frontier" error), and not already assigned to someone else (aborts naming the existing assignee), then runs `gh issue edit <n> --add-assignee @me`. The assignee is the claim; concurrent sessions see it and skip the task
2. Runs the branch pre-flight — cuts the contributor branch from the integration branch, named from the issue body's **Branch** section or `{user}/{number}-{slug}` (see Branch pre-flight below). Claiming first means a refused claim costs nothing — no branch is cut
3. Fetches the issue — `gh issue view <n> --json number,title,body,labels,milestone,assignees,state,blockedBy` — and injects it into the planner prompt; the planner runs read-only and cannot call `gh` itself
4. Reads the relevant reference documents based on the task's domain
5. Reads `DECISIONS.md` in full
6. Reads the Critical Patterns section from `AGENTS.md`
7. Plans execution (single agent or fan-out)
8. Dispatches workers with all conventions injected into their prompts
9. On completion: runs the close-out in `docs/general_docs/CLOSE_OUT.md` against the active phase execution log, issue steps included (see Phase 3 below)
10. Commits on the task branch with a `feat(phase-X): [title]` message, then presents a summary and the merge-back sequence for the branch: the proposed PR body includes `Closes #<n>` (github-pr), or the close-out proposes `gh issue close <n> --comment "…"` (local-merge). On the github-pr route the skill never closes the issue itself — the merge does

### Path 2 — Ad-hoc bug fix or unplanned change

Input is a free-text description that does not match an open issue number. The skill:

1. Runs the branch pre-flight — cuts a `{user}/fix-{slug}` branch from the integration branch (see Branch pre-flight below)
2. Treats the input as the description of an unplanned change
3. Reads `DECISIONS.md` in full
4. Reads the Critical Patterns section from `AGENTS.md`
5. Reads the last 3 entries of `EXECUTION_LOG_BUGFIX.md`
6. Identifies which reference documents apply based on what is being changed
7. Plans execution (single agent or fan-out)
8. Dispatches workers with all conventions injected into their prompts
9. On completion: runs the close-out in `docs/general_docs/CLOSE_OUT.md` against `EXECUTION_LOG_BUGFIX.md` (not the phase log), and touches no issue
10. Commits on the fix branch with a `fix: [short description]` message, then presents a summary and the merge-back sequence for the branch

---

## Branch pre-flight

Runs before planning — after the onboarding gate, and on the backlog path after the claim — so a failure costs nothing beyond a claim to release (see Troubleshooting). It reads `.claude/collab.json` — see `docs/general_docs/COLLABORATION.md` for the model and the configuration reference.

1. **Already on a contributor branch** — adopts it and continues. Resuming work is the common case and must not cut a second branch.
2. **On a protected branch** — derives the branch name, fast-forwards the integration branch from `origin`, and cuts the branch. The name comes from the issue body's **Branch** section when intake assigned one; otherwise `{user}/{number}-{slug}` from `branchPattern`, or the description for the ad-hoc path.
3. **Protected branch with a dirty working tree** — stops. Uncommitted changes would be carried onto the new branch silently, so the developer stashes them or moves them to a branch, and re-runs.
4. **Integration branch diverged from `origin`** — stops rather than merging. Reconciling a shared branch is a human decision.

No config file, `enabled: false`, or no git repository all skip the pre-flight with a warning. `--no-branch` skips it for a single run.

The pre-flight is the skill's own check, not the same mechanism as the branch guard hook that gates writes on protected branches in every session. Because the guard's default `ask` cannot be answered in a headless session, the orchestrator exports `COLLAB_GUARD_MODE=block` for its workers — the pre-flight has already branched them, so a block is the right failure mode if anything slips. `--no-branch` exports `COLLAB_GUARD=off` instead, honouring the explicit opt-out.

---

## Merge back

The close-out reports how the branch stands against the integration branch (`git rev-list --left-right --count`) and writes the merge-back sequence into `.tasks/summary.md`: the commit it made, then rebase on the integration branch, re-run the suites, run security gate G2 (`/security-review` on the unpushed commits, when they touch code — `docs/general_docs/SECURITY.md` §4), push, then `gh pr create` — with `Closes #<n>` in the body for backlog tasks, so the merge closes the issue — when `mergeStrategy` is `github-pr`, or a `--no-ff` merge followed by `gh issue close <n> --comment "…"` when it is `local-merge`.

The commit is the only step the skill runs, per the commit rule in `AGENTS.md` (Collaborative working). It stages only the files this run changed, and it does not commit at all when HEAD is a protected branch, which `--no-branch` allows. Everything after the commit (rebase, push, pull request, merge) waits for the developer's yes.

---

## How conventions are enforced

The planner reads the template's governance documents and injects their rules into every worker prompt it generates. Workers never read these documents themselves — the planner has already pulled the relevant material in.

Every worker prompt includes:

- **Rules that must never be violated** — every item from `DECISIONS.md`
- **Critical Patterns** — every pattern listed in the Critical Patterns section of `AGENTS.md`
- **Task acceptance criteria** — verbatim from the issue body (backlog path) or from the approved plan (ad-hoc path)
- **Domain-relevant reference material** — extracted sections from the documents that apply to this task:
  - UI work → relevant sections of `UI_PATTERNS.md` and `THEME_GUIDELINES.md`
  - Database work → relevant sections of `SCHEMA_REFERENCE.md` and `DATABASE.md`
  - Routing work → relevant sections of `ROUTING.md`
  - Permissions work → relevant sections of `PERMISSIONS_REFERENCE.md`
  - Server-side work → relevant sections of `SERVER_LOGIC.md`
- **Files the worker owns** — explicit list, with instruction not to touch anything outside that list
- **Colour rule** — colours come only from the CSS custom properties in `app/globals.css`, never a hex value in code: the colour rule in `docs/project_docs/THEME_GUIDELINES.md` §2
- **Big.js rule** — all monetary or precision arithmetic uses Big.js, never native JS floats
- **403 rule** — forbidden routes return 403 using `auth()` and `forbidden()`, gated above any Suspense boundary or in `proxy.ts` (`ROUTING.md`), never redirect
- **Not-rendered rule** — permission-gated elements are not rendered at all, never disabled or CSS-hidden
- **Derived values rule** — calculated values must never be stored, only derived at runtime

A worker that violates any of these rules has produced broken work. The synthesis phase flags violations where detectable.

---

## Single agent vs fan-out

The planner decides. A task runs as a single agent when:

- The file scope is small (typically fewer than 4 files)
- All changes are tightly coupled (splitting would create artificial dependencies)
- The change is a single conceptual unit (copy change, one component edit, one bug fix)

A task fans out to 2–5 parallel agents when:

- The work spans multiple independent areas (schema + API + UI + tests)
- Workers can own non-overlapping files
- Parallelism produces genuine wall-clock savings

The single-agent case still benefits from the skill — the prompt is fully loaded with the template's conventions, and the synthesis phase still runs.

---

## How it works under the hood

Three phases, same as the underlying orchestration pattern:

### Phase 1 — Plan (inside the skill)

Note: this is different from the developer-facing plan-mode conversation that precedes invocation. This is the skill's internal planner that turns the approved plan into worker prompts.

The planner reads the inputs, the issue (or treats the input as a description), and the governance documents. It outputs `.tasks/plan.json` with this structure:

```json
{
  "task_summary": "Brief description of the overall task",
  "path": "backlog | adhoc",
  "task_id": "123 or null",
  "close_out": {
    "log_file": "docs/agent_context/EXECUTION_LOG_A.md or EXECUTION_LOG_BUGFIX.md",
    "update_tracker": true,
    "commit_prefix": "feat(phase-a) or fix",
    "task_id": "123 or null",
    "commit_subject": "<derived from the task title>"
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

### Phase 2 — Dispatch

The orchestrator reads `.tasks/plan.json` and launches agents respecting dependency order. Agents run as `claude -p "<prompt>" --model opus --effort <level> --allowedTools "Read,Edit,Write,Bash"` in the project directory. Workers on the ad-hoc path, or rated `high` complexity, run at `high` effort; the rest run at `medium`. The planner and the synthesis agent run on `opus` at `high`. The routing table in `docs/general_docs/TOOLKIT.md` sets these. Agent output is captured to `.tasks/logs/agent-<id>-<name>.log`.

### Phase 3 — Synthesis & close-out

Once all workers finish, a final synthesis agent runs. It reads all worker logs and the current state of the project, runs the type check and linter, then:

1. Runs "After every task" in `docs/general_docs/CLOSE_OUT.md`, with these differences:
   - the log entry goes to the file the plan names: the phase log, keyed by `#<n>`, on the backlog path, or the bug-fix log on the ad-hoc path
   - the issue steps run on the backlog path only
   - it never edits `AGENTS.md` or `CLAUDE.md`: it notes any change needed in the summary for the developer to approve
   - where it is unsure whether scope changed, it flags the question in the summary rather than guessing
   - it skips estimate calibration, since the developer's session holds the estimate
2. Commits the files this run changed on the task branch, never on a protected branch. The subject takes a `wip: ` prefix if a worker or a check failed
3. Writes a summary to `.tasks/summary.md` with: what was done, which files changed, which checks passed, any known issues, the commit it made, and the merge-back sequence. On the backlog path the proposed PR body includes `Closes #<n>` (github-pr), or the summary proposes `gh issue close <n> --comment "…"` (local-merge)

The skill never pushes or opens the pull request, and on the github-pr route it never closes the issue — the merged PR's `Closes #<n>` does. The developer reviews `.tasks/summary.md` and the commit, then approves the merge-back.

---

## Script reference

Main script: `scripts/orchestrate.sh`.

```bash
# Execute a backlog task (input matches an open issue number)
bash scripts/orchestrate.sh 123

# Execute an ad-hoc fix (free-text description)
bash scripts/orchestrate.sh "Fix the race condition in the session refresh logic"

# Plan only — show what would be dispatched without executing.
# Does not claim the issue — inspection runs never mutate tracker state
bash scripts/orchestrate.sh --plan-only 123

# Dispatch from an existing plan.json (useful if planning and execution are separated)
bash scripts/orchestrate.sh --dispatch-only

# Skip the onboarding check (use with care — only if you know what you're doing)
bash scripts/orchestrate.sh --skip-onboarding-check 123

# Skip the branch pre-flight and work on whatever branch is checked out
bash scripts/orchestrate.sh --no-branch 123
```

Environment variables:

- `AGENT_TIMEOUT` — per-agent timeout in seconds (default: 600)
- `MAX_AGENTS` — maximum parallel agents (default: 5)

---

## Onboarding gate

Before doing anything else, the skill inspects `docs/agent_context/CURRENT_STATE.md` and verifies two things:

1. `Active phase:` has a non-placeholder value (does not start with `[` and does not contain "e.g.")
2. `Active execution log:` points at a file path that actually exists on disk

It also verifies that `gh auth status` succeeds — the backlog lives in GitHub Issues, so without an authenticated `gh` no task can be read or claimed.

If any check fails, the skill exits immediately with a clear message:

> Onboarding has not been run. The task-dispatcher skill requires populated context documents. Run `docs/agent_context/ONBOARDING.md` first, then return.

This approach is more robust than string-matching scaffold placeholders — it false-positives less, and it catches cases where the log file has been deleted or moved after onboarding completed.

The check matches the gate at the top of `AGENTS.md` and ensures the skill never dispatches workers with empty context.

---

## Troubleshooting

**Skill refuses to run — "Onboarding has not been run".** Expected. Complete onboarding first, then try again.

**Pre-flight stops — "HEAD is 'main', which is protected, and the working tree is dirty".** Stash first, or move the changes to a branch yourself. The pre-flight will not move uncommitted work onto a new branch on your behalf, because that silently changes which branch those changes belong to.

**Pre-flight stops — integration branch cannot fast-forward.** The local integration branch has diverged from `origin`. Reconcile it manually, then re-run. The skill will not merge or reset a shared branch.

**Aborts at the claim step — "Cannot read issue #n".** Numeric input that matches no readable open issue aborts here; it is never downgraded to ad-hoc. Check the number with `gh issue list` and confirm `gh auth status` succeeds, then re-run. Non-numeric input always runs the ad-hoc path.

**Aborts at the claim step — "Issue #n is an epic".** Epics are containers and are never dispatched — dispatch one of its tickets or subtasks instead. Find the next workable one with the frontier query in `docs/agent_context/CURRENT_STATE.md`.

**Aborts at the claim step — "Issue #n has open sub-issues".** The ticket has been split, and the slices are the work — dispatch a subtask instead. List them with `gh issue view <n> --json subIssues --jq '.subIssues[] | "#\(.number) \(.title) (\(.state))"'` — the default `gh issue view` output does not show sub-issues.

**Aborts at the claim step — "already claimed by <login>".** Another session holds the issue — pick a different task. If the claim is stale (that session was abandoned), remove the assignee with `gh issue edit <n> --remove-assignee <login>` and re-run.

**A dispatch was aborted after claiming.** The assignee stays set, so other sessions will skip the issue. Release it with `gh issue edit <n> --remove-assignee @me` so it returns to the frontier.

**Worker fails with convention violation.** Worker prompt was correctly injected with rules but the worker produced non-compliant code. Check the worker log in `.tasks/logs/`, fix the specific violation, and re-run the synthesis phase with `--synthesis-only`.

**Merge conflicts between parallel workers.** The planner assigned overlapping files to multiple workers. Treat this as a planner bug — re-run with `--plan-only` first to inspect the plan, and if the overlap is real, run with `--max-agents 1` to force single-agent execution for this task.

**Dependency deadlock.** Cycle detection failed somehow. Check `.tasks/plan.json` by hand and fix the `depends_on` values, then run `--dispatch-only`.

**Aborts with "Plan depends on agents it does not define".** A `depends_on` entry names an agent id that is not in the plan. The run stops before any worker starts and lists each bad entry. Fix the ids in `.tasks/plan.json`, then run `--dispatch-only`, or re-plan.
