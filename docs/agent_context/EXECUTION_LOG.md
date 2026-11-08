# Execution Log Index

> The execution log is split by phase. Each phase has its own log file.
> Bug fixes have their own log, `EXECUTION_LOG_BUGFIX.md`.
>
> **This file is an index only. Do not write task entries here.**
> Write entries in the correct phase log file.

---

## Log Files

> Phase log files are created during onboarding from the phase milestones —
> `Phase A — Foundation` gets `EXECUTION_LOG_A.md`. The list below is populated at that time.

| File | Phase | Status |
|---|---|---|
| `EXECUTION_LOG_BUGFIX.md` | Bug fixes (all phases) | Active throughout project |
| *Phase logs listed here after onboarding* | | |

---

## Which log to write to

- Completing a task from a named phase — write to that phase's log file
- A bug fix, as defined in `EXECUTION_LOG_BUGFIX.md` — write there, whichever phase introduced the bug
- Partial or in-progress work — write a `wip:` entry to the current phase log

## Which log to read

- Start of session — read the last 3–5 entries of the current phase log only
- If the task touches a previously completed area — also check the last 3 entries of `EXECUTION_LOG_BUGFIX.md`
- Do not read logs from completed phases unless specifically investigating a past decision

---

## Entry Format

Every phase log entry uses this format, keyed by its issue number (`### #123 — Task title`).
Bug fixes are keyed the same way, in the format in `EXECUTION_LOG_BUGFIX.md`.

```markdown
### #[ISSUE NUMBER] — [TASK TITLE]
- **Completed:** [date and time]
- **Phase:** [phase letter and name]
- **Files created:** [list every file created, or "None"]
- **Files modified:** [list every file modified, or "None"]
- **Files deleted:** [list every file deleted, or "None"]
- **Git commit:** [commit hash and message, or "Not yet committed"]
- **Decisions made:** [any decisions that differed from the spec and why, or "None"]
- **Known issues:** [anything flagged but not fixed, or "None"]
- **Verified:** [which verification checks were run and passed]
```
