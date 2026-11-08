---
name: handoff
description: Hand off an unfinished ticket so a fresh session can continue it. Brings the work to a clean point (checks pass, or the failing check is the reason and is described), commits it on the ticket's branch, posts a handoff comment on the issue in the fixed format from docs/general_docs/HANDOFF.md, adds the `handoff` label, keeps the issue assigned, and prints a one-line prompt to resume. On a ticket's second handoff it stops to split the remaining work into subtasks. Also covers resuming a handed-off ticket. Use at session close for any unfinished ticket, when the status line shows "hand off", or when the developer asks to hand off, pause, park or move a ticket to another session. Trigger words: "hand off", "handoff", "wrapping up", "stopping for today", "pick this up later", "resume from the handoff". Takes the issue number as its argument, or reads it from the branch name.
argument-hint: "[issue-number]"
---

# Handoff

Leaves an unfinished ticket where a fresh session can continue it from the issue
alone. The comment format and the rules for when to hand off are in
`docs/general_docs/HANDOFF.md`. Read it before writing the comment.

Arguments: `$ARGUMENTS`

---

## 1. Find the ticket

- The issue number is the argument. With no argument, take it from the current
  branch name: the `{task}` token in `branchPattern` (`.claude/collab.json`), as the
  status line does.
- Read the issue: `gh issue view <n> --comments`. You need its Branch section,
  acceptance criteria, Verification section, and any earlier handoff.
- Count the earlier handoffs:

  ```bash
  gh issue view <n> --json comments     --jq '[.comments[] | select(.body | contains("## Handoff"))] | length'
  ```

  One or more means this is at least the second handoff, and step 7 splits the
  ticket.
- No issue (an ad-hoc fix): there is nothing to comment on. Commit the work on its
  branch, tell the developer, and stop.

## 2. Check the branch

- Read the integration and protected branches from `.claude/collab.json`.
- On a protected branch with uncommitted work: stop. Switch to the ticket's branch
  (the issue's Branch section) with `git switch -c <branch>`, which carries the
  changes across, then carry on. Never commit to a protected branch.
- On another ticket's branch: stop and ask the developer.

## 3. Bring the work to a clean point

- Never hand off mid-edit. Finish the change in hand, or revert the part that is
  half done, so every file is in a state you would commit. Remove debug residue.
- Run the checks the issue's Verification section names (and `tsc --noEmit`, the
  linter and `pnpm test` once the harness exists). Note each exact command and
  whether it passed.
- A failing check is allowed only when it is the reason for the handoff. The
  comment then names the check, the command and what fails. Any other failure:
  fix it first.

## 4. Commit

Commit on the ticket's branch without asking, per the commit rule in `AGENTS.md`
(Collaborative working). Check the diff for real data, `.env*` files and secrets
first. Unfinished work is a `wip:` commit:

```
wip(<scope>): <where the work stands>

<why it stops here, in a line or two>

Refs #<n>
```

Do not push. Pushing, so another machine or person can continue, needs the
developer's yes: ask, and say so in the comment if the branch is local only.

## 5. Write the comment

- Write the body to a temporary file outside the working tree, never in the
  project: `f=$(mktemp)`.
- Follow the format in `docs/general_docs/HANDOFF.md` exactly: the disclosure line
  `> Posted by an agent session — YYYY-MM-DD` with today's date (`date +%F`), the
  `## Handoff` heading, then every section in order.
- Check the size: `wc -m < "$f"` must be at most 8000. Over it, tighten as that
  file says; never split the comment.
- Post it: `gh issue comment <n> --body-file "$f"`, then delete the file.

## 6. Label and assignment

- Add the label: `gh issue edit <n> --add-label handoff`.
- If that fails because the label does not exist, create it once, then add it:
  `gh label create handoff --color FBCA04 --description "Unfinished ticket with a handoff comment to resume from"`.
  Create it only when missing.
- Leave the assignee as it is. A handed-off ticket stays claimed.

## 7. Split on the second handoff

Only when step 1 found an earlier handoff. The ticket was too big, so its remaining
work is split before anyone continues it (`docs/general_docs/TASK_HIERARCHY.md`,
Splitting after a second handoff):

- Draft one subtask per slice of the remaining criteria, each sized by the sizing
  rule in that file, and show the drafts to the developer.
- On their yes, create them parented to the ticket, release the claim
  (`gh issue edit <n> --remove-assignee @me`) and remove the `handoff` label.
- The first subtask's branch is cut from the ticket's branch at the handoff
  commit, so the next step's prompt names it instead:
  `Work #<first subtask> from the handoff on #<n>`.

## 8. Print the resume prompt

End with one line the developer can paste into a fresh session:

```
Resume #<n> from its handoff comment
```

If the branch is not pushed, add that a session on another machine needs it pushed
first.

---

## Resuming a handed-off ticket

When a session is asked to resume a ticket, or picks up one carrying the `handoff`
label:

1. Read the latest handoff comment:

   ```bash
   gh issue view <n> --json comments \
     --jq '[.comments[] | select(.body | contains("## Handoff"))] | last | .body'
   ```

2. Check out the branch it names and confirm the last commit matches its Status.
   On another machine, `git fetch` first; if the branch is not on the remote, ask
   the developer to push it from where it was written.
3. Remove the label: `gh issue edit <n> --remove-label handoff`. Leave the
   assignee.
4. Read the issue and the comment's reading list, then start at the first next
   step. Treat its decisions and dead ends as settled unless the developer says
   otherwise.
5. Run the session start-up reading in `AGENTS.md` (Agent session protocol) as for
   any task; the handoff replaces only the guesswork about where the work stands.
