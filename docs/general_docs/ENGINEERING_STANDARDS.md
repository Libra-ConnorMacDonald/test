# Engineering Standards

> Read the relevant section of this document when the task involves the topic covered.
> These standards apply to all agents on all tasks where the topic is relevant.
> The always-on rules are in `AGENTS.md`; this file holds the working practice behind them.

---

## External Dependencies

When adding a new library or API dependency:

- Specify the version requirement explicitly
- Check licence compatibility — avoid restrictive or copyleft licences
- Confirm compatibility with existing dependencies before installing
- Prefer well-maintained packages with active communities
- Document the reason for adding it in `DECISIONS.md`

---

## Scalability & Performance

- Optimise for performance and scalability from the start — retrofitting is costly
- Use efficient algorithms and data structures
- Minimise unnecessary computations and memory usage
- Consider caching strategies where applicable — but only where there is a clear benefit
- Profile and benchmark critical code paths before and after significant changes
- Avoid over-engineering — premature optimisation is a source of complexity

---

## Making Edits

- Make one conceptual change at a time
- When proposing a change, show a clear before and after snippet, with a short note on what changed and why
- Keep to the project's existing coding style and conventions
- Write clear, maintainable code, and comment complex logic only, briefly
- Handle errors properly and log them, without logging sensitive user information
- Check for reuse before adding a feature, so nothing is built twice

---

## Refactoring

- Break the work into logical chunks that each work on their own
- Keep every intermediate state working
- Name the refactoring pattern being applied

---

## Dependency Awareness

- Name every dependent file before making a change
- Keep related files consistent with each other
- Check that a change in one file does not break another

---

## Elegance & Simplicity

- Before implementing, ask whether there is a more elegant solution
- If a fix feels hacky, stop and find the clean approach
- Make every change as small as it can be: least impact, fewest lines
- Touch only what the task requires. Do not refactor adjacent code unless asked
- The bar: the change passes a thorough code review without explanation

**File size discipline.** Look for extraction opportunities as the codebase grows (hooks, utilities, child components) where a single responsibility is clear and extracting it helps navigation. Do not extract tightly coupled logic, and do not refactor existing large files unless that is the task. When a file approaches 2,000 lines, flag it, suggest what to extract, and wait for a decision before adding to it.

---

## UI Skill & Design System Usage

When working on any UI task:

- Consult any installed UI skill or design guideline document **before** writing code
- Use it for: accessibility, touch targets, z-index, focus states, keyboard navigation, form validation patterns, animation best practices, component composition, responsive layout
- **Never** accept colour, font, or spacing suggestions from a generic skill — these must come from the project design system only
- The project design system lives in `docs/project_docs/` — see `THEME_GUIDELINES.md` (or equivalent) for the authoritative source
- Colours come only from the CSS custom properties in `app/globals.css`, never a hex value in code: the colour rule in `docs/project_docs/THEME_GUIDELINES.md` §2

---

## Documentation Hierarchy

After significant changes, review whether project documentation needs updating.

| File | Purpose | Detail Level |
|---|---|---|
| `AGENTS.md` | Agent instructions, critical patterns, guardrails. `CLAUDE.md` is a one-line import of it, so edit `AGENTS.md` only | **High-level:** what exists, key rules, where to look |
| `.claude/rules/` | Path-scoped rules for tests, API routes, the database and UI, loaded when the agent works in those folders | **Mid-level:** folder conventions, kept out of the always-on file |
| `docs/general_docs/TECH_STACK.md` | Technology stack and tooling reference | **Mid-level:** stack choices, versions, configuration notes |
| `docs/general_docs/GLOSSARY.md` | One-line definitions of the template's terms, each pointing to the document that owns it | **Reference:** look up a term before guessing at it |
| `docs/general_docs/ACCESSIBILITY.md` | Accessibility standards | **Reference:** read before any UI work |
| `docs/general_docs/ENGINEERING_STANDARDS.md` | This file: dependencies, performance, editing and refactoring practice, UI standards, the file structure | **Reference:** read when the topic is relevant |
| `docs/general_docs/SECURITY.md` | Security standard, per-task checklists, push/merge/release gates | **Reference:** read the section the task touches; §4 before every push |
| `docs/general_docs/ESTIMATING.md` | Time and effort estimates: build / gates / human time, measured gate costs, the calibration log | **Reference:** read before stating any time or effort figure |
| `docs/general_docs/TESTING_STANDARDS.md` | How to write tests — naming, selectors, fixtures, mocking rules | **Reference:** read before writing any test |
| `docs/general_docs/TASK_HIERARCHY.md` | Epic/ticket/subtask model: what each level is, what belongs in each body, the frontier rule, and the Project views | **Reference:** read before creating any issue or picking up work |
| `docs/general_docs/COLLABORATION.md` | Branching, merge-back, parallel work, database branching and the go-live cut | **Reference:** read whenever the branch to work on is not obvious |
| `docs/general_docs/AMENDMENT_TEMPLATE.md` | Prompt template for all change types | **Reference:** copy-and-fill for every change request |
| `docs/general_docs/CLOSE_OUT.md` | The one close-out checklist: docs to update, issue comment, commit, session close, and the rule for changing `AGENTS.md` | **Procedural:** run after every task and before every session ends |
| `docs/general_docs/HANDOFF.md` | The handoff comment format, its 8,000-character limit, and when to hand off an unfinished ticket | **Procedural:** read before handing off or resuming a ticket; `/handoff` follows it |
| `docs/general_docs/POST_TASK_DOCS_AND_COMMIT.md` | Paste-in prompt that runs `CLOSE_OUT.md` by hand | **Procedural:** paste once a task is reported complete |
| `docs/project_docs/THEME_GUIDELINES.md` | Design system — colours, typography, components, animation | **Reference:** read before any UI work |
| `docs/project_docs/USER_JOURNEYS.md` | Customer-facing user journeys and delivery plan, in step with `CORE_FLOWS.md` | **User-facing:** update when a user-facing flow changes; exported by `journey-export` |
| `docs/project_docs/CONTENTS.md` | What belongs in `docs/project_docs/` and how it is named | **Reference:** read before adding a project document |
| `docs/project_docs/` | PRDs, brand guidelines, additional specs | **Detailed:** project-specific reference material |
| `docs/agent_context/ONBOARDING.md` | New-project interview — populates every context document | **Procedural:** run once, before any development work |
| `docs/agent_context/SCOPE.md` | Request intake checklist, In Scope and Non-goals tables, the request ledger | **Procedural:** run first for every new request |
| `docs/agent_context/DECISIONS.md` | ADRs — why key decisions were made | **Concise by design:** never grows large — read in full every session |
| `docs/agent_context/EXECUTION_LOG.md` | Index of all phase execution logs | **Reference:** lists all log files and writing rules |
| `docs/agent_context/EXECUTION_LOG_[X].md` | Per-phase immutable audit trail | **Detailed:** every task completed, files changed, decisions made |
| `docs/agent_context/EXECUTION_LOG_BUGFIX.md` | Bug fix audit trail (all phases) | **Detailed:** every bug fix across the entire project |
| GitHub Issues | Backlog of record — one issue per task, phases as milestones | **Actionable:** acceptance criteria, dependencies, status |
| `docs/agent_context/CURRENT_STATE.md` | Slim session state — active phase, active log, blockers | **Concise by design:** 3–5 lines, read first every session |
| `docs/agent_context/CORE_FLOWS.md` | User flows per application area | **Reference:** read the flows the task implements or touches |
| `docs/agent_context/SCHEMA_REFERENCE.md` | Database tables, fields, and derived value rules | **Reference:** read the tables the task reads or writes |
| `docs/agent_context/PERMISSIONS_REFERENCE.md` | Roles and the permission matrix | **Reference:** read the roles relevant to the task |
| `docs/agent_context/UI_PATTERNS.md` | Reusable UI patterns and their rules | **Reference:** read before building or changing any UI |
| `docs/agent_context/ROUTING.md` | Routing and navigation contract | **Reference:** read when building or touching routes |
| `docs/agent_context/SERVER_LOGIC.md` | Server-side domain logic requirements | **Reference:** read when building server-side logic |
| `docs/agent_context/DATABASE.md` | Database seeding and migration commands | **Reference:** read when running migrations or seeding |
| `docs/agent_context/TEST_REFERENCE.md` | Per-area test coverage expectations and the test auth strategy | **Reference:** read when a task's Tests section names an area |
| `.claude/skills/task-dispatcher/SKILL.md` | Task execution skill — plans, dispatches, runs close-out | **Reference:** invoked after plan approval to execute a task |
| `.claude/skills/test-author/SKILL.md` | Test-writing skill: writes end-to-end specs for a flow, an area or the permission matrix | **Reference:** invoked after implementation, before Self-Verify |
| `.claude/skills/test-runner/SKILL.md` | Test-execution skill — runs suites and triages failures | **Reference:** invoked to verify a task's tests pass |
| `.claude/skills/handoff/SKILL.md` | Hands off an unfinished ticket: clean point, commit, handoff comment and label, resume prompt; and resuming one | **Reference:** invoked as `/handoff` at session close for any unfinished ticket |
| `.claude/skills/journey-export/SKILL.md` | Renders `USER_JOURNEYS.md` as the branded customer PDF | **Reference:** invoked after onboarding and whenever a fresh export is needed |
| `templates/testing/` | Test harness scaffolding: configs, fixtures, auth setup, example specs | **Reference:** copied into the project by the Phase A setup task |
| `.mcp.json` | Playwright MCP server registration — the browser `test-author` drives | **Reference:** read when the MCP server needs configuring or fails to load |
| `docs/general_docs/TOOLKIT.md` | Default and opt-in plugins and MCP servers, with sources, and the third-party policy | **Reference:** read before enabling, adding or removing a plugin or MCP server |
| `PREREQUISITES.md` | Tooling that must be installed before onboarding | **User-facing:** one-off machine setup |
| `README.md` | Developer onboarding and project overview | **User-facing:** setup, usage, contribution guidelines |

Keep `AGENTS.md` concise: it is loaded into every session through the `CLAUDE.md` import. Put a convention that only matters in one folder in that folder's rule in `.claude/rules/`, and implementation detail in `docs/`.

---

## File Structure

This is the layout of the project being built. The template repository itself also carries `templates/testing/`, the runnable test scaffolding (configs, fixtures, auth setup, worked example specs) that the Phase A setup task copies into the project. Nothing under `tests/` or `e2e/` runs until that copy has happened. The layering rules that govern these folders are in `AGENTS.md`, Project specific.

```
├── .github/
│   └── ISSUE_TEMPLATE/        # Task issue body template — the backlog lives in GitHub Issues
│
├── app/
│   ├── api/                   # API routes — validated, server-side only
│   ├── (auth)/                # Authentication pages
│   ├── (dashboard)/           # Protected application routes
│   └── globals.css            # CSS variables + Tailwind base
│
├── components/
│   ├── ui/                    # Component library (owned — edit directly)
│   ├── shared/                # Shared layout components
│   └── [feature]/             # Feature-specific components
│
├── lib/
│   ├── auth/                  # Auth helpers and middleware
│   ├── hooks/                 # Custom React hooks
│   ├── stores/                # Client state (Zustand)
│   ├── utils/                 # Pure utility functions
│   └── constants/             # Fixed values; colours derive from globals.css
│
├── db/
│   ├── schema.ts              # Single schema export
│   ├── migrations/            # Generated migration files
│   └── seeds/                 # Seed scripts
│
├── tests/
│   ├── unit/                  # Vitest unit tests
│   └── integration/           # Vitest integration tests — DB and server logic
│
├── e2e/
│   ├── specs/                 # Playwright flow specs — one directory per area
│   ├── permissions/           # Permission matrix specs
│   ├── a11y/                  # Accessibility specs — axe-core
│   ├── support/               # Fixtures, auth setup, helpers
│   └── .auth/                 # Storage state per role — gitignored, never committed
│
└── docs/
    ├── general_docs/          # Tech stack, standards (incl. SECURITY.md, ESTIMATING.md, CLOSE_OUT.md), amendment template
    ├── project_docs/          # THEME_GUIDELINES, PRDs, brand assets — see CONTENTS.md
    └── agent_context/         # Agent session documents
```
