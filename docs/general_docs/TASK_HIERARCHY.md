# Task Hierarchy

> How work is structured in GitHub Issues: epics at the top, tickets underneath,
> subtasks under those. Read this before creating any issue, and before picking up
> work, because the level an issue sits at decides what belongs in its body and
> whether it can be worked at all.
>
> **Rules:**
> - All three levels are ordinary GitHub issues. The hierarchy is the parent and sub-issue relationship, nothing else
> - An issue has exactly one parent. Re-parenting is an edit, never a new issue
> - Only tickets and subtasks are worked. An epic is never assigned, never branched, never dispatched
> - Anything that earns a branch earns its own issue number and its own pull request
> - Milestones are time, epics are theme. A ticket carries one of each, and they are independent; an epic carries no milestone

---

## The three levels

| Level | Issue type | What it is | Gets a branch |
|---|---|---|---|
| Epic | `Epic` (label `epic`) | A workstream that outlives any one phase, e.g. "Invoice pipeline", "Test and quality foundation" | Never |
| Ticket | `Task`, `Bug`, `Feature` | One unit of deliverable work: one branch, one pull request, one execution log entry | Yes |
| Subtask | `Task`, `Bug` | A slice of a ticket that is too large or too parallel for a single pull request | Yes |

Most tickets have no subtasks. Split a ticket only when it fails the sizing rule
below, when the work genuinely will not land as one reviewable pull request, or when
two contributors need to work it at the same time without touching the same files. A
subtask that exists only to make a checklist is noise: use the ticket's Acceptance
criteria for that.

The equivalence to Jira, since that is the mental model most people arrive with:
an epic is an epic, a ticket is a story, a subtask is a sub-task, the `Status` field
is the board column, the `Iteration` field is the sprint, and a milestone is the fix
version. The one place the analogy breaks is described under Views below.

---

## Sizing a ticket

Every new ticket is sized to fit one session. Intake (`docs/agent_context/SCOPE.md`)
and onboarding (`docs/agent_context/ONBOARDING.md`) apply this before they create the
issue. A ticket fits when all three hold:

- **One area.** Its files and flows sit in one In Scope area, or in the Foundation
  epic's infrastructure. Work that spans two areas is two tickets, joined by a
  contract ticket if they share an interface.
- **A handful of acceptance criteria.** About five as a starting figure. More than
  that usually means two behaviours that can ship separately.
- **It fits one session.** It can be built and verified, gates included, before the
  session reaches the handoff threshold in `HANDOFF.md`. If you cannot picture that,
  it does not fit.

A ticket that fails any of these is split into subtasks before it is worked, each
sized by the same rule. The starting figures are guesses: the calibration log in
`ESTIMATING.md` records the sessions and handoffs each ticket took, and that is what
tunes them.

### Splitting after a second handoff

One handoff is normal: a session ended or filled up mid-ticket. A ticket that needs a
second handoff was too big, so the remaining work is split before anyone continues it:

1. Finish the second handoff as usual, at a clean point, so the comment records what
   is done.
2. Create a subtask for each slice of the remaining work, parented to the ticket and
   sized by the rule above, with Files sections that do not overlap. Each subtask
   takes over, word for word, the criteria it will deliver; the criteria already
   done stay with the ticket. Show the developer the proposed split and create the
   subtasks on their yes, as the `/handoff` skill does.
3. Release the claim on the ticket and remove its `handoff` label. The subtasks are
   the work now (Working order, below).
4. Cut the first subtask's branch from the ticket's branch at the handoff commit, so
   the work already done lands in its pull request. The other subtasks cut from the
   integration branch as usual, or are blocked by the first where they build on it.

The `handoff` skill counts the earlier handoff comments and stops for the split when
it is about to write the second one.

---

## What belongs in each body

**Epic.** Goal, the boundary of what it covers, and what "done" means for the whole
workstream. Point at the areas and flows it spans in `docs/agent_context/CORE_FLOWS.md`.
No Branch, no Files, no Tests, no Verification: an epic is never implemented directly,
so those sections would be fiction. Use `.github/ISSUE_TEMPLATE/epic.md`.

**Ticket.** The full task body from `.github/ISSUE_TEMPLATE/task.md`: Source, Parent,
Branch, Depends on, Files to create, Files to modify, Acceptance criteria, Tests,
Verification, Gotchas. Everything this template already says about a task applies to
a ticket unchanged. This is the level the `task-dispatcher` skill runs against.

**Subtask.** The same task template, scoped down, with the parent ticket in its Parent
section. Its Files sections must not overlap another subtask of the same parent,
because the point of splitting is that the slices merge independently. It inherits
nothing automatically: state its own acceptance criteria and its own tests, or it
cannot be verified on its own.

---

## Writing tickets that can run side by side

Parallel tickets are only as safe as their Files sections. The scheduling rules are
in `COLLABORATION.md` (Parallel work); these are the habits that make them work.

- **List every file the ticket will touch**, created or modified, tests included.
  Mark each hotspot file from `hotspotFiles` in `.claude/collab.json`. A ticket that
  will generate a migration lists the migrations folder.
- **Keep hotspot changes small and in as few tickets as possible.** A ticket that
  needs a hotspot file for one line still holds it for its whole life. Where one
  ticket can carry the dependency additions or the README update for a group of
  tickets, it frees the rest to run in parallel.
- **Split contract first.** When ticket B needs something ticket A builds, such as
  a type, a schema table, a server action signature or a component's props, do not
  chain B behind all of A. Write a small contract ticket that defines only the
  shared interface, with stubs where needed, and make A and B both blocked by it.
  Once it merges, A builds behind the interface and B builds against it, in
  parallel. A contract ticket owns the files that define the interface; A and B
  then list only their own files.
- **One migration per ticket, and no more tickets with migrations than needed.**
  Group schema changes for a phase into one ticket where they are small, so the
  migration queue stays short.

---

## Choosing the parent at intake

The Request Intake Checklist in `docs/agent_context/SCOPE.md` matches every request to
an In Scope area. That match is what picks the epic: each In Scope area maps to one
epic, recorded in the In Scope table's Epic column, so the routing decision has already
been made by the time the issue is created.

Cross-cutting infrastructure — the test harness, tooling, CI, the build — belongs to
the standing **Foundation** epic created at onboarding and recorded in the In Scope
table like any other area. Infrastructure work is not a scope extension; it parents
there.

If a request fits no existing epic, that is the same signal as fitting no In Scope
area: it is a scope extension, and only the developer can approve it. Create the epic
and the In Scope row together, or do not create either.

---

## Working order

The frontier is what a session picks up when nobody has said what to work on. With a
hierarchy it is no longer simply the lowest open issue, because epics and split parents
are not workable:

**The next task is the lowest-numbered issue in the active milestone that is open,
unassigned, has no open blockers, is not an epic, and has no open sub-issues.**

A ticket with open subtasks is excluded because the subtasks are the work. It becomes
workable again only if its subtasks are all closed, which is usually the moment it
should be closed itself. That close is mechanical, not implied: the final subtask's
pull request carries `Closes` lines for both the subtask and the parent ticket, so the
merge that lands the last slice closes them together. And when a ticket is split after
being claimed, release the claim (`gh issue edit <n> --remove-assignee @me`) — the
subtasks are what get worked now, and a parent that keeps its assignee sits blocked
from the frontier forever.

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

The epic test checks both the issue type and the `epic` label, because org issue types
are optional — where the organisation has not configured them, the label is the
load-bearing marker and every filter and refusal falls back to it.

Note the shape of `blockedBy`: it is an object carrying `.nodes` and `.totalCount`,
not a bare array. A filter written as though it were an array silently matches nothing
and hands the session an empty frontier, which reads as "no work left" rather than as
a broken query.

---

## Creating the hierarchy

Order matters: a parent must exist before a child can point at it.

```bash
# 1. Epic first. No milestone: epics span phases. Omit --type where the org has
#    not configured issue types — the epic label carries the meaning either way.
gh issue create --title "Invoice pipeline" --body-file epic.md --label epic --type Epic

# 2. Tickets, parented to the epic, milestoned to the phase they are scheduled in.
gh issue create --title "Split oversized invoice PDFs" --body-file ticket.md \
  --label task --type Task --milestone "Phase B — Delivery" --parent 12

# 3. Subtasks, parented to the ticket.
gh issue create --title "Extract the page-range splitter" --body-file subtask.md \
  --label task --type Task --milestone "Phase B — Delivery" --parent 34

# Re-parenting and bulk linking after the fact
gh issue edit 35 --parent 34
gh issue edit 34 --add-sub-issue 35,36
gh issue edit 35 --remove-parent
```

Requires `gh` 2.94.0 or later for the issue commands, and the `project` scope for
anything touching the board (`gh auth refresh -s project`). Issue types are configured
once per organisation by an org admin, under Organisation settings, Issue types: add
`Epic` alongside the built-in `Task`, `Bug` and `Feature`.

---

## Views

Set these up once in the Project UI. No API exists for creating views, so this is a
manual checklist, not something an agent can do.

| View | Layout | Filter | Grouped by |
|---|---|---|---|
| Delivery | Board | `-type:Epic -label:epic` | `Status` |
| Epics | Table | `type:Epic` (or `label:epic`) | none — epics carry no milestone; show the `Sub-issues progress` field |
| By epic | Table | none | `Parent issue` |
| Roadmap | Roadmap | `type:Epic` (or `label:epic`) | dates, if the project tracks them |

**The kanban board does not nest.** This is the one real departure from Jira: cards sit
flat in their Status column, so a board cannot show tickets tucked underneath their
epic. Hierarchy is legible in three other places: the Table view grouped by Parent
issue, the `Sub-issues progress` bar on each parent, and the sub-issue list inside an
issue. Filtering the delivery board to exclude epics is what stops them cluttering a
board they can never move across.

Enable the built-in workflows while you are there: auto-add repository items, issue
closed moves to Done, pull request merged moves to Done. Auto-add never backfills, so
issues created before it was switched on must be added in bulk once.

---

## What the hierarchy does not do

Worth stating plainly, because each of these has been assumed at least once and each
assumption costs a sprint:

- **Closing every subtask does not close the parent.** Someone closes the ticket, and
  the close-out in `docs/general_docs/CLOSE_OUT.md` still applies to it
- **A parent does not inherit its children's status, assignee, or milestone.** Set the
  milestone on tickets and subtasks; an epic spanning three phases has no meaningful one
- **Sub-issue progress counts issues, not effort.** Three of five closed means three of
  five, whatever their size
- **Dependencies are not hierarchy.** Use `--add-blocked-by` for sequencing, parents for
  belonging. A ticket blocked by another ticket in a different epic is normal and fine
- **Limits apply.** GitHub currently caps sub-issues at 100 per parent and 8 levels of
  nesting. Both are far beyond this model, which uses three. Re-check the published
  limits before designing anything deeper
