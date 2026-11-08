# Glossary

> One line per term the template uses with a specific meaning. Each entry points to
> the document that owns the definition: read that document for the rules, and
> change the definition there, not here. If a term here and its owning document
> disagree, the owning document wins and this file is the bug.

---

## Work and planning

| Term | Meaning | Owned by |
|---|---|---|
| Area | A functional part of the application, such as Invoices, with a prefix and its own flows. One In Scope row and one epic per area | `docs/agent_context/CORE_FLOWS.md`, `docs/agent_context/SCOPE.md` |
| Claim | Assigning yourself to an issue before any work starts, so other sessions skip it | `AGENTS.md` (Task tracker) |
| Contract ticket | A small ticket that defines only a shared interface (a type, a table, a signature) so two dependent tickets can then run in parallel | `docs/general_docs/TASK_HIERARCHY.md` (Writing tickets that can run side by side) |
| Epic | A workstream issue that groups tickets by theme. Never assigned, branched or dispatched, and carries no milestone | `docs/general_docs/TASK_HIERARCHY.md` |
| Flow | One user or background journey through an area: trigger, roles, steps, rules, tables, routes and UI states | `docs/agent_context/CORE_FLOWS.md` |
| Flow ID | A flow's identifier, the area prefix and a number, such as `INV-2`. Specs and journeys are named after it | `docs/agent_context/CORE_FLOWS.md` |
| Foundation epic | The standing epic that parents cross-cutting infrastructure work: the test harness, tooling, CI and the build | `docs/general_docs/TASK_HIERARCHY.md` (Choosing the parent at intake) |
| Frontier | The next workable task: the lowest-numbered open, unassigned, unblocked issue in the active milestone that is not an epic and has no open sub-issues | `docs/general_docs/TASK_HIERARCHY.md` (Working order) |
| Intake | The Request Intake Checklist every new request goes through before planning. It ends in a task issue, a ledger line or a scope decision | `docs/agent_context/SCOPE.md` |
| Milestone | The GitHub milestone for a phase, titled exactly as the phase. Tickets and subtasks carry one; epics do not | `AGENTS.md` (Task tracker) |
| Phase | A stage of delivery, such as Phase A, with its own milestone and its own execution log. The active phase is named in `CURRENT_STATE.md` | `docs/agent_context/CURRENT_STATE.md`, `docs/agent_context/EXECUTION_LOG.md` |
| Request ledger | The Deferred & Parked Requests table: one line per request that did not become a task, and what happened to it | `docs/agent_context/SCOPE.md` (Deferred & Parked Requests) |
| Sizing rule | Every ticket covers one area, has a handful of acceptance criteria and fits one session; work that does not is split into subtasks. A ticket needing a second handoff is split too | `docs/general_docs/TASK_HIERARCHY.md` (Sizing a ticket) |
| Subtask | A slice of a ticket that is too large or too parallel for one pull request. Its own issue, branch and pull request | `docs/general_docs/TASK_HIERARCHY.md` |
| Ticket | One unit of deliverable work: one issue, one branch, one pull request, one execution log entry | `docs/general_docs/TASK_HIERARCHY.md` |

## Branches and parallel work

| Term | Meaning | Owned by |
|---|---|---|
| Contributor branch | The short-lived branch one person or session works a task on, cut from the integration branch and merged back through the merge route | `docs/general_docs/COLLABORATION.md` |
| Go-live cut | The one-time change at first release when `dev` is created and becomes the integration branch | `docs/general_docs/COLLABORATION.md` (The go-live cut) |
| Hotspot file | A file almost every ticket wants to change, such as `package.json`. Only one in-progress ticket may change each one. Listed in `hotspotFiles` | `docs/general_docs/COLLABORATION.md` (Parallel work), `.claude/collab.json` |
| Integration branch | The long-lived branch every contributor branch merges into. `main` before go-live, `dev` after. Named in `integrationBranch` | `docs/general_docs/COLLABORATION.md`, `.claude/collab.json` |
| Protected branch | A branch no one edits directly. The branch guard asks before the first write on one | `docs/general_docs/COLLABORATION.md` (Protected branches and the guard) |
| Release branch | The branch that mirrors production. The same as the integration branch before go-live, `main` after. Named in `releaseBranch` | `docs/general_docs/COLLABORATION.md`, `.claude/collab.json` |
| Wave | The set of tickets started together, chosen so none share a file, a hotspot or a migration slot | `docs/general_docs/COLLABORATION.md` (Building a wave) |

## Quality and security

| Term | Meaning | Owned by |
|---|---|---|
| G1 | Security gate at task level: the per-task checklist for every area touched, run in Self-Verify | `docs/general_docs/SECURITY.md` §4 |
| G2 | Security gate before a push, pull request or merge: `/security-review` and the dependency audit | `docs/general_docs/SECURITY.md` §4 |
| G3 | Security gate before a release: a full audit, header and baseline scans of a preview, a secrets scan | `docs/general_docs/SECURITY.md` §4 |
| G4 | Security gate before a pen test is booked: G3 plus the pen-test pack | `docs/general_docs/SECURITY.md` §4 |
| Quarantine | A skipped or known-failing spec, recorded with the open issue that will fix it | `docs/agent_context/TEST_REFERENCE.md` (Quarantine) |
| Render proof | The visible element a permission test asserts before asserting a gated element is absent, so a broken page cannot pass | `docs/general_docs/TESTING_STANDARDS.md` |
| Self-Verify | Step 3 of the task execution protocol: the correctness, data, UI, security and testing checks before a task is reported complete | `AGENTS.md` (Task execution protocol) |

## Documents and sessions

| Term | Meaning | Owned by |
|---|---|---|
| Checkpoint | The first context threshold: commit the work so far on the ticket's branch. The status line shows `checkpoint` | `docs/general_docs/HANDOFF.md` (Context thresholds) |
| Close-out | The checklist run after every task and before a session ends: logs, decisions, scope, journeys, the issue comment and the commit | `docs/general_docs/CLOSE_OUT.md` |
| Execution log | The per-phase record of completed tasks, keyed by issue number. Bug fixes go in `EXECUTION_LOG_BUGFIX.md` | `docs/agent_context/EXECUTION_LOG.md` |
| Handoff | A comment on an unfinished ticket's issue, in a fixed format and at most 8,000 characters, from which a fresh session continues the work. The ticket stays assigned and carries the `handoff` label until resumed | `docs/general_docs/HANDOFF.md` |
| Handoff threshold | The second context threshold: hand off at the next clean point, and start no new acceptance criterion. The status line shows `hand off` | `docs/general_docs/HANDOFF.md` (Context thresholds) |
| Onboarding | The one-time interview that fills the context documents and creates the backlog in a new project | `docs/agent_context/ONBOARDING.md` |
| Scaffold | A context document in `docs/agent_context/` as the template ships it: placeholders, italic guidance and entry templates, filled in by onboarding | `docs/agent_context/ONBOARDING.md` |
