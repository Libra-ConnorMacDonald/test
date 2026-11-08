# Scope & Request Triage

> The front door for every new request. Read this file first — before any other
> reference document — whenever a request arrives that is not already an open
> issue. It answers three questions: is this in scope, where does
> the depth live, and what must be asked before any work begins.
>
> **Rules:**
> - Keep the populated content lean — this file is read whole, often. The Product Statement stays under 5 lines, every table row stays on one line, and no prose is added beyond what the scaffold ships
> - One line per scope area — depth lives in the reference documents, never here
> - Update immediately when scope changes — a stale scope map misroutes every future request
> - Never delete a ledger entry — append a new line if an outcome changes
> - The Request Intake Checklist ships with this scaffold — populate around it, never rewrite it

---

## Product Statement

> 3–5 lines maximum: who it is for, what it does, and what the current phase is aiming at.

*Populated during onboarding from Section 1 of `ONBOARDING.md`.*

---

## In Scope — Functional Areas

> The routing map. One line per area: what it covers, then pointers to where the
> depth lives. Match a request to an area and that line's pointers scope the flow,
> schema, and permissions reading — open only the named sections of those documents.
> The Agent Session Protocol's other reference documents (UI patterns, routing,
> server logic, database, tests) still apply per their own conditions.
> Each area maps to one epic (`docs/general_docs/TASK_HIERARCHY.md`) — created
> during onboarding, or when the area enters scope — and the Epic column is where
> that mapping lives.

| Area | Epic | Covers | Flows (`CORE_FLOWS.md`) | Tables (`SCHEMA_REFERENCE.md`) | Roles |
|---|---|---|---|---|---|
| *[Area name]* | *[epic issue number, e.g. #12]* | *[one-line boundary of what this area does]* | *[flow IDs, e.g. BK-1–BK-4]* | *[table names]* | *[roles involved]* |

*Populated during onboarding from Section 4. Add a row whenever a new area enters scope.*

---

## Out of Scope — Non-Goals

> Things this application deliberately does not do. Each entry carries the why —
> that is what turns a repeat request into a lookup instead of a debate.

| Non-goal | Why | Decided |
|---|---|---|
| *[what will not be built]* | *[deferred to Phase N / ruled out because X]* | *[date]* |

*Populated during onboarding from Sections 1 and 4. Deferred flows are also listed in `CORE_FLOWS.md` — this table is the summary; that file is the detail.*

---

## Request Intake Checklist

Run this before any planning or specification work on a new request — whatever the
source: customer ask, meeting outcome, internal testing, bug report.

1. **Provenance** — record where the request came from and when. If the request
   arrived without a source, ask the developer for it.
2. **Scope verdict** — match the request against the In Scope and Non-goals tables
   above and the Deferred & Parked Requests ledger below. The verdict picks the
   route; the only stops are the exits in step 5:
   - **In scope** — it fits an In Scope area. Note the area; that line's pointers
     scope the reading for planning, and its Epic column names the parent for the
     new issue. Cross-cutting infrastructure requests (tooling, tests, CI, build)
     fit the standing Foundation row. On a project onboarded before the hierarchy
     existed — no Epic column, no epics — ask the developer whether to backfill
     epics per area or create the issue without `--parent`. Continue to step 3,
     then take the Task exit.
   - **Already decided** — it matches a Non-goal or a ledger entry. Surface that
     line to the developer — do not re-litigate. If the decision stands, take the
     Ledger exit and record the re-request. If the developer overrules it, treat
     the request as in scope — and annotate the row that held the old decision,
     never delete it.
   - **Scope extension** — it fits no area, and so no epic, and matches no prior
     decision. Only the developer can extend scope. Note the nearest area,
     continue to step 3 to gather the open questions, and take the Decision-needed
     exit. If the developer approves, the epic and the In Scope row are created
     together — build the epic body from `.github/ISSUE_TEMPLATE/epic.md`, then
     `gh issue create --title "<epic title>" --body-file <file> --label epic`
     (add `--type Epic` where the organisation has configured issue types; no
     milestone — epics span phases) and record the returned number in the new
     row's Epic column — or neither is created.
3. **Missing information** — identify the questions the request's concerns trigger.
   Ask them now for an in-scope request; for a scope extension, carry them
   unanswered into the Decision-needed exit:
   - Touches permissions → which roles can see or do this?
   - Touches data → new fields or tables? Any derived-not-stored, immutability, or audit rules?
   - Touches UI → which page or component? What are the empty, error, and loading states?
   - Changes user-facing behaviour → what proves it works — which flow needs end-to-end coverage?
   - Bug report → expected vs actual behaviour, and exact steps to reproduce?
4. **Branch and collision check** — in-scope requests heading for the Task exit
   only. Skip for the Ledger and Decision-needed exits: nothing is being built, so
   nothing needs a branch. See `docs/general_docs/COLLABORATION.md`:
   - The branch name is `{user}/{issue-number}-{slug}` — the pattern in
     `.claude/collab.json`, e.g. `ste/123-booking-form`. The number only exists
     once the issue is created, so derive the name at the Task exit, right after
     creation. Do not cut the branch here; the `task-dispatcher` skill cuts it at
     dispatch.
   - Compare the request's planned file changes — the draft lists that will
     become the issue's Files to create and Files to modify sections — against
     the files touched by open pull requests and the Files sections of open
     issues:
     ```bash
     gh pr list --json number,headRefName,files
     gh issue list --state open --json number,title,body
     ```
   - If another contributor's live work touches the same files, surface it to the
     developer now, with the overlapping paths and the pull request or issue that
     holds them. Sequencing the two tasks, narrowing the scope, or assigning both
     to the same contributor are all cheaper here than a conflict at merge time.
     The developer decides — do not silently proceed.
5. **Exit** — every intake ends in exactly one of three ways:
   - **Task** — default: create a GitHub issue. Size it first by the sizing rule
     in `docs/general_docs/TASK_HIERARCHY.md` (Sizing a ticket): one area, a
     handful of acceptance criteria, fits one session. Work that fails it becomes
     a ticket plus subtasks, each sized by the same rule. Build the body from the
     `.github/ISSUE_TEMPLATE/task.md` sections in a temp file, carrying the
     provenance from step 1 in its Source section and the matched area's epic
     number in its Parent section, then
     `gh issue create --title "<task title>" --body-file <file> --label task`
     (`bug` for bug reports) `--milestone "<active phase>"` `--parent <epic number>`
     — plain title, no ID prefix; where the organisation has configured issue
     types, also pass `--type Task` (or `--type Bug` for bug reports) — and
     capture the returned issue number. For a subtask being split out of an
     existing ticket, the parent is the ticket, not the epic — see
     `docs/general_docs/TASK_HIERARCHY.md`. Derive the branch name
     `{user}/{number}-{slug}` and update the body's Branch section
     (`gh issue edit <n> --body-file <updated>`), then wire dependencies with
     `gh issue edit <n> --add-blocked-by <m>` for each blocker. Take the ad-hoc plan-mode
     route instead only when the developer wants the fix actioned immediately in
     this session — then record its provenance in the Provenance field of its
     `EXECUTION_LOG_BUGFIX.md` entry when it is written. The Agent Session
     Protocol reading order begins here.
   - **Ledger** — add a line to Deferred & Parked Requests below, and stop.
   - **Decision needed** — write a ledger line with outcome `parked — decision
     needed` now, present the scope question to the developer with the unanswered
     questions from step 3, and stop. When they decide, append a follow-up ledger
     line and re-enter at step 2.

If this file still contains only scaffold placeholders, do not guess a verdict —
ask the developer directly whether the request is in scope, and record the answer here.

---

## Deferred & Parked Requests

> The ledger. Every request that was triaged and not built gets one line, newest
> first. When an outcome later changes — a deferred request is delivered, a parked
> one is decided — append a follow-up line, never edit the original. This is what
> makes a repeat request recognisable in seconds.

| Date | Request | Source | Outcome |
|---|---|---|---|
| *[date]* | *[one-line summary]* | *[customer / meeting / internal testing / bug report]* | *[deferred to Phase N / parked — decision needed / rejected: reason]* |
