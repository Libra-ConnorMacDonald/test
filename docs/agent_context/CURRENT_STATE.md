# Current State

> **Update this file when the active phase or blockers change**, per the Current state step in
> `docs/general_docs/CLOSE_OUT.md`. Nothing else here changes from session to session.
> Keep it to 3–5 lines maximum. This is the fastest context catch-up for a new session.
> Only what cannot be derived from GitHub lives here — everything else is queried live.

- **Active phase:** [e.g. Phase A — Foundation — must match the milestone title exactly]
- **Active execution log:** [e.g. `docs/agent_context/EXECUTION_LOG_A.md`]
- **Blockers or known issues:** [brief note, or "None"]

---

## Derived state — query, never store

The task backlog lives in GitHub Issues. These facts are read live at session start and
must never be written into this file, so they can never go stale:

- **In progress:** `gh issue list --state open --search "assignee:*" --milestone "<active phase>"`
- **Last completed:** `gh issue list --state closed --search "reason:completed sort:updated-desc" --limit 1 --json number,title,closedAt`
  — the search qualifiers matter: without them the newest *created* closed issue comes back, and not-planned closures count as completed.
- **Next up (frontier):** the lowest-numbered open issue in the active milestone with no assignee, no open blockers, that is not an epic and has no open sub-issues — see `docs/general_docs/TASK_HIERARCHY.md` (Working order):

```bash
gh issue list --milestone "<active phase>" --state open --limit 200 \
  --json number,title,assignees,blockedBy,issueType,labels,subIssuesSummary \
  --jq '[.[]
        | select((.assignees|length)==0)
        | select((.issueType.name // "") != "Epic")
        | select([.labels[]?.name] | index("epic") | not)
        | select([.blockedBy.nodes[]? | select(.state=="OPEN")]|length == 0)
        | select(((.subIssuesSummary.total // 0) - (.subIssuesSummary.completed // 0)) == 0)]
       | sort_by(.number) | .[0]
       | if . == null then "no unblocked work in this milestone" else "#\(.number) \(.title)" end'
```

  The details matter: `blockedBy` is an object carrying `.nodes` and `.totalCount`, not a bare array — an array-shaped filter silently matches nothing and reads as "no work left". The explicit `--limit 200` matters too: the default page of 30 would hide the oldest issues.

Reading one task: `gh issue view <number> --comments`. Do not list the whole backlog into
context — read the specific issue.
