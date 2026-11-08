# Amendment Prompt Template

> **How to use this template**
> Copy this file, delete the sections that do not apply to your amendment,
> fill in the placeholders marked with `[SQUARE BRACKETS]`, and paste the
> result directly into your AI agent.
>
> Every prompt must include the **Standard Rules** section at the bottom —
> do not remove it.

---

## Preamble (always include)

```
I need you to make the following changes to [PROJECT NAME].
Read all relevant files before making any changes. Do not
modify anything outside the scope of the tasks described below.
```

---

## Request Intake (always include)

Every amendment is a new request. This block carries the provenance the agent
needs to run the Request Intake Checklist in `docs/agent_context/SCOPE.md`
before starting any task below.

```
## Request intake

- Source: [customer request / meeting / internal testing / bug report]
- Date raised: [date]
- Prior triage: [the matching Deferred & Parked Requests line in
  docs/agent_context/SCOPE.md, or "New — not previously triaged"]

Before starting Task 1, run the Request Intake Checklist in
docs/agent_context/SCOPE.md. If any task falls outside the In Scope
areas or matches a Non-goal, stop and tell me before implementing it.
```

---

## Task Block — UI / Visual Change

Use this block when changing how something looks: colours, layout,
spacing, typography, icons, animations.

```
## Task [N] — [Short descriptive title]

### What needs to change

[Describe the current state and what it should look like instead.
Include a screenshot reference if one was provided.]

### Affected component(s)

[Name the component file(s) if known. If unknown, describe where it
appears in the UI and the agent will locate it.]

### Design specification

[List exact values where possible:]
- Colours: CSS variable names (`--color-primary`), never hex values
- Sizes: use Tailwind class names (text-xs, h-7, w-56) or px values
- Spacing: use Tailwind spacing scale (gap-2, px-3, py-1.5)
- Typography: font-size, font-weight, colour
- Borders/shadows: exact values or Tailwind classes
- Animation: duration, easing, direction

### Do not change

[List anything nearby that must remain untouched, e.g. "Do not change
the counter logic or filter behaviour — visual only."]
```

---

## Task Block — Copy / Text Change

Use this block when changing label text, headings, placeholders,
button labels, or any other string displayed in the UI. No logic
changes.

```
## Task [N] — Text label changes (copy only)

These are copy changes only. Do not change any logic, routing,
permissions, or component structure. Check whether labels are
defined in a constants or navigation config file or hardcoded in
component JSX, and update in the correct location.

Changes:
- "[Old text]" → "[New text]"  ([where it appears])
- "[Old text]" → "[New text]"  ([where it appears])
- "[Old text]" stays exactly as it is — do not change it.
```

---

## Task Block — New Feature / Component

Use this block when adding a new piece of functionality that does
not yet exist.

```
## Task [N] — [Feature name]

### What it does

[Describe the feature from the user's perspective. What problem does
it solve? What does the user see and interact with?]

### Where it lives

[Which page/view/component does this appear in? Is it a new component
or an addition to an existing one?]

### UI design

[Describe the visual design:]
- Layout: [flex row / grid / stacked etc.]
- Colours: [CSS variable names, or the Tailwind classes mapped to them]
- Sizing: [width, height, padding]
- States: [default, hover, active, disabled, loading]
- Responsive behaviour: [if relevant]

### Behaviour

[Describe interactions step by step:]
- When the user does X, Y happens
- When condition Z is true, show/hide/disable N
- Edge cases: [empty state, error state, loading state]

### State management

[Where does the state live?]
- Global store: [store name, new fields, new actions]
- Server state: [new query key, endpoint, polling interval if any]
- Local component state: [useState, useReducer]

### API

[List any new or modified API calls:]
- GET [endpoint] — [what it returns]
- POST/PATCH/PUT [endpoint] — [request body, what it returns]
- Validation: [schema for request body]

### Data requirements

[What data does this feature need that may not already be in the
API response? List any additions needed to existing endpoints.]

### Permissions

[Which roles can see this feature? Which roles can interact with it?
Reference PERMISSIONS_REFERENCE.md for the full matrix.]

### Tests

[Every behaviour and permission rule described above needs at least one
test that would fail if it were broken. Name the files:]
- Unit / integration: tests/unit/[path] or tests/integration/[path] —
  [which behaviour it proves]
- End-to-end: e2e/specs/[area]/[flow-id]-[short-slug].spec.ts — [which flow
  it covers]. The flow ID comes first, then an optional short descriptive
  slug. The filename never carries a role
- Declare the spec's session at file level with
  test.use({ storageState: storageStateFor('ROLE') }) from
  e2e/support/auth.ts. A spec that declares nothing runs signed out
- Permission matrix changes are regenerated wholesale into the single
  file e2e/permissions/permission-matrix.spec.ts — never hand-edit it
- Query elements by accessible role and name, not by test id
- Assert permission-gated elements are ABSENT from the DOM in two parts:
  first assert something the page renders for this role is visible, then
  assert the gated element with toHaveCount(0). Absence on its own also
  passes on a page that errored or redirected to sign-in, so it proves
  nothing. Use expectAbsent from e2e/support/permissions.ts, which takes
  the render proof as a required argument. Never assert the element is
  disabled or hidden — both pass against a correct implementation and a
  broken one
- Scope every test's data with a unique per-test identifier derived from
  testInfo.testId — the role test users are fixed and shared across
  concurrent CI jobs, so nothing may assume a private user
```

---

## Task Block — Bug Fix

Use this block when correcting something that is broken or behaving
incorrectly.

```
## Task [N] — Fix: [short description of the bug]

### Current behaviour

[Describe exactly what is happening now, including any error messages,
console errors, or screenshots provided.]

### Expected behaviour

[Describe what should happen instead.]

### Likely cause

[If known, describe the suspected root cause. If unknown, leave blank
and the agent will investigate.]

### Tests

- Add a regression test that fails against the current behaviour and
  passes after the fix — name the file and say which behaviour it pins
- If the bug was user-facing, extend or add the end-to-end spec for the
  affected flow

### Constraints

- Do not change [X] — only fix the specific issue described above.
- If the fix requires touching [Y], confirm before proceeding.
```

---

## Task Block — Schema / Database Change

Use this block when adding, renaming, or removing database columns,
tables, or relationships.

```
## Task [N] — Database change: [short description]

### Migration required

[Describe what needs to change in the schema:]
- Add column: [table].[column_name] [type] [nullable/not null]
  [default value]
- Rename column: [table].[old_name] → [new_name]
- Add table: [table_name] with columns [list]
- Add index: [table].[column] for [reason]

### Data migration

[If existing rows need updating, describe the transformation:]
- [table].[new_column] = [expression using existing data]
- Preserve existing data — do not truncate or drop

### Deprecated columns

[If columns are being superseded but not yet dropped:]
- Mark [table].[column] as deprecated in schema with a comment
- Do not drop it in this migration — schedule for future cleanup

### Steps to execute

After updating the schema file:
1. Run the migration generate command. It only writes a migration
   file, so it needs no go-ahead
2. Before applying the migration, or pushing the schema to any
   database (the shared development branch included), state the
   exact command and the database it targets, then stop and wait
   for my yes. One yes covers one command. Seeding works the same
   way
3. If either step fails, fix it before going any further

### API / component updates

[List every API route and component that reads or writes the
changed columns — they must all be updated in the same task.]
```

---

## Task Block — Refactor (no behaviour change)

Use this block when restructuring code without changing what the
user sees or how the system behaves.

```
## Task [N] — Refactor: [short description]

This is a refactor only. The user-facing behaviour must be identical
before and after. Do not change any logic, UI, or API contracts.

### What to refactor

[Describe what needs restructuring and why:]
- Extract [X] into a shared component/hook/utility
- Move [X] from [location A] to [location B]
- Replace [pattern A] with [pattern B] consistently

### Acceptance criteria

- Type checking passes with no new errors
- Linting passes with no new warnings
- The existing test suite passes unchanged — a refactor that requires a
  test to change is not behaviour-preserving
- All existing functionality works identically after the refactor
```

---

## Standard Rules (always include at the end of every prompt)

```
---

## Completion checklist

After all tasks:

1. Run type checking (tsc --noEmit or equivalent) — fix any errors before reporting back
2. Run the project linter — fix any errors before reporting back
3. Run the test suite (pnpm test, once the project's test harness is
   configured) — fix any failures before reporting back. A change that
   ships no test is not finished
4. Run the end-to-end suite (pnpm test:e2e, once the project's test
   harness is configured) if any user-facing flow changed — fix any
   failures before reporting back
5. Never edit application code solely to make a test pass, and never
   use .only, .skip, or a raised timeout to get a suite green
6. Never apply a migration, push the schema or run a seed script
   without asking. State the exact command and wait for my yes,
   one yes per command
7. Report exactly which files were changed and what was changed in
   each, grouped by task number
8. Note any assumptions made or ambiguities encountered
9. Once every check above passes, run the close-out checklist in
   docs/general_docs/CLOSE_OUT.md: the docs the changes affected, the
   issue comment, the commit, and the merge-back sequence, proposed and
   not run
10. Stop and wait for testing. Do not proceed to any other tasks
```

---

## Quick reference — role permissions

> Replace this table with your project's actual role matrix.
> See `docs/agent_context/PERMISSIONS_REFERENCE.md` for the full reference.

| Role | [Action 1] | [Action 2] | [Action 3] | [Config access] |
|---|---|---|---|---|
| [ROLE_1] | ✓ | — | — | — |
| [ROLE_2] | ✓ | ✓ | — | — |
| [ROLE_3] | — | — | — | — |
| ADMIN | ✓ | ✓ | ✓ | ✓ |

---

## Quick reference — colour tokens

> Replace with your project's tokens. Colours come only from the CSS custom properties in `app/globals.css`, never a hex value in code: the colour rule in `docs/project_docs/THEME_GUIDELINES.md` §2.

| CSS variable | Usage |
|---|---|
| `--color-primary` | [Usage] |
| `--color-accent` | [Usage] |
| `--color-surface` | [Usage] |
| `--color-error` | [Usage — e.g. destructive states] |

---

## Quick reference — status / state colour precedence

> If your project has UI elements (map polygons, status badges, cards) whose colour
> is determined by a precedence rule, document it here so agents always respect it.
> Replace this example with your actual precedence order.

When determining the colour of a [UI element], always evaluate in this order
(highest priority first):

1. [Highest-priority state] → `[CONSTANT_NAME]` — never overridden
2. [Second state] → `[CONSTANT_NAME]`
3. [Third state] → `[CONSTANT_NAME]`
4. Default / unstarted → `[CONSTANT_NAME]`

---

*Template version 1.0 — Project-Agnostic Build System*
*Update this file whenever a new task block type or quick-reference pattern is established.*
