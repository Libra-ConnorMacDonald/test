---
name: Task
about: A backlog task — one issue per task, created by intake or onboarding
labels: task
---

## Source
[customer request / meeting / internal testing / bug report / onboarding — date raised]

## Parent
[#12 — the epic this ticket belongs to, or the parent ticket for a subtask; mirrored as the native parent relationship. See `docs/general_docs/TASK_HIERARCHY.md`]

## Branch
[`ste/123-booking-form` — from the pattern in `.claude/collab.json`; filled in by intake right after creation, once the issue number exists. Cut at dispatch, not at intake.]

## Depends on
[#122, #124 — mirrored as native blocked-by relationships, or "Nothing"]

## Files to create
<!-- Every file this ticket will touch goes in these two sections, tests included: they are its claim on those files. Prefix hotspot files (`hotspotFiles` in `.claude/collab.json`) with HOTSPOT. A generated migration lists the migrations folder. See `docs/general_docs/COLLABORATION.md`, Parallel work. -->
- `[path/to/file.ts]` — [what it does]

## Files to modify
- `[path/to/file.ts]` — [what changes]
- HOTSPOT `[package.json]` — [what changes, or delete this line]

## Acceptance criteria
- [ ] [Criterion 1 — behaviour, never file paths]
- [ ] [Criterion 2]

## Tests
- `[tests/unit/path.test.ts]` — [which acceptance criterion this proves]
- `[e2e/specs/area/flow-id-short-slug.spec.ts]` — [which flow this covers, or "None — no user-facing change"]

## Verification
- `tsc --noEmit` passes
- `pnpm lint` passes
- `pnpm test` passes — once the project's test harness is configured
- `pnpm test:e2e` passes, once the project's test harness is configured — omit if the task changes no user-facing flow
- [Specific browser or API check]

## Gotchas
- [Known constraint or trap]
