# AI-Assisted Project Template

A structured project template for building applications with AI coding agents.
Built for Claude Code. The instructions live in `AGENTS.md`, which other agents read directly.

---

## What this is

This template provides a working Next.js starter app, and the documentation scaffolding
and agent instruction system that keeps AI coding agents consistent, context-aware, and
auditable across sessions.

It is built around the principle that **AI agents lose context between sessions**.
By maintaining a structured set of living documents, every new session starts with
full awareness of what has been built, what decisions have been made, and what
comes next.

---

## How to start a new project

**1. Create your project's repository from this template**

```bash
gh repo create <org>/<name> --template Libra-Europe/Project-Template-App-Creation --private --clone
cd <name>
```

This gives the project its own private repository with a fresh history: one commit, and none of the
template's issues, milestones or pull requests. Don't `git clone` the template itself. Onboarding
stops if the remote is the template repository.

**2. Open it in Claude Code and trust the folder**

```bash
claude
```

Claude Code asks once whether you trust the folder. Say yes. That loads the project's
default plugins: design direction, current library docs, security warnings and
TypeScript code intelligence. The only one-off install they need is the TypeScript
language server in `PREREQUISITES.md`. Run `/plugin` to see them; its **Errors** tab
should be empty. GreenSock's GSAP skills are already in `.claude/skills/`. What each
one is for: `docs/general_docs/TOOLKIT.md`.

**3. Run onboarding**

The agent handles onboarding automatically. When you start a session on a new project,
the agent will detect that the context documents are empty and begin onboarding.

Choose your route when asked:
- **Route A** — the agent guides you through a structured questionnaire section by section
- **Route B** — provide any document (transcript, PRD, spec, meeting notes) and the agent extracts what it can, then asks follow-up questions for anything missing

The agent will generate all context documents and phase execution logs, help you set up your infrastructure step by step if needed, and ask what you want to work on first before any development begins.

**4. Review the generated documents**

After onboarding, review:
- Your GitHub Issues backlog — one issue per task in the body format defined by `.github/ISSUE_TEMPLATE/task.md`, grouped into phase milestones, with an org-level Project board as the visual layer
- `docs/agent_context/CURRENT_STATE.md` — active phase, active log, blockers
- `docs/agent_context/CORE_FLOWS.md` — your user flows organised by application area
- `docs/agent_context/SCHEMA_REFERENCE.md` — your data model
- `docs/agent_context/PERMISSIONS_REFERENCE.md` — your roles and access rules
- `docs/general_docs/TECH_STACK.md` — your confirmed technology stack

**5. Commit and begin**

```bash
git add .
git commit -m "chore: onboarding — project documents generated"
```

---

## Running the app

The repository is a Next.js app from the first commit. You need Node.js at the version
in `.nvmrc` and pnpm 9.7 or later: `package.json` pins the exact pnpm version, and
pnpm switches to it by itself.

```bash
pnpm install
pnpm dev
```

The app serves on http://localhost:3000. Before you finish a task, run
`pnpm typecheck`, `pnpm lint` and `pnpm build`.

---

## Folder structure

```
├── AGENTS.md                        # Agent instructions, loaded every session
├── CLAUDE.md                        # One line, @AGENTS.md: how Claude Code loads AGENTS.md
├── README.md                        # This file
├── PREREQUISITES.md                 # Tooling to install before onboarding
├── .env.example                     # Environment variable template
├── .mcp.json                        # Playwright MCP server registration
├── .gitignore                       # Dependencies, build output, secrets, test auth state, agent files
├── .gitattributes                   # Line endings — shell scripts stay LF
├── .nvmrc                           # Node.js version for every machine and CI
├── package.json                     # Dependencies and scripts; pins the pnpm version
├── pnpm-workspace.yaml              # pnpm settings: which packages may run install scripts
├── next.config.ts, tsconfig.json, eslint.config.mjs
│
├── app/                             # The Next.js app: root layout, placeholder home page, global styles
│
├── .claude/
│   ├── settings.json                # Hooks, status line, permissions, default plugins (TOOLKIT.md)
│   ├── statusline.mjs               # Status line: branch, issue, phase, context use
│   ├── collab.json                  # Integration and protected branches, branch naming, merge strategy
│   ├── template.json                # Template marker; onboarding swaps it for the version record
│   ├── rules/                       # Path-scoped rules for tests, API routes, the database and UI
│   ├── hooks/                       # branch-guard; security-gate (G2, SECURITY.md §4)
│   │   └── test/                    # Tests for both hooks, the status line, and their wiring in settings.json
│   └── skills/                      # task-dispatcher, test-author, test-runner, journey-export, handoff;
│                                    # gsap-* vendored from GreenSock (TOOLKIT.md)
│
├── .github/
│   ├── dependabot.yml               # Weekly npm and GitHub Actions updates
│   ├── ISSUE_TEMPLATE/
│   │   ├── task.md                  # Body format for ticket and subtask issues
│   │   └── epic.md                  # Body format for epic issues
│   └── workflows/
│       └── template-checks.yml      # The template's own CI; onboarding deletes it
│
├── .template/                       # Template maintenance only; onboarding deletes it
│   ├── MAINTENANCE.md               # How to work on the template itself
│   └── checks/check-scaffolds.mjs   # Fails when a scaffold gains project content
│
├── templates/
│   └── testing/                     # Test scaffolding — copied into your project in Phase A
│       ├── README.md                # What gets copied where
│       ├── vitest.config.ts, playwright.config.ts
│       ├── package-scripts.json     # Test scripts to merge into package.json
│       ├── github-workflow-test.yml # CI workflow for the test suites
│       ├── tests/unit/              # Example unit test
│       └── e2e/                     # support/, specs/, permissions/, a11y/
│
└── docs/
    ├── general_docs/
    │   ├── TECH_STACK.md            # Technology stack and tooling reference
    │   ├── TOOLKIT.md               # Default and opt-in plugins and MCP servers, third-party policy
    │   ├── ACCESSIBILITY.md         # Accessibility standards — read before all UI work
    │   ├── ENGINEERING_STANDARDS.md # Dependencies, performance, UI design system usage
    │   ├── ESTIMATING.md            # Time and effort estimates — build, gates, human time
    │   ├── SECURITY.md              # Security standard — per-task checklists, push/merge/release gates
    │   ├── AMENDMENT_TEMPLATE.md    # Copy-and-fill template for change requests
    │   ├── CLOSE_OUT.md             # The one checklist after a task and before a session ends
    │   ├── HANDOFF.md               # Handoff comment format and when to hand off a ticket
    │   ├── POST_TASK_DOCS_AND_COMMIT.md # Paste-in prompt — update docs and commit after a task
    │   ├── COLLABORATION.md         # Branching, merge-back, database branching
    │   ├── TASK_HIERARCHY.md        # Epics, tickets and subtasks in GitHub Issues
    │   └── TESTING_STANDARDS.md     # How to write tests — naming, selectors, fixtures
    │
    ├── project_docs/
    │   ├── THEME_GUIDELINES.md      # Design system — colours, typography, components
    │   ├── USER_JOURNEYS.md         # Customer-facing journeys, exported to PDF by journey-export
    │   └── CONTENTS.md              # Add further PRDs, specs, brand assets here
    │
    └── agent_context/
        ├── ONBOARDING.md            # Paste into agent to kick off a new project
        ├── SCOPE.md                 # Request intake — scope verdict and request ledger
        ├── CURRENT_STATE.md         # Slim session state — active phase, active log, blockers
        ├── EXECUTION_LOG.md         # Index of the phase execution logs onboarding creates
        ├── EXECUTION_LOG_BUGFIX.md  # Bug fixes across all phases
        ├── DECISIONS.md             # Architectural decisions — appended as needed
        ├── CORE_FLOWS.md            # User flows organised by application area
        ├── SCHEMA_REFERENCE.md      # Database schema reference
        ├── PERMISSIONS_REFERENCE.md # Role and access matrix
        ├── UI_PATTERNS.md           # Repeating UI patterns
        ├── ROUTING.md               # Routing and navigation contract
        ├── SERVER_LOGIC.md          # Server-side domain logic requirements
        ├── DATABASE.md              # Database seeding and migration commands
        └── TEST_REFERENCE.md        # Test coverage expectations per area
```

Onboarding adds one execution log per phase (`EXECUTION_LOG_A.md`, `EXECUTION_LOG_B.md` and so on)
alongside these.

---

## How agent sessions work

Every agent session follows this protocol (defined in `AGENTS.md`):

**When a new request arrives:**
1. Run the intake checklist in `docs/agent_context/SCOPE.md`: where the request came from, whether it is in scope, and what to ask if anything is missing
2. Intake ends in a task issue, a line in the request ledger, or a scope decision for you to make
3. For a task, intake also assigns the contributor branch name and checks for clashes with files other contributors are working on (`docs/general_docs/COLLABORATION.md`)

**Claiming and branching:**
1. Claim the issue by assigning it (`gh issue edit <n> --add-assignee @me`), so other sessions skip it
2. Cut the branch named in the issue from the integration branch set in `.claude/collab.json`. Work never lands directly on a protected branch

**Before starting:**
1. Read `CURRENT_STATE.md` — active phase, active log, blockers
2. Read `DECISIONS.md` in full — architectural rules that must never be violated
3. Read the last 3–5 entries of the current phase execution log only (e.g. `EXECUTION_LOG_B.md`)
4. Read the specific task issue (`gh issue view <n> --comments`) — never the whole backlog
5. Read only the relevant sections of the reference documents for this task's domain
6. Check `docs/project_docs/` for any project-specific document relevant to this task

**During the task:**
1. Plan before coding
2. Implement following `AGENTS.md` and the rules for the folders touched
3. Self-verify against the checklist in `AGENTS.md`
4. Fix any failures before reporting back

**After completing:** the agent works through the close-out checklist in
`docs/general_docs/CLOSE_OUT.md`, then proposes the merge-back: a pull request with
`Closes #n` in the body, so the merge closes the issue.

---

## Making changes

Use the Amendment Template (`docs/general_docs/AMENDMENT_TEMPLATE.md`) for all
change requests. Copy the relevant task block(s), fill in the placeholders,
and paste the result into your agent.

When the agent reports a task complete, paste
`docs/general_docs/POST_TASK_DOCS_AND_COMMIT.md` to have it update the docs,
commit, and propose the merge-back.

---

## Running tasks with the task-dispatcher skill

This template ships with a Claude Code skill at `.claude/skills/task-dispatcher/`
that executes planned work against the template's documentation system.

How it works:

1. Plan mode — ask the agent for the next task (or describe a bug fix). The agent
   reads the relevant context, proposes a plan, and waits for your approval.
2. Execution — once approved, invoke the skill with the issue number or a description.
   The skill decides whether to run a single agent or fan out to parallel workers,
   injects the template's conventions into every worker prompt, and runs workers.
3. Close-out — the skill runs the close-out checklist in
   `docs/general_docs/CLOSE_OUT.md`, commits on the task branch, and proposes a
   pull request with `Closes #n` in the body. It asks before any push
   or pull request.

The skill refuses to run until onboarding has been completed — it requires
populated context documents to work.

See `.claude/skills/task-dispatcher/SKILL.md` for full details and usage examples.

---

## Testing

Every task in this template ships with its tests. A task is not complete until the
tests named in its **Tests** section exist and pass — the agent will not run the
close-out without them.

The stack is chosen during onboarding (Section 4c) and recorded in
`docs/general_docs/TECH_STACK.md`. The defaults are Vitest for unit and integration
tests and Playwright for end-to-end.

The runnable scaffolding — configs, fixtures, auth setup, example specs — lives in
`templates/testing/` and is copied into your project during Phase A setup. None of
it runs until that copy has happened. Once your project's harness is configured:

```bash
pnpm test                                # unit and integration
pnpm test:e2e                            # end-to-end
pnpm test:a11y                           # accessibility — axe-core
pnpm exec playwright install chromium    # once per machine, before the first e2e run
```

Two skills support this:

- `test-author` — writes tests from a task's acceptance criteria
- `test-runner` — runs the suites and separates real regressions from flaky failures

`test-author` drives your running application through the Playwright MCP server
registered in `.mcp.json`, so the selectors it writes are the ones your pages
actually render — without it, it falls back to unverified specs. See
`PREREQUISITES.md` for the one-off browser download that server needs.

What the agent is instructed never to do: edit application code to make a test pass,
skip a test to get a build green, or assert that a permission-gated element is
*disabled* rather than *absent from the DOM*.

See `docs/general_docs/TESTING_STANDARDS.md` for the full conventions.

---

## Other agents

The instructions live in `AGENTS.md`. Claude Code reads `CLAUDE.md`, which holds
the one line `@AGENTS.md` and so loads the same file. Agents that read `AGENTS.md`
directly, such as OpenAI Codex, get it as it is. Edit `AGENTS.md` only.

From Next.js 16.3, `next dev` appends a managed block to the end of `AGENTS.md`
that points agents at the docs bundled with the installed Next.js. Keep it and
commit it.

Other agents get the instructions and the documents, but not the parts that are
Claude Code features: the hooks in `.claude/settings.json` (including the branch
guard and the security gate), the skills in `.claude/skills/`, the default plugins,
the MCP server in `.mcp.json`, and the automatic loading of the rules in
`.claude/rules/`. `AGENTS.md` names each rule file so those agents can read it.

---

*Template version 1.0.0*
