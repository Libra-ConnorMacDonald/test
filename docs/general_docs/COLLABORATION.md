# Collaboration & Branching

> How work gets from a request to the integration branch when more than one person
> — or more than one agent session — is contributing. Read this before the first
> commit on a new project, and whenever the answer to "which branch am I on?" is
> not obvious.
>
> **Rules:**
> - Never commit directly to a protected branch — cut a contributor branch first
> - What an agent may do without asking is the commit rule in `AGENTS.md` (Collaborative working)
> - Branch off the integration branch, never off another contributor's branch
> - The branch name is decided at intake, not at commit time
> - Merge back only through the configured merge route — never a force push to a shared branch
> - `.claude/collab.json` is the single source of truth for branch names — no document, script or prompt hardcodes them
> - Parallel tickets never share a file, a hotspot file or a migration slot, and never exceed `maxParallelTickets` (Parallel work, below)

---

## The model

One long-lived integration branch, plus one short-lived branch per contributor per
task. The integration branch is named in `.claude/collab.json` and changes exactly
once in a project's life — at go-live.

**Before go-live** — nothing is deployed, so `main` has nothing to protect and a
second long-lived branch is pure overhead:

```
main                            integration — every contributor branch merges here
 ├── ste/123-booking-form
 └── alex/207-invoice-pdf
```

**After go-live** — `main` becomes a truthful mirror of production, so integration
moves down a level:

```
main                            production — receives dev at a release, nothing else
 └── dev                        integration — every contributor branch merges here
      ├── ste/348-refund-flow
      └── alex/351-export-csv
```

A hotfix is the one exception: it branches off the release branch and merges to
both.

The contributor branches are identical in both models. That is the point: the
protection that matters — isolated work, review before merge, conflicts surfaced
early — comes from the contributor branch, not from the number of long-lived
branches. Deferring the second branch costs nothing later.

---

## Branch naming

Pattern from `.claude/collab.json` — `{user}/{task}-{slug}` by default.

| Kind | Example | Where `{task}` comes from |
|---|---|---|
| Backlog task | `ste/123-booking-form` | the GitHub issue number |
| Ad-hoc fix | `ste/fix-session-refresh` | the `adhocPrefix` value |
| Hotfix (post-launch only) | `ste/hotfix-invoice-total` | `hotfix`, branched off the release branch |

`{user}` is `git config user.name`, lowercased and hyphenated. `{slug}` is three to
five words from the task title. Intake writes the name into the issue body's
**Branch** section right after creating the issue, once the number exists, so the
branch, the issue and the pull request all carry the same number.

---

## Lifecycle of a piece of work

1. **Intake** — the Request Intake Checklist in `docs/agent_context/SCOPE.md`
   creates the issue, assigns the branch name from its number and runs the
   collision check. Nothing is cut yet.
2. **Cut** — from the current integration branch (`integrationBranch` in
   `.claude/collab.json`), freshly pulled:
   ```bash
   git checkout <integration branch> && git pull --ff-only && git checkout -b ste/123-booking-form
   ```
   The `task-dispatcher` skill does this automatically as its branch pre-flight.
3. **Work** — commit in coherent slices on the contributor branch, without asking.
   Conventional commit messages.
4. **Sync before proposing** — rebase on the latest integration branch and re-run
   the suites, so conflicts and integration breakage surface while the work is
   still fresh:
   ```bash
   git fetch origin && git rebase origin/<integration branch> && pnpm test && pnpm test:e2e
   ```
5. **Propose** — push and open a pull request into the integration branch, with
   `Closes #<n>` in the body so the merge closes the issue and flips the Project
   board to Done. The dispatcher's close-out proposes the exact commands. An agent
   asks before running any of steps 4 to 6, per the commit rule. Under
   `mergeStrategy: local-merge` there is no pull request to close the issue, so the close-out proposes `gh issue close <n> --comment "…"` instead.
   If the commits touch code, run security gate G2 (`docs/general_docs/SECURITY.md` §4) before pushing: `/security-review` on the unpushed commits.
6. **Merge and delete** — squash or merge per the project's preference, then delete
   the branch. A contributor branch that outlives its pull request is a future
   conflict.

---

## Protected branches and the guard

`protectedBranches` in `.claude/collab.json` lists the branches no one edits
directly. `.claude/hooks/branch-guard.mjs`, wired in `.claude/settings.json`, sees
every Edit, Write and NotebookEdit and decides what happens when `HEAD` is one of
them.

**It asks — it does not forbid.** The first file write on a protected branch raises
a prompt naming the branch and offering the command to cut a contributor branch.
Approve it and the rest of that session on that branch proceeds without asking
again; decline it and the work goes on its own branch. A guard that blocked every
edit outright would be disabled within a week, and there are legitimate reasons to
be on the integration branch — a release merge, a one-line correction, a repository
with a single contributor.

The approval is remembered per session and per branch, in a marker file under the
system temp directory. Approving `main` does not approve `dev`, and a new session
asks again. Nothing is written inside the repository, so an approval can never
reach a commit.

`guardMode` sets the behaviour:

| Mode | First write on a protected branch | Rest of the session, same branch |
|---|---|---|
| `ask` (default) | prompts the developer | proceeds silently once approved |
| `block` | refuses, with the branch command in the message | keeps refusing |

The guard deliberately does not gate Bash, so `git checkout -b` works from a
protected branch. It allows writes outside the repository, and writes matching
`allowOnIntegration`. If it cannot read config or run git, it allows the write rather
than stranding the session. If it fails in any other way, it still allows the write
but shows a hook error, so a broken guard never goes unnoticed.

Two escape hatches, both for the developer rather than the agent: `enabled: false`
in `.claude/collab.json` turns it off entirely, and `COLLAB_GUARD=off` does the same
for one session. An agent must never set either to get past a prompt — it reports
what happened and lets the developer decide.

`ask` cannot be answered in a headless session, so the `task-dispatcher` sets
`COLLAB_GUARD_MODE=block` for its workers. Its branch pre-flight has already put
them on a contributor branch, so a block is the right failure mode if anything
slips.

---

## Avoiding collisions rather than resolving them

A merge conflict is a scheduling failure that surfaced late. Two checks move it
earlier:

- **At intake** — compare the new issue's *Files to create / modify* sections
  against the files touched by other live branches and open pull requests
  (`gh pr list --json number,headRefName,files`), and against the Files sections
  of other open issues. Overlap is surfaced to the developer while the work can
  still be sequenced, scoped differently, or assigned to the same person.
- **At dispatch** — the planner already assigns non-overlapping files to parallel
  workers within one task. The intake check is the same rule applied across
  contributors.

---

## Parallel work

Several tickets can be in progress at once, each in its own session, branch and
worktree. These rules decide which ones. They read `maxParallelTickets`,
`hotspotFiles`, `migrationPaths` and `ticketNaming` from `.claude/collab.json`.

**In progress** means open, assigned, and not an epic. Count it before claiming:

```bash
gh issue list --state open --limit 200 --json assignees,labels,issueType \
  --jq '[.[] | select((.assignees|length) > 0)
        | select((.issueType.name // "") != "Epic")
        | select([.labels[]?.name] | index("epic") | not)] | length'
```

A handed-off ticket (`HANDOFF.md`) stays assigned and counts as in progress until a
session resumes it. The `handoff` label marks it; only the developer reassigns it.

### The rules

1. **Every ticket lists every file it will touch.** The Files sections of the issue
   body are the claim on those files. A file not listed is a file another ticket may
   take. A ticket that will generate a file whose name it cannot know yet, such as
   a numbered migration, lists the folder.
2. **Tickets in the same wave never list the same file.** If two candidates share a
   file, one waits for the other.
3. **One in-progress ticket per hotspot file.** Hotspots are the files almost every
   ticket wants to change and almost no merge resolves cleanly: the dependency
   manifest and lockfile, the schema and migrations, `.claude/settings.json`, the
   root layout, `README.md`, `CLAUDE.md` and `AGENTS.md`. The list is
   `hotspotFiles`. Flag each one in the issue's Files sections so the clash is
   visible at intake.
4. **One migration at a time.** Only one ticket that adds a database migration
   (`migrationPaths`) is in progress at once. Drizzle numbers migrations in order,
   so two in flight both take the same number and the second must be regenerated
   after the first merges.
5. **No more than `maxParallelTickets` in progress** (3 by default). The limit
   protects the developer's review time as much as usage: every parallel ticket
   ends in a pull request someone has to read. Raise it only when review capacity
   rises with it.
6. **Shared interfaces go first.** When one ticket needs something another builds,
   split out a small contract ticket that defines the shared interface, so both
   dependants can run side by side once it merges. See `TASK_HIERARCHY.md`.

### Building a wave

A wave is the set of tickets started together.

1. Take the open, unassigned, unblocked tickets in the active milestone (the
   frontier query in `TASK_HIERARCHY.md`, without the `.[0]`).
2. Order them by the number of hotspot files they list, most first, then by issue
   number. Hotspot-heavy tickets go first because they are the ones that hold up
   others.
3. Walk the list and add each ticket unless it shares a file with a ticket already
   in the wave or in progress, would be a second migration, or the wave is full.
4. A ticket left out because of a shared file waits for the ticket that holds it:
   record that with `gh issue edit <n> --add-blocked-by <holder>`, so the frontier
   skips it until the holder merges.

Worked example. Four tickets: A lists `README.md`, `CLAUDE.md` and `AGENTS.md`;
B lists `.claude/settings.json` and `README.md`; C and D touch only their own
files. Ordered by hotspots: A, B, C, D. A joins, B shares `README.md` with A and
waits, C and D join. The wave is A, C and D, which is also the limit of three.

### Running tickets side by side

Give each ticket its own worktree, not its own agent in a shared one. Agent teams
share one working tree, so their edits, installs and dev servers collide; they are
not the default way to run parallel tickets. Keep `.claude/worktrees/` out of git
(Claude Code adds it to `.git/info/exclude`; otherwise add it to `.gitignore`).

### Naming everything after the issue

Everything a ticket creates carries its issue number, so clean-up can tell what
belongs to which ticket and a closed issue says what can go. Patterns are in
`ticketNaming`; `{task}` is the issue number, `{slug}` the branch slug and
`{branch}` the git branch name.

| Thing | Pattern | Example for #123 |
|---|---|---|
| Git branch | `branchPattern` | `ste/123-booking-form` |
| Worktree | `.claude/worktrees/{task}-{slug}` | `.claude/worktrees/123-booking-form` |
| Database branch | `{branch}` | `ste/123-booking-form` |
| Dev-server port | `base + ({task} mod span)` | `4123`, run as `PORT=4123 pnpm dev` |
| Working folder | `.tasks/{task}` | `.tasks/123` |

Two in-flight tickets whose numbers differ by a multiple of `span` would share a
port; give the later one the next free port.

### What clean-up may never touch

Clean-up removes only things that match the naming above and belong to a closed
issue. It never removes anything in `cleanupProtected`, whatever its name: the
production and development database branches and the `main` and `dev` git
branches. Nor does it touch anything belonging to an open issue: a handed-off
ticket is open and assigned, so its branch, worktree and database branch are never
treated as abandoned, however long since the last commit. Deleting a
database branch or a worktree with uncommitted work is a data-altering operation,
so it is proposed to the developer first, as `AGENTS.md` (Data safety) requires.

---

## Database branching

Branching source code without branching the database moves the collision rather
than removing it: one contributor's migration lands in the shared database and
breaks everyone else's checkout. Where the provider supports copy-on-write branches
— Neon does — mirror the git model:

| Layer | Database branch | Lifetime |
|---|---|---|
| Production / canonical | `main` | permanent |
| Integration | `dev` | permanent — reset from parent periodically as data drifts |
| Per pull request | matches the git branch name (`ticketNaming.databaseBranch`) | created on open, deleted on close |

Rules that hold regardless of provider:

- Development sessions never point at the production database. The production
  connection string is not present in a development environment — that, not the
  branching model, is what prevents an accidental migration against real data.
- Migrations run against the integration database first and reach production only
  through a merged pull request.
- Each branch has its own connection string, supplied by CI or a local `.env.local`
  and never committed.

Per-pull-request branches are optional and off by default
(`database.perPullRequestBranches`). They become worth the setup as soon as two
pull requests are open at once, because a shared integration database makes
end-to-end suites fight over the same rows. Neon publishes GitHub Actions that
create the branch on open and delete it on close.

---

## The go-live cut

One-time, when the application first serves real users:

```bash
git checkout main && git pull --ff-only && git branch dev main && git push -u origin dev
```

Then:

1. Set `integrationBranch` to `dev` in `.claude/collab.json`. `releaseBranch` stays
   `main`. `protectedBranches` already lists both.
2. Apply a ruleset to `main` on the remote: require a pull request, block force pushes
   and deletion, and require the CI checks to pass. It needs repository admin rights, so
   the agent proposes the `gh api` command (`ONBOARDING.md`, Section 10b) and the developer
   runs it, or tells the agent to.
3. Rebase every in-flight contributor branch onto `dev`.
4. Create the matching `dev` database branch if one does not already exist, and
   repoint development environments at it.
5. Record the change in `DECISIONS.md`.

No document or script needs editing — everything reads the branch name from config.

---

## Configuration reference

`.claude/collab.json`:

| Key | Meaning |
|---|---|
| `enabled` | Master switch for the guard. `false` disables it entirely |
| `guardMode` | `ask` (default) prompts on the first write to a protected branch; `block` refuses. `COLLAB_GUARD_MODE` overrides it for one session |
| `integrationBranch` | Where contributor branches are cut from and merged back into |
| `releaseBranch` | The branch that mirrors production. Equals `integrationBranch` before go-live |
| `protectedBranches` | Branches the guard blocks direct edits on |
| `branchPattern` | Tokens `{user}`, `{task}`, `{slug}` |
| `adhocPrefix` | Used as `{task}` for work with no backlog issue |
| `mergeStrategy` | `github-pr` (proposes `gh pr create`) or `local-merge` (proposes a `--no-ff` merge) |
| `allowOnIntegration` | Glob paths the guard permits on a protected branch |
| `database.provider` | Informational — drives the wording of database branching guidance |
| `database.integrationBranch` | The database branch development points at |
| `database.perPullRequestBranches` | Whether ephemeral per-pull-request database branches are in use |
| `maxParallelTickets` | Most tickets in progress at once. Default 3 |
| `hotspotFiles` | Glob paths only one in-progress ticket may change at a time |
| `migrationPaths` | Glob paths where migrations live. Only one ticket adding one is in progress at a time |
| `ticketNaming.worktree` | Worktree path per ticket. Tokens `{task}`, `{slug}` |
| `ticketNaming.databaseBranch` | Database branch per ticket. `{branch}` is the git branch name |
| `ticketNaming.devServerPort` | `base` plus the issue number modulo `span` |
| `ticketNaming.workingFolder` | Scratch folder per ticket, under the gitignored `.tasks/` |
| `cleanupProtected.gitBranches` | Git branches clean-up never deletes |
| `cleanupProtected.databaseBranches` | Database branches clean-up never deletes: production and development |
