# Maintaining the Template

> Read this instead of onboarding when the session is in the template repository
> itself. `AGENTS.md`, imported by `CLAUDE.md`, sends you here when `.claude/template.json` has
> `"isTemplate": true` and the GitHub remote is the `templateRepo` it names.
>
> This repository is not an app. Projects are created from it, and everything it
> ships is copied into each of them. Work here improves what those projects start
> with.

---

## How a session runs here

- **Never onboard.** Onboarding fills the scaffolds and creates labels, milestones and issues. In this repository that would ship one project's data to every future project and put a project backlog in the template's issues.
- **The backlog is this repository's GitHub Issues.** Claim, branch, commit and open pull requests as `AGENTS.md` describes. The branch name comes from the issue's **Branch** section.
- **Skip the close-out steps that write to the scaffolds** (`docs/general_docs/CLOSE_OUT.md`). No execution log entries, and no changes to `CURRENT_STATE.md`, `DECISIONS.md` or the other documents in `docs/agent_context/` beyond changing the scaffold itself. The close-out comment on the issue and the pull request are the record of the work.
- **The skills that need onboarding refuse to run here.** `task-dispatcher` is one. Do the work directly.

---

## Keep the scaffolds blank

The documents in `docs/agent_context/` ship as empty scaffolds: placeholders, guidance in italics, entry templates in code blocks. Onboarding fills them in each project.

- Change a scaffold's structure or guidance freely. Never add real entries, rows or values.
- No project data anywhere in a shipped file: no app or client names, no issue or finding ids, no dates, no people. The template's own repository name in `.claude/template.json` is the one expected exception.
- Seed and fixture data is synthetic only, as in any project.

`node .template/checks/check-scaffolds.mjs` fails when a scaffold gains project content. If you restructure a scaffold on purpose, update its entry in that script in the same change.

---

## Keep the instructions in AGENTS.md

`AGENTS.md` holds every always-on instruction. `CLAUDE.md` is the one line `@AGENTS.md`, which Claude Code expands at launch, plus an HTML comment for maintainers that Claude Code strips. Edit `AGENTS.md` only. `node .template/checks/check-claude-import.mjs` fails if `CLAUDE.md` gains any other text.

`AGENTS.md` is loaded into every session of every project, so keep additions short. A convention that matters only in one folder goes in that folder's rule in `.claude/rules/`, which loads when the agent reads or edits a matching file and drops out at compaction until a matching file is touched again. Anything that must survive compaction, or that is serious if missed, keeps at least a line in `AGENTS.md`. Detail goes in `docs/`.

Leave room for Next.js. From Next.js 16.3, `next dev` appends a block marked `nextjs-agent-rules` to the end of `AGENTS.md`. The template is a Next.js app, so the block is committed here as `next dev` wrote it and ships to every project. Never edit inside it, and never write its full HTML marker anywhere else: Next.js would treat the mention as the block and replace the text between.

---

## Run the self-checks

The template CI (`.github/workflows/template-checks.yml`) runs these on every pull request and on every push to `main`. Run them from the repository root before you open a pull request. All of them must pass.

```bash
node --test '.claude/hooks/test/*.test.mjs'
node .template/checks/check-claude-import.mjs
node -e 'for (const file of process.argv.slice(1)) {
  try { JSON.parse(require("node:fs").readFileSync(file, "utf8")); }
  catch (error) { console.error(`${file}: ${error.message}`); process.exitCode = 1; }
}' .claude/settings.json .claude/collab.json .claude/template.json .mcp.json
node .template/checks/check-scaffolds.mjs
node .template/checks/check-doc-refs.mjs
```

The workflow's second job checks the starter app:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
```

If you add a check, add it to the workflow and to this list together.

`check-doc-refs.mjs` fails when a Markdown file names a path, a heading, a numbered section (`SECURITY.md` §4) or a step (Section 7 of `ONBOARDING.md`) that does not exist. Paths that only exist in a project made from the template, such as `app/` or a phase log, are listed in `PROJECT_ONLY` at the top of the script. Add to that list only when the path really is created later, and say why in a comment.

---

## Porting improvements back from apps

Apps built on the template are where most improvements are found. When you bring one back:

- Treat the source app as read-only. Copy from it; never edit it from a template session.
- Strip every name, id and date: app and client names, issue, ticket and finding numbers, people, dates, URLs and anything else that only makes sense in that app.
- Port the general rule, not the app's instance of it. Where the app filled a scaffold, bring back the improved structure or guidance with the project rows left blank.
- Check the result against the scaffold check and a read-through before committing.

---

## Template-only files

Some files exist only to maintain the template. Onboarding deletes them in each new project, using the `templateOnly` list in `.claude/template.json`.

- Put any new template-only file under `.template/`, which is listed as a whole.
- If it has to live somewhere else, as the CI workflow does, add its path to `templateOnly` in the same change.
- Anything not covered by either ships to every project.

Change `version` in `.claude/template.json` only when a template release is cut, and keep the version in the footer of `README.md` in step with it. Onboarding records the version each project started from.
