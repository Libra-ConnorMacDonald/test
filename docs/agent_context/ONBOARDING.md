# Onboarding Instructions

You are starting a new project using the AI-assisted project template.
Your job is to onboard this project by collecting all the information needed to generate the agent context documents.

Step 0 checks the repository and picks a route. Sections 1 to 9 collect the answers and generate the documents, the backlog and the execution logs. Sections 10 to 11 set up the infrastructure and choose the first task. Run them in that order.

---

## STEP 0 — Check the Repository, then Choose a Route

### Check this is not the template

Before doing anything else, read `.claude/template.json` and find the GitHub remote with `gh repo view --json nameWithOwner --jq .nameWithOwner`. If `gh` cannot answer, use the `owner/name` part of `git remote get-url origin`: compare only that, never the whole URL, which can carry credentials.

- **The remote is the `templateRepo` named in the marker:** stop. This is the template itself, or a plain clone of it. Onboarding here would write project data into the template and put the project's labels, milestones and issues in the template's backlog. Tell the developer:

  "This repository is the project template, so I won't onboard here. Create your project's own repository from the template, then open the new folder in Claude Code and start again:

  ```bash
  gh repo create <org>/<name> --template Libra-Europe/Project-Template-App-Creation --private --clone
  cd <name>
  ```

  If you meant to work on the template itself, I'll follow `.template/MAINTENANCE.md` instead."

  Do not continue onboarding.
- **There is no remote:** ask the developer to confirm this is a new project, not a copy of the template, before going on. If they confirm, treat it as a new project in the next case. Section 9 needs a GitHub remote, so suggest creating one with the command above.
- **The marker has `"isTemplate": true` and the remote is some other repository, or the developer has confirmed a new project:** this is a new project made from the template. Remove the files that only maintain the template, then replace the marker with a record of where the project started:

  1. Run `git rm -r -- <path>` for every path in the marker's `templateOnly` list. Skip, and tell the developer about, any entry that is an absolute path or contains `..`
  2. Overwrite `.claude/template.json` with only the template repository and the version this project started from, copied from the marker:

     ```json
     {
       "templateRepo": "Libra-Europe/Project-Template-App-Creation",
       "templateVersion": "<the marker's version>"
     }
     ```

  3. Tell the developer in one line what was removed and which template version was recorded. Both changes go into the onboarding commit

- **The marker has no `isTemplate` field:** the cleanup has already run. Carry on.

### Choose a route

Ask the developer:

"How would you like to complete the onboarding?

**Route A — Questionnaire:** I will guide you through each section in order, asking questions and capturing your answers as we go.

**Route B — Document upload:** You provide a file — a transcript, PRD, spec, meeting notes, or any document describing the project — and I will extract everything I can from it. I will then ask follow-up questions for anything that is missing or unclear.

Which route would you like to take?"

Wait for the developer's answer, then follow the corresponding route below.

---

## ROUTE A — Questionnaire

Follow these rules without exception:
- Work through one section at a time
- Ask only the questions for the current section
- Wait for the developer's answers before moving to the next section
- After each section, confirm what you have captured and ask if anything needs correcting
- Do not skip sections or combine sections
- If an answer is unclear or incomplete, ask a follow-up question before proceeding

Proceed through the sections in order below, lettered sub-sections included.

---

## ROUTE B — Document Upload

Ask the developer to provide their file. Accept any file type — transcript, PRD, specification, meeting notes, or any other document describing the project.

Once the file is received:

1. Read the entire document thoroughly
2. Map its contents against every section in this onboarding, lettered sub-sections included
3. For each section, determine whether the information is:
   - **Fully covered** — all required information is present and unambiguous
   - **Partially covered** — some information is present but gaps or ambiguities exist
   - **Not covered** — no relevant information found

4. Assess the overall coverage:

   - **If most sections have gaps:** work through the sections in order, the same as Route A. For fully covered sections, confirm the extracted information with the developer rather than asking questions from scratch. For partially covered or missing sections, ask the relevant questions.

   - **If all sections are fully covered:** do not go section by section. Instead, present a single consolidated summary of everything extracted and ask: "I have extracted the following from your document. Does this accurately and completely describe your project, or is there anything to correct or add?" Wait for confirmation, then proceed to the Review & Generate section.

5. In both cases, the shared rules below decide what may be written before Section 9.

---

## SHARED RULES — apply to both routes

- **What may be written before Section 9.** Only these, each in the step that names it: the template cleanup in Step 0 (removing the `templateOnly` paths and rewriting `.claude/template.json`), `docs/general_docs/TECH_STACK.md` in Sections 4b and 4c, and `.env.example` in Section 4c. Everything else waits until the developer confirms the summary in Section 9: every document in `docs/agent_context/`, `AGENTS.md`, `docs/general_docs/SECURITY.md` §11, `docs/project_docs/THEME_GUIDELINES.md` and `docs/project_docs/USER_JOURNEYS.md`, and every GitHub label, milestone and issue. Section 10b writes `.claude/collab.json` and its `DECISIONS.md` entries after that
- If an answer is unclear or incomplete, ask a follow-up question before proceeding
- The output of this onboarding is the foundation for every future agent session — take care to capture answers accurately

---

---

## SECTION 1 — Project Overview

Ask the developer the following questions one at a time. Wait for each answer before asking the next.

1. What is the name of this project?
2. In one or two sentences, what does this application do?
3. Who are the primary users of this application?
4. What is the rough scale of the project — number of users, volume of data, number of locations, or whatever is relevant?
5. Are there distinct phases of development planned? If yes, briefly describe each phase.
6. Is there anything explicitly out of scope — things this application will deliberately not do, even though users or stakeholders might ask for them? For each, capture why: deferred to a later phase, or ruled out and for what reason. These become the Non-goals table in `docs/agent_context/SCOPE.md`.

When all six answers are collected, summarise them back to the developer and confirm before moving to Section 2.

---

## SECTION 2 — Technology Stack

Read `docs/general_docs/TECH_STACK.md`. This file is pre-populated with the standard project defaults and does not need to be discussed with the developer at this stage.

Confirm to the developer that you have read it and note the baseline stack. Do not ask any questions about technology choices here — the stack review happens in Section 4b after the core flows are established.

Move directly to Section 3.

---

## SECTION 3 — Roles & Permissions

Ask the following questions one at a time.

1. Does this application have multiple user roles? If no, note that and move to Section 4.
2. List all the roles and give a one-sentence description of each.
3. For each role, what is their default landing page after login?
4. What are the key actions in the system?
5. For each action, which roles can perform it?
6. Are there any routes or sections that specific roles cannot access at all? These must return 403 — not redirect.
7. Are there any actions that require a specific role AND an additional condition — for example, ADMIN only with a non-empty reason string logged?

Summarise and confirm before moving to Section 4.

---

## SECTION 4 — Application Areas & Core Flows

This section works in two levels. Complete Level 1 before starting Level 2.

### Level 1 — Application Areas

Ask the developer:

1. What are the major sections or areas of this application? For each one, what is its purpose and end goal?

Let the developer describe these in their own words. Do not constrain the number of areas. Once you have a complete list, summarise each area back as a one-sentence purpose statement and confirm with the developer before moving to Level 2.

### Level 2 — Flows Within Each Area

Work through each area one at a time. For each area:

1. Ask the developer to describe what users can do in this area. Let them describe it conversationally — do not prompt with a fixed list of questions.
2. Ask follow-up questions where the description is unclear or incomplete. Focus on:
   - What triggers the flow?
   - Who does it — which role?
   - What happens, step by step?
   - Are there any rules or conditions that affect how it works?
   - What does success look like? What does failure look like?
3. There is no limit on the number of flows per area. Capture as many as the developer describes.
4. Do not ask about API routes, database tables, or implementation details — these will be derived by the agent when writing the document.

When all flows for an area are captured, confirm them before moving to the next area.

Once all areas and all flows are captured:
- Ask: "Are there any background or automated flows — scheduled jobs, webhooks, or event-driven processes?"
- Ask: "Are there any flows planned but not in scope for Phase A? These will be documented but marked as deferred."

When writing `CORE_FLOWS.md`, the agent must:
- Organise flows by area, not as a flat numbered list
- Apply the flow template from `CORE_FLOWS.md` to each flow — trigger, roles, steps, business rules, DB tables, API routes, UI states
- Derive structure from the developer's description — do not ask the developer to provide it
- Leave clearly marked placeholders for anything that cannot be determined yet
- Apply all conventions from `AGENTS.md` automatically — do not ask the developer to restate them per flow

Summarise and confirm before moving to Section 4b.

---

## SECTION 4b — Technology Stack Review

Now that the core flows are established, review `docs/general_docs/TECH_STACK.md` against everything captured in Section 4.

Ask yourself: do any of the flows require a technology, service, or library that is not already listed in `TECH_STACK.md`?

Examples to consider:
- A flow that sends emails — is an email service listed?
- A flow that handles file uploads — is a storage provider listed?
- A flow that requires real-time updates — is a websocket or polling solution listed?
- A flow that involves mapping or geospatial data — is a maps library listed?
- A flow that handles payments — is a payment provider listed?

If gaps are identified:
1. Present the gaps to the developer: "Based on the flows you have described, I think you may also need [technology] for [flow]. Would you like to add this to the stack?"
2. Wait for confirmation on each suggestion
3. Update `docs/general_docs/TECH_STACK.md` with any confirmed additions

If no gaps are identified, state that the existing stack covers all flows and move on.

Confirm before moving to Section 4c.

---

## SECTION 4c — Testing Setup

Now that the core flows and the stack are settled, decide how this project will be tested. Every task in this template ships with its tests, so these answers shape every issue generated in Section 9.

Ask the following questions one at a time.

1. Which unit and integration test runner should this project use? The template default is Vitest.
2. Which end-to-end tool should this project use? The template default is Playwright.
3. Which of the flows captured in Section 4 need an end-to-end spec? The answer fills the End-to-end column of the Flow Coverage Map in `docs/agent_context/TEST_REFERENCE.md`.
4. Is there a coverage target, and does it apply to the whole codebase or only to specific directories — for example `lib/`?
5. How should end-to-end tests authenticate? The template default is one fixed test user per role, created by hand in the authentication provider, with a stored browser session captured per role before the suite runs.
6. Which roles need a test user? Every role from Section 3 that appears in a flow named in question 3 needs one.
7. Is there a separate test database, or do tests run against a branch of the development database?
8. Are there any flows that must never be exercised against live third-party services — payments, email, SMS, or anything that costs money or contacts a real person?

Question 5 is the one that most often stalls a project. Roles are held in the authentication provider, not in the database, so a test cannot insert a user with a role — it needs a real test user per role and a way to sign in as each one without a human present.

The test users are fixed. One is created by hand per role and reused by every run, local and continuous integration alike, so nothing has to seed them and no run invents an address that does not exist. Because concurrent runs therefore share those users, every spec must scope its own data with a unique per-test identifier — a generated reference, name, or slug — and must never assume it has a user, a record, or a list to itself. A project that genuinely needs full isolation can seed a user per run through the authentication provider's backend API instead — Clerk's Backend API supports this — but the template does not ship it, and adding it brings user cleanup and provider rate limits with it.

When the answers are collected:
1. Update the Testing subsection under Dev Tooling in `docs/general_docs/TECH_STACK.md`
2. Add the chosen test packages to the Core Stack table in the same file
3. Add every test-only environment variable to `.env.example` and to the Required Variables table in `docs/general_docs/TECH_STACK.md` — `E2E_ADMIN_EMAIL` plus one `E2E_[ROLE]_EMAIL` for every additional role named in question 6, `E2E_USER_PASSWORD`, and `E2E_BASE_URL`, which is left empty unless the suite should run against a deployed URL instead of a local server. Use those exact names — the shipped scaffolding reads them
4. Tell the developer the real values belong in `.env.local`, which is the file the test harness loads. Nothing loads `.env.test`. Never commit real values
5. Record the flows named in question 3 — they become the end-to-end coverage list in `docs/agent_context/TEST_REFERENCE.md`, generated in Section 9

Summarise and confirm before moving to Section 5.

---

## SECTION 5 — Data Model

Ask the following questions one at a time.

1. What are the main entities — tables — in your data model?
2. For each entity, what are the key fields — column name, data type, whether required, any key constraints?
3. What are the relationships between entities?
4. Are there any fields that must never be stored — only derived? For example, percentage complete calculated from two other fields.
5. Are there any fields with immutability rules — for example, once set this field cannot be changed, or this field requires an audit log entry on every change?
6. Are there any monetary or precision-sensitive fields? These must use Big.js — never native JS floats.
7. Is there any reference data that must be seeded for the application to function?

Summarise and confirm before moving to Section 6.

---

## SECTION 6 — Initial Task Breakdown

Ask the following questions one at a time.

1. What is the first phase of work called, and what does it cover?
2. What are the individual tasks within Phase A? For each task, collect:
   - What it is
   - What files will be created or modified
   - What the acceptance criteria are
   - What it depends on
   - What proves it works — which behaviour must have a test, and whether the flow needs end-to-end coverage
3. Are there any known Phase B or later tasks to capture now, even if not yet in scope?
4. Are there any known technical risks or gotchas that should be documented in the issues' Gotchas sections?

Whatever the developer lists, the first phase must also carry the test harness setup. Do not ask for it — add it to the Phase A breakdown yourself, in the same shape as every other task, and tell the developer it has been added:

- What it is: set up the test harness — copy `templates/testing/` into the project, merge `templates/testing/package-scripts.json` into `package.json`, install the test dependencies, and run `pnpm exec playwright install chromium`
- Files created or modified: `package.json`, `playwright.config.ts`, `vitest.config.ts`, `e2e/support/`, `e2e/specs/`, `e2e/permissions/`, `e2e/a11y/`, `tests/unit/`, `tests/integration/`
- Acceptance criteria: `pnpm test` runs and reports zero failures; `pnpm exec playwright test --list` collects the suite without error; the placeholder routes and headings in `e2e/support/auth.setup.ts`, `e2e/a11y/pages.spec.ts` and `e2e/permissions/permission-matrix.spec.ts` have been pointed at this project's real routes, roles and headings; the worked example in `e2e/specs/example/` has been replaced by a real flow spec or deleted
- Depends on: the Phase A task that scaffolds the application and creates `package.json`. This onboarding does not emit that task — ask the developer which of their own Phase A tasks produces `package.json`, and once the issues are created in Section 9, wire the harness issue as blocked by that issue: `gh issue edit <harness number> --add-blocked-by <scaffold number>`
- What proves it works: none — tooling setup, no user-facing change

This is a Phase A setup task, never onboarding work. Nothing in `templates/testing/` is copied during onboarding, because no `package.json` exists yet and this onboarding never creates one.

Summarise and confirm before moving to Section 7.

---

## SECTION 7 — Architectural Decisions & Critical Patterns

This section captures two things: architectural decisions that explain why choices were made, and critical patterns that the agent must never violate during implementation. Ask each question one at a time.

### Part A — Architectural Decisions

1. Have any key technical decisions already been made that future agents must respect?
2. Are there any approaches you have explicitly ruled out?
3. Are there any external constraints that affect architecture — for example, must work offline, must comply with a specific data residency requirement?

### Part B — Critical Patterns

4. Are there any implementation rules that must always be followed without exception — for example, how permissions are enforced, how certain data must be calculated, or how specific UI elements must behave?
5. Are there any fields or values that must never be stored — only derived at runtime?
6. Are there any data fields with immutability or audit requirements — fields that cannot be changed once set, or that require a log entry on every change?
7. Are there any server-side calculations or state transitions that must never be trusted from the client?
8. Are there any layout dimensions, component structures, or UI rules that must not be changed without explicit approval?
9. What data does the app hold — personal, health, financial, location, or none beyond an account? This sets the security level: OWASP ASVS Level 1 for every app, Level 2 for accounts plus any of those. Record it, the public (unauthenticated) routes and how each authenticates itself in `docs/general_docs/SECURITY.md` §11.

For each pattern identified, capture:
- What the rule is
- Why it exists
- What the agent must never do that would violate it

Add each critical pattern to the Critical Patterns section under `## PROJECT SPECIFIC` in `AGENTS.md`, the only file to write: `CLAUDE.md` imports it and stays the one import line. Use a clear numbered heading for each pattern. Be precise — vague patterns are not enforceable. This generation step is one of the two exceptions to the rule that `AGENTS.md` changes wait for the developer's approval (`docs/general_docs/CLOSE_OUT.md`, "Changing AGENTS.md"): the developer's confirmation of the Section 9 summary covers it.

Summarise and confirm before moving to Section 8.

---

## SECTION 8 — Design System

This section populates `docs/project_docs/THEME_GUIDELINES.md`. Ask each question one at a time. If the developer does not yet have answers for a question, note it as TBD and move on — the file can be expanded later.

1. Does this project have existing brand colours? If yes, what are they — names, hex values, and intended usage for each?
2. Are there any surface or background colours — for example a warm off-white, a dark navy, a neutral grey?
3. What fonts will be used? One for body/UI text, one for headings if different. If not yet decided, note TBD.
4. Does the project have a dark mode? If yes, what are the key dark mode colour overrides?
5. Are there any application-specific colour sets — for example status colours, category colours, data visualisation colours, or map/chart colours? For each, describe what it represents and whether it can be overridden by configuration.
6. Are there any fixed layout dimensions that must never change — for example a sidebar width, a header height, a bottom bar? If yes, list them with their pixel value and reason.
7. Are there any animation conventions — duration, easing, library preference?
8. Is there an existing brand spec, style guide, or design file the agent should know about? If yes, where does it live or can it be provided?

When writing `docs/project_docs/THEME_GUIDELINES.md`:
- Populate only the sections where answers were provided — do not invent values
- Leave placeholder text in any section that was marked TBD
- Keep the document short — essential tokens and rules only
- Add a note at the top of any TBD section: "To be defined — update before building UI for this area"
- If the developer provided a brand spec or design file, note its location in the document header

Summarise and confirm before moving to Section 9.

---

## SECTION 9 — Review & Generate

The task backlog lives in GitHub Issues, so it cannot exist without a GitHub remote. Verify this gate before anything else:

- A GitHub remote exists — check with `git remote -v` or `gh repo view`. If the repository has no GitHub remote yet, the developer must create or connect one before generation
- The remote is not the template repository — `gh repo view --json nameWithOwner --jq .nameWithOwner` must not print the `templateRepo` in `.claude/template.json`. If it does, stop: the labels, milestones and issues would land in the template's backlog. Explain how to create the project's own repository, as in Step 0, and onboard there instead
- The `gh` CLI is installed at version 2.94.0 or later — `winget install --id GitHub.cli` on Windows
- `gh` is authenticated — `gh auth status`

Do not generate any issues until this gate passes.

Before generating any documents:

1. Present a complete summary of everything captured across every section of this onboarding
2. Ask: "Does this accurately reflect your project? Are there any corrections or additions before I generate the documents?"
3. Wait for explicit confirmation
4. Only after confirmation, generate the following in this order:

   **Agent context documents:**
   - `docs/agent_context/CORE_FLOWS.md` — all flows from Section 4, organised by application area
   - `docs/agent_context/SCHEMA_REFERENCE.md` — all tables from Section 5
   - `docs/agent_context/PERMISSIONS_REFERENCE.md` — all roles and access rules from Section 3
   - `docs/agent_context/SCOPE.md` — populate, do not rewrite: the Product Statement from Section 1, one In Scope row per area from Section 4 with its flow IDs, tables, and roles, and the Non-goals table from Section 1 question 6 plus any deferred flows from Section 4. Leave the Deferred & Parked Requests ledger empty. The Request Intake Checklist ships with the scaffold — regenerating it destroys the triage protocol, which no other document reproduces
   - `docs/agent_context/DECISIONS.md` — all architectural decisions from Section 7 Part A
   - `docs/agent_context/TEST_REFERENCE.md` — populate, do not rewrite. Fill the Current Coverage block, the Test Auth Strategy table and the Flow Coverage Map from Section 4c, together with the coverage target and the per-area test conventions. This file ships with its rule blocks already written, the same as `TESTING_STANDARDS.md` below — regenerating it destroys the selector registry, the fixture rules and the quarantine protocol, which no other document reproduces
   - Update the Critical Patterns section in `AGENTS.md`: all critical patterns from Section 7 Part B, each as a numbered entry with rule, reason, and what must never be done. Leave `CLAUDE.md` as the one import line

   **Task backlog — GitHub Issues, not a repository document:**
   - One milestone per phase from Section 6: `gh api repos/{owner}/{repo}/milestones -f title="Phase A — Foundation"` — there is no `gh milestone` command
   - The `task`, `bug` and `epic` labels, if they do not already exist
   - Issue generation runs as three passes, because a parent must exist before a child can point at it — the model is `docs/general_docs/TASK_HIERARCHY.md`:
     1. **Epics** — one per In Scope area in `docs/agent_context/SCOPE.md`, plus the standing **Foundation** epic for cross-cutting infrastructure (the test harness, tooling, CI, the build), which gets its own In Scope row. Build each body from `.github/ISSUE_TEMPLATE/epic.md` and create with `gh issue create --title "<area>" --body-file <file> --label epic`. Where the organisation has configured issue types, also pass `--type Epic`. No milestone — epics span phases. Record each epic's number in the Epic column of the In Scope table in `SCOPE.md`. The injected test-harness task and the scaffold task it depends on parent to the Foundation epic
     2. **Tickets** — one issue per Section 6 task, the Phase A test harness setup task included. Size each one first by the sizing rule in `docs/general_docs/TASK_HIERARCHY.md` (Sizing a ticket), and create a task that fails it as a ticket with subtasks parented to it. Build each body from the section structure in `.github/ISSUE_TEMPLATE/task.md` and create with `gh issue create --title "<Task title>" --body-file <file> --label task --milestone "<phase>" --parent <the area's epic number>`. Where the organisation has configured issue types, also pass `--type Task` (or `--type Bug`). Titles are plain task titles — the issue number is the ID. Then fill each issue's Branch section with `{user}/{number}-{slug}` per the pattern in `.claude/collab.json`, via `gh issue edit <n> --body-file <updated>`
     3. **Dependencies** — wire blocked-by relationships in a final pass with `gh issue edit <n> --add-blocked-by <m>` — issues need numbers before they can reference each other
   - In every ticket body: the Tests section populated from the task's acceptance criteria — use `None — no user-facing change` where that is the honest answer, never leave the placeholder in place — and the Source section set to `onboarding — [date]`

   **Project documents:**
   - `docs/project_docs/THEME_GUIDELINES.md` — populated from Section 8 answers, TBD placeholders for anything not yet known
   - `docs/project_docs/USER_JOURNEYS.md` — populate, do not rewrite: the customer-facing translation of the documents above. "The Product at a Glance" from Section 1, "Who Uses It" from Section 3, one journey per Phase A flow from Section 4 (customer language, `Ref:` tag per journey), the Delivery Plan table from Section 6's phases, and "Agreed Exclusions" from the Non-goals table in `SCOPE.md` — capabilities ruled out altogether, not flows merely deferred to a later phase, which belong in the Delivery Plan. Follow the rules in the scaffold's header — no implementation detail, nothing invented

   **Execution logs — one file per phase plus a bug fix log:**
   - For each phase defined in Section 6, create `docs/agent_context/EXECUTION_LOG_[PHASE_LETTER].md`
     using the entry format defined in `docs/agent_context/EXECUTION_LOG.md`
     with a single initial entry: "Phase [X] log created during onboarding — [date]"
   - `docs/agent_context/EXECUTION_LOG_BUGFIX.md` already exists as a scaffold — add a single initial entry: "Bug fix log created during onboarding — [date]"
   - Update `docs/agent_context/EXECUTION_LOG.md` (the index file) with a row for each phase log created

   **Example:** if the project has Phase A, Phase B, and Phase C, create:
   - `EXECUTION_LOG_A.md`
   - `EXECUTION_LOG_B.md`
   - `EXECUTION_LOG_C.md`
   - `EXECUTION_LOG_BUGFIX.md` (already exists)

   **Testing:**
   - Confirm `.gitignore` already covers `test-results/`, `playwright-report/`, `blob-report/`, `e2e/.auth/`, `.env.local` and `.env.test` — add anything missing. Stored browser sessions are live sessions and the test-user credentials live in `.env.local`; neither may ever be committed. Nothing reads `.env.test` — it is ignored defensively only
   - Do not copy `templates/testing/`, do not create the test directories, and do not add test scripts to `package.json` here. All of that is the Phase A test harness setup task emitted in Section 6 — no `package.json` exists at this point
   - Do not write `docs/general_docs/TESTING_STANDARDS.md`. It ships with the template, fully written, alongside `ACCESSIBILITY.md` and `ENGINEERING_STANDARDS.md`. Regenerating it destroys the permission-assertion rule, the selector policy, and the determinism rules, which no other document reproduces in full
   - Do not write any test specs at this stage — no application code exists yet. Specs are written per task, against that task's acceptance criteria

5. Check `docs/general_docs/TECH_STACK.md` carries every stack detail confirmed in Sections 4b and 4c, and fill `docs/general_docs/SECURITY.md` §11 from Section 7 question 9

6. Populate `docs/agent_context/CURRENT_STATE.md`:
   - Active phase: Phase A (or whichever is first)
   - Active execution log: the Phase A log file
   - Blockers: None

7. Report to the developer:
   - Which documents were created
   - Which milestones and issues were created
   - Which execution log files were created and for which phases
   - Any sections where answers were ambiguous and assumptions were made

---

## POST-GENERATION CHECKLIST

After generating all documents:

1. Ask the developer to review all generated documents and confirm they are accurate
2. Confirm `docs/general_docs/TECH_STACK.md` is complete and accurate
3. Offer to run the `journey-export` skill at `.claude/skills/journey-export/` — it turns `docs/project_docs/USER_JOURNEYS.md` into a Libra-branded PDF in `docs/project_docs/exports/`, ready to present back to the customer
4. Remind them to commit the generated documents as the first project commit: `chore: onboarding — project documents generated`. The issues and milestones live on GitHub and are not part of the commit
5. Confirm `docs/general_docs/SECURITY.md` §11 is filled from Section 7 question 9: the ASVS level, the data the app holds, and each public route with how it authenticates itself
6. Confirm `CLAUDE.md` still holds only the `@AGENTS.md` import line, and that the Critical Patterns are in `AGENTS.md`

---

## SECTION 10 — Architecture Setup

Before any development begins, the project infrastructure needs to be in place. Ask the developer:

"Before we start building, we need to make sure your project infrastructure is set up — this includes things like your database, authentication provider, hosting, and any other services in your tech stack.

Have you already set these up, or would you like help doing so?"

Then follow the appropriate path:

### Path 1 — Already set up

If the developer has already set up their infrastructure:

Ask them to fill in `.env.local` from `.env.example` with their real credentials.

Once they confirm this is done, verify by asking: "Are all the required environment variables in `.env.example` accounted for? If any services have been added since the template was created, make sure to add their variables to `.env.example` now."

Then move to Section 10b.

### Path 2 — Needs setting up

If the developer needs help setting up their infrastructure:

Ask: "Are you comfortable setting up the infrastructure yourself, or would you like me to guide you through it step by step?"

**If they want guidance:**

Work through each service in `docs/general_docs/TECH_STACK.md` that requires setup, in this order:
1. Database (e.g. Neon — create project, get connection string, then create the development branch described in Section 10b)
2. Authentication provider (e.g. Clerk — create application, get API keys, configure webhook)
3. The end-to-end test users — one per role, created in the authentication provider (see below)
4. Rate limiting / caching (e.g. Upstash Redis — create database, get REST credentials)
5. Hosting (e.g. Vercel — connect repository, configure environment variables)
6. Any additional services identified during onboarding

For each service:
- Provide clear step-by-step instructions in the correct order
- Tell the developer exactly which value to copy and which environment variable it maps to
- Wait for confirmation that each service is set up before moving to the next
- If the developer gets stuck, offer to clarify or suggest an alternative approach

**Step 3 in detail — the test users.** Create them while the developer is still in the authentication provider's dashboard, immediately after the application exists. They are easy to forget because nothing fails until the first `pnpm test:e2e`, which is long after this step — and when it does fail, it fails in the `setup` project, so every flow, permission and accessibility spec is skipped at once.

Create one user for each role captured in Section 4c question 6. For each:
- Give the address the `+clerk_test` subaddress — for example `e2e-admin+clerk_test@example.com`. The provider suppresses all email delivery to those addresses, so a test run never sends real mail and never needs a human to read an inbox.
- Set the role in `publicMetadata.role`, exactly as `docs/agent_context/PERMISSIONS_REFERENCE.md` defines it. This is the one field the whole permission matrix depends on — roles live in the authentication provider, never in the database, so a test cannot insert or repair one.
- Use the same password for every test user.

Then record them: the address of each user goes in `E2E_[ROLE]_EMAIL` — `E2E_ADMIN_EMAIL` for the admin user, and so on — and the shared password goes in `E2E_USER_PASSWORD`, all in `.env.local`. Those are the exact names the shipped scaffolding reads in `e2e/support/auth.ts`; a different name resolves to nothing and the sign-in fails with an address the provider has never seen.

**If they are comfortable doing it themselves:**

Provide a summary list of everything that needs to be set up with a brief note on what is needed from each service. Ask them to come back once done.

Once all services are confirmed set up, ask the developer to populate `.env.local` from `.env.example` and confirm when complete.

Check the test-user variables specifically before moving on. `.env.example` ships `E2E_ADMIN_EMAIL`, `E2E_MANAGER_EMAIL`, `E2E_MEMBER_EMAIL`, `E2E_USER_PASSWORD` and `E2E_BASE_URL` with empty values, and a key copied across but left empty is indistinguishable from one that was never set until the suite tries to sign in. Confirm that one `E2E_[ROLE]_EMAIL` line exists per role this project actually has — delete the shipped lines for roles it does not — and that each carries the address of a user that exists in the authentication provider with its role set in `publicMetadata.role`. Leave `E2E_BASE_URL` empty unless the suite should run against a deployed URL rather than a locally started server.

---

## SECTION 10b — Collaboration Setup

Set this up before the first task, not before the first merge conflict. Read
`docs/general_docs/COLLABORATION.md` first — it holds the model this step configures.

Ask the developer:

"Who will be contributing to this repository — just you, or a team? And is this
project already serving real users, or still pre-launch?"

**Set the integration branch.** Pre-launch, `main` is the integration branch and
there is no `dev` — a second long-lived branch protects a deployed artifact that
does not exist yet. Post-launch, cut `dev` and make it the integration branch.
Record the answer in `.claude/collab.json`:

- `integrationBranch` — `main` pre-launch, `dev` post-launch
- `releaseBranch` — always `main`
- `mergeStrategy` — `github-pr` is the expected strategy, since a GitHub remote is
  already required for the issue backlog. `local-merge` remains only as a degraded
  option where pull requests are not used; on that route the task close-out must
  propose `gh issue close <n> --comment "…"` explicitly, because no merged pull
  request closes the issue

Confirm the branch guard is active. `.claude/settings.json` wires
`.claude/hooks/branch-guard.mjs`, which sees every file write in every session,
including ones that never invoke a skill. By default it asks before the first write
on a protected branch and then stays quiet for the rest of that session on that
branch — it is a prompt, not a wall. Teams that want it absolute can set
`guardMode: "block"`. Do not disable it to make a task easier.

**Protect the integration branch on the remote.** Without it, the local guard is the
only thing standing between a contributor and a direct push. A ruleset needs repository
admin rights, so propose this command and let the developer run it, or run it when they
tell you to. It requires a pull request, blocks force pushes and deletion, and requires
the CI job to pass. Leave out the `required_status_checks` rule until the project's CI
exists, then add it with the job's name:

```bash
gh api --method POST repos/<owner>/<repo>/rulesets --input - <<'EOF'
{
  "name": "Protect the integration branch",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/<integration branch>"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false, "required_status_checks": [ { "context": "<CI job name>", "integration_id": 15368 } ] } }
  ],
  "bypass_actors": []
}
EOF
```

Check it with `gh api repos/<owner>/<repo>/rules/branches/<integration branch>`, which
should list `deletion`, `non_fast_forward`, `pull_request` and `required_status_checks`.
Raise `required_approving_review_count` when the team is big enough to review each
other's pull requests.

**Create the Project board.** The backlog lives in GitHub Issues; the Project is
its visual layer. Projects v2 has no repo level, so create it at org level and link
the repository — `gh` needs the `project` scope first (`gh auth refresh -s project`):

- `gh project create --owner <org> --title "<project title>"`
- `gh project link <number> --owner <org> --repo <repo>`

The auto-add workflow only catches issues created after it is enabled — it never
backfills, so the onboarding-generated issues must be added in bulk now: loop
`gh project item-add <project-number> --owner <org> --url <issue-url>` over
`gh issue list --state open --json url --limit 200`, or multi-select the issues
in the Project UI and add them there.

Then give the developer a short checklist to finish in the GitHub UI — no API
exists for any of it:

- **Delivery** — Board view, filtered `-type:Epic -label:epic`, grouped by Status
  (Todo / In Progress / Done)
- **Epics** — Table view, filtered `type:Epic` (or `label:epic`), ungrouped — epics
  carry no milestone — with the `Sub-issues progress` field shown
- **By epic** — Table view, no filter, grouped by Parent issue
- **Roadmap** — optional, filtered `type:Epic` (or `label:epic`), if the project
  tracks dates
- Built-in workflows: auto-add items from the repository, issue closed → Done,
  PR merged → Done

Optional: org-level issue types give richer categorisation but need an org admin
to configure — under Organisation settings, Issue types, add `Epic` alongside the
built-in Task / Bug / Feature.

**Create the development database branch.** Where the provider supports branching —
Neon does, as copy-on-write branches that are near-instant and cost only what
diverges — create a `dev` branch from the production branch now, and point every
`.env.local` at it. Confirm with the developer that:

- No development environment holds the production connection string. This, not the
  git model, is what prevents a migration running against real data
- Migrations run against the development branch first and reach production only
  through a merged pull request

Record both as entries in `DECISIONS.md`.

Per-pull-request database branches are worth adding as soon as two pull requests
are routinely open at once, because a shared development database makes end-to-end
suites contend for the same rows. Neon publishes GitHub Actions that create the
branch when a pull request opens and delete it when it closes. Leave
`database.perPullRequestBranches` false until then.

---

## SECTION 11 — What Next

Once infrastructure is confirmed, find the first Phase A task with the frontier query — the full query lives under Working order in `docs/general_docs/TASK_HIERARCHY.md` and in `docs/agent_context/CURRENT_STATE.md`. It returns the lowest-numbered issue in the milestone that is open, unassigned, has no open blockers, is not an epic, and has no open sub-issues. Then ask:

"Everything is set up and ready to go. What would you like to do next?

I would suggest starting with **[#number — title of the frontier issue]** — this is the foundation task that everything else depends on. Would you like to begin there, or is there something else you would like to tackle first?

Once we've agreed on a task, I will propose a plan for it. Once you approve the plan, the task can be executed either manually (we work through it together, step by step) or via the `task-dispatcher` skill at `.claude/skills/task-dispatcher/`, which handles parallel worker dispatch and the Agent Session Protocol close-out automatically. The skill is available now that onboarding is complete."

Wait for the developer's decision and proceed accordingly.
