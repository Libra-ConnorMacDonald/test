# project_docs — Contents Guide

This folder contains all project-specific reference material that agents and developers
need when working on this project. It is not part of the agent context system —
files here are read selectively when a task requires them.

---

## What belongs here

- `THEME_GUIDELINES.md` — design system (colours, typography, components, animation). Populated during onboarding.
- `USER_JOURNEYS.md` — customer-facing user journeys and delivery plan. Populated during onboarding, kept in step with `CORE_FLOWS.md`, exported to a branded PDF via the `journey-export` skill.
- `exports/` — generated customer deliverables (branded PDFs). Committed to the repository so each presented version is on record.
- PRD / product requirements documents
- Architecture decision records that are too detailed for `DECISIONS.md`
- Brand guidelines or style guides provided by a client
- Third-party API documentation snapshots
- Any other project-specific reference the agent or developer needs

## How agents use this folder

Agents check this folder at the start of each task (Step 7 of the Agent Session Protocol)
and read any document relevant to the task domain. Nothing here is loaded automatically —
only what the task requires.

## Naming convention

Use `SCREAMING_SNAKE_CASE.md` for all files added to this folder, consistent with the
rest of the documentation system.
