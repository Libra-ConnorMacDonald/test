# Execution Log — Bug Fixes

> This file records every bug fix, whichever phase introduced the bug.
> Append new entries chronologically. Do not edit existing entries.
>
> **What counts as a bug fix:** a change that makes the product do what was already
> specified or delivered, and nothing more. That covers an issue labelled `bug`, a
> failure a test run exposed, and an unplanned fix actioned straight away. New or changed
> behaviour is a task for the phase log, even when it was reported as a bug, and a defect
> in work still in progress belongs to that work's own task. Other documents point here
> rather than defining the term.
>
> **Reading rule:** Check the last 3 entries here when working on any task that
> touches a previously completed area of the codebase.

---

## Format

```markdown
### #[ISSUE NUMBER] — [Short description]
- **Completed:** [date and time]
- **Provenance:** [who reported it, through what channel, and the phase or task where it was found]
- **Root cause:** [what caused it]
- **Files modified:** [list]
- **Git commit:** [hash and message]
- **Known issues:** [any follow-up needed, or "None"]
- **Verified:** [verification checks run and passed]
```

An unplanned fix with no issue uses `ad-hoc` in place of the number
(`### ad-hoc — [Short description]`), and its Provenance field is its only record of
where the request came from.

---

## Bug Fix Log

*No entries yet. Populated as bugs are fixed during development.*
