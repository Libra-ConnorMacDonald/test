# Handoff

> How an unfinished ticket passes from one session to the next. The handoff is a
> comment on the ticket's issue, in the fixed format below, so a fresh session can
> pick the work up from the issue alone. Nothing is written to the project tree.
>
> The `handoff` skill (`/handoff`) writes it: `.claude/skills/handoff/SKILL.md`.

---

## When to hand off

Hand off a ticket when any of these is true:

- **The session is ending and the ticket is unfinished.** This is the step in
  `CLOSE_OUT.md`, "Before the session ends".
- **The context window is getting full.** The status line shows `checkpoint` and
  then `hand off` as context use passes the thresholds below.
- **The developer asks for one**, for example to move the ticket to another
  machine or person.

Only at a clean point:

- Never mid-edit. Finish or revert the change in hand so every file is in a state
  you would commit.
- The ticket's checks pass, or the failing check is the reason for the handoff and
  the comment says which check, the exact command and what fails.
- The work is committed on the ticket's branch (the commit rule in `AGENTS.md`,
  Collaborative working). Never on a protected branch.

A handed-off ticket stays assigned and carries the `handoff` label until a session
resumes it. It is still in progress, not abandoned (`COLLABORATION.md`, Parallel
work).

A ticket's second handoff also splits it: the remaining work becomes subtasks before
anyone continues (`TASK_HIERARCHY.md`, Splitting after a second handoff).

---

## Context thresholds

This is the one place the thresholds are written down. The status line
(`CHECKPOINT_TOKENS` and `HANDOFF_TOKENS` in `.claude/statusline.mjs`) must match
them, and a test fails if it does not. Change both together.

| Threshold | Tokens | What to do |
|---|---|---|
| Checkpoint | 200,000 | Commit the work so far on the ticket's branch at the next clean point, so a handoff costs nothing if it comes early |
| Handoff | 400,000 | Hand off at the next clean point. Never start a new acceptance criterion past this point: finish the one in hand, or bring it to a clean point, then hand off |

They are counted in tokens, not as a percentage, because the same percentage means
very different amounts on a 200K and a 1M window.

These are starting values, and guesses until the calibration log in
`ESTIMATING.md` has data. Tune them from its sessions and handoffs columns.

The first defence is not reaching them. Send heavy reading, broad searches and test
runs to subagents: their output stays in the subagent, and only the conclusion comes
back to the main session.

---

## The comment format

Every handoff has the same sections in the same order. Write "None" under a
section with nothing in it rather than leaving it out, so the next session knows it
was considered.

```markdown
> Posted by an agent session — YYYY-MM-DD

## Handoff

### Status
- Branch: `<branch>` (pushed / local only)
- Last commit: `<short hash>` <subject>
- Criteria:
  - Done: <criterion, as worded in the issue>
  - In progress: <criterion> (<what is left>)
  - Not started: <criterion>

### Files changed
- `<path>`: <what changed, one line>

### Decisions
- <decision>, because <reason>

### Next steps
1. <the very next action: specific enough to start without reading further>
2. <then this>

### Checks
- Pass: `<exact command>`
- Fail: `<exact command>`: <the failing test or error, one or two lines>
- Not run: `<exact command>`: <why>

### Dead ends
- <approach tried>: <why it failed>

### Open questions
- <question for the developer, and what it blocks>

### Reading list
- `<path>` (<section>): <why>
```

What each section is for:

- **Status.** Every acceptance criterion from the issue, word for word, under
  exactly one of done, in progress or not started. The branch and last commit let
  the next session check it has the same code; whether the branch is pushed tells
  it whether another machine can reach it.
- **Files changed.** Every file the branch changes, one line each, from
  `git diff --stat <integration branch>...HEAD`. No diffs.
- **Decisions.** Choices made that the issue did not settle, each with its reason,
  so the next session does not reopen them. A decision that belongs in
  `DECISIONS.md` goes there too.
- **Next steps.** In order, the very next action first, named precisely: the file,
  the function, the command.
- **Checks.** The commands the issue's Verification section names, plus any you
  ran, each marked pass, fail or not run as of the last commit. Copy the exact
  command.
- **Dead ends.** What was tried and abandoned, and why, so it is not tried again.
- **Open questions.** Only what is still open. Say what each one blocks.
- **Reading list.** The few documents and sections the next session needs beyond
  the issue itself, at most five.

The `## Handoff` heading is how a resuming session finds the comment, so keep it
exactly as written.

---

## The 8,000-character limit

A handoff is at most 8,000 characters, so a session-start hook can load it whole.
Check before posting with `wc -m < <file>`. Where the shell's locale makes it count
bytes instead, the figure is a little high, never low, so a pass is still a pass.

To stay under it:

- Point, do not paste. Name files, sections and commands; never copy code, diffs or
  whole logs into the comment.
- One line per file, decision, dead end and question.
- Cut a failing check's output to the assertion or error that matters.
- Drop questions that were answered and steps that are done.
- Never split a handoff over two comments. If it will not fit, the ticket is
  carrying too much: summarise the oldest dead ends, and raise splitting the
  ticket (`TASK_HIERARCHY.md`) as an open question.

---

## Resuming

The resuming session reads the latest handoff comment, checks out the branch it
names, removes the `handoff` label and starts at the first next step. The commands
are in the skill, under "Resuming a handed-off ticket". The newest handoff is the
one that counts; older ones are history.
