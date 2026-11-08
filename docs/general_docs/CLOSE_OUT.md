# Close-Out

> The one checklist for finishing a task and ending a session. Every other document
> links here rather than listing these steps.
>
> - Run it once the task's tests exist and pass (`AGENTS.md`, Task Execution Protocol,
>   4. Fix). Never with tests outstanding.
> - The `task-dispatcher` skill runs it for you. To run it by hand, paste
>   `POST_TASK_DOCS_AND_COMMIT.md`.
> - Update only what genuinely changed. Never touch a document just to say nothing
>   changed, and say in the report which steps you skipped and why.

---

## After every task

1. **Execution log.** Append an entry to the current phase log named in
   `docs/agent_context/CURRENT_STATE.md`, keyed by the issue number (`#123`), in the
   entry format in `docs/agent_context/EXECUTION_LOG.md`: what was built, files
   changed, decisions made, deviations from the plan, anything deferred, and the
   checks run. A bug fix, as that file defines it, goes in `EXECUTION_LOG_BUGFIX.md`
   instead, in its format. The log is the
   record of the change, not the chat.
2. **Decisions.** Append any new architectural or implementation decision to
   `docs/agent_context/DECISIONS.md`, in that file's format. Never edit an existing
   entry.
3. **Scope.** If the task changed what the product does or does not do, update
   `docs/agent_context/SCOPE.md`: a follow-up ledger line for a delivered deferred
   request, an In Scope row for a new area, a Non-goals entry for a decided non-goal.
   If you are unsure whether scope changed, ask rather than guess.
4. **User journeys.** If a user-facing flow was added or changed, update the affected
   journey in `docs/project_docs/USER_JOURNEYS.md`: customer language, no
   implementation detail, per the rules in its header.
5. **Reference documents the task touched.** Update each one whose subject changed:
   - `docs/agent_context/CORE_FLOWS.md`: a user flow
   - `docs/agent_context/SCHEMA_REFERENCE.md`: a table, column or API shape
   - `docs/agent_context/PERMISSIONS_REFERENCE.md`: a role or access rule
   - `docs/agent_context/UI_PATTERNS.md`: a repeating UI pattern
   - `docs/agent_context/ROUTING.md`: a route or navigation
   - `docs/agent_context/SERVER_LOGIC.md`: server-authoritative logic
   - `docs/agent_context/DATABASE.md`: migration commands, seeding or database operations
   - `docs/agent_context/TEST_REFERENCE.md`: a coverage expectation, test convention
     or test auth detail
   - anything else in `docs/general_docs/` or `docs/project_docs/` the task changed
6. **Estimate calibration.** Add a row for the task to the calibration log in
   `docs/general_docs/ESTIMATING.md`: the sessions and handoffs it took, and the
   estimate and actual if an estimate was given.
7. **`AGENTS.md`.** If a critical pattern was established or changed, propose the
   change under the rule in [Changing AGENTS.md](#changing-agentsmd).
8. **The issue.** Post a close-out comment on the task's issue: what was done, files
   changed, checks passed, and a pointer to the log entry. Start it with
   `> Posted by an agent session — YYYY-MM-DD`. Do not close the issue on the
   `github-pr` route: the merged pull request's `Closes #<n>` does that. Under
   `mergeStrategy: local-merge`, propose `gh issue close <n> --comment "…"` in the
   merge-back sequence instead. An ad-hoc fix has no issue, so skip this. If the work
   changes what another open issue needs, comment on or edit that issue too.
9. **Current state.** Update `docs/agent_context/CURRENT_STATE.md` if the active
   phase or blockers changed. On moving to a new phase, name the new phase and its
   log file.
10. **Commit**, per the commit rule in `AGENTS.md`, Collaborative working. Check the
    diff for real data, `.env*` files and secrets first (`AGENTS.md`, Data safety).
    Doc updates go in the same commit as the change they describe, or in a slice of
    their own if the change is already committed. Message format:

    ```
    <type>(<scope>): <short description>

    <why, in a line or two>

    Refs #<issue>
    ```

    Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. Leave out `Refs` for
    an ad-hoc fix. `Closes #<n>` goes in the pull request body, not the commit.
11. **Report.** List each document updated with a one-line summary (or say none
    needed updating), the commit hash, any `AGENTS.md` change awaiting approval, and
    anything deferred or flagged.

---

## Before the session ends

Run this at the end of every session, and at once when the developer says they are
wrapping up or stopping for the day.

1. The execution log is up to date, with a `wip:` entry for anything unfinished.
2. Finished issues carry their close-out comment, and `CURRENT_STATE.md` is current.
3. Finished work is committed with a conventional message.
4. Every unfinished ticket is handed off with `/handoff` (the `handoff` skill): a
   `wip:` commit on its branch and a handoff comment on its issue, in the format in
   `docs/general_docs/HANDOFF.md`.
5. Before pushing commits that touch code, run security gate G2
   (`docs/general_docs/SECURITY.md` §4): `/security-review` on the unpushed commits.
6. If the work is finished, propose the merge-back sequence from
   `docs/general_docs/COLLABORATION.md`: rebase on the integration branch, re-run the
   suites, push, open the pull request. Ask before running it, per the commit rule.

---

## Changing AGENTS.md

This rule covers the always-on instructions: `AGENTS.md`, which `CLAUDE.md` imports,
and the path-scoped rules in `.claude/rules/`. `CLAUDE.md` itself stays the one import
line and is never edited. The block Next.js manages at the end of `AGENTS.md` is
exempt: `next dev` writes it, and it is committed as it stands.

Propose any change, saying what and why, and wait for the developer's
approval before writing it. Two exceptions write without asking:

- **Onboarding's generation step** writes the Critical Patterns section
  (`docs/agent_context/ONBOARDING.md`, Section 9), after the developer has confirmed
  the summary.
- **A security step** writes the Critical Pattern lines it needs
  (`SECURITY.md` §4, "Who decides") and shows them with the push request.

Every write goes into `AGENTS.md`. The import carries it to Claude Code.
