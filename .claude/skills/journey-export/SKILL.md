---
name: journey-export
description: Produce the customer-facing User Journeys & Delivery Plan as a Libra-branded PDF. Reads docs/project_docs/USER_JOURNEYS.md (regenerating it from CORE_FLOWS.md, SCOPE.md, PERMISSIONS_REFERENCE.md, and the repository's milestones if missing or stale), builds a styled standalone HTML document from the shipped template, renders it to PDF with scripts/render-pdf.mjs (Playwright chromium if the project has it, otherwise system Edge/Chrome headless), and saves the result into docs/project_docs/exports/ so it lives in the repository. Trigger words: "export the user journeys", "customer journey PDF", "journey export", "presentation document for the customer", "generate the delivery plan PDF", "export journeys". Requires onboarding to be complete — refuses on scaffold-only context documents.
---

# Journey Export

Turns `docs/project_docs/USER_JOURNEYS.md` into a Libra-branded, customer-presentable
PDF and saves it into the repository at `docs/project_docs/exports/`.

---

## When to invoke this skill

- After onboarding, to produce the first document to present back to the customer
- Whenever the developer needs a fresh version — typically after a phase completes
  or a set of flows changes
- Never as part of implementing a task: the close-out step that keeps
  `USER_JOURNEYS.md` current is not this skill, it is the close-out in
  `docs/general_docs/CLOSE_OUT.md`

---

## Onboarding gate

Refuse to run, and say why, unless all four sources carry real project content
rather than scaffold placeholders:

- `docs/agent_context/CORE_FLOWS.md` — the journeys
- The repository's milestones — the delivery plan. List them with
  `gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title'`
  (there is no `gh milestone` command; query `state=all`, because the endpoint
  defaults to open milestones only and a closed milestone is a delivered phase, not
  a missing one — never read an all-closed project as onboarding not having run).
  An empty list means onboarding has not created them; a `gh` error — not installed
  or not authenticated — means the check could not run, so report that rather than
  treating it as no milestones
- `docs/agent_context/SCOPE.md` — the product statement and agreed exclusions
- `docs/agent_context/PERMISSIONS_REFERENCE.md` — who uses it

If `USER_JOURNEYS.md` is already populated, only the first two matter — the others
are needed solely to generate it. Where a project predates `SCOPE.md`, ask the
developer for the product statement and exclusions directly rather than inventing them.

---

## Prerequisites

- Node.js available (`node` on PATH).
- `gh` CLI (≥ 2.94.0) installed and authenticated — the milestones that drive the
  Delivery Plan are read via `gh api`.
- A renderer: either the project's Playwright install (present after the Phase A test
  harness task) or a system Chrome/Edge. `scripts/render-pdf.mjs` finds one itself —
  do not install anything for this skill.

---

## Steps

### 1. Ensure the source document is current

Read `docs/project_docs/USER_JOURNEYS.md`.

- **Missing or scaffold-only:** generate it. Sources: `CORE_FLOWS.md` (journeys —
  one per flow in a delivered or in-progress phase), `SCOPE.md` (Product Statement →
  "The Product at a Glance"; Non-goals → "Agreed Exclusions"), `PERMISSIONS_REFERENCE.md`
  ("Who Uses It"), the repository's milestones ("Delivery Plan" — one row per
  milestone, listed with
  `gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title'`;
  each milestone's open and closed issue counts show which phases are delivered or
  in progress). Follow the rules in the scaffold's header exactly — customer
  language, no implementation detail, every journey carries its `Ref:` flow ID.
- **Present but possibly stale:** every flow ID in `CORE_FLOWS.md` belonging to a
  delivered or in-progress phase must have a journey carrying its `Ref:` tag, and each
  journey's steps must still match its flow's current description. To find what moved,
  run `git log -p --since` the last commit that touched `USER_JOURNEYS.md` over
  `CORE_FLOWS.md`. Update the affected journeys and tell the developer which changed.
  Check the Delivery Plan rows against the milestones too — a milestone with no open
  issues left is a delivered phase.
- **Deferred versus excluded:** a flow deferred to a later phase belongs in the
  Delivery Plan, not in Agreed Exclusions. Only capabilities ruled out altogether are
  exclusions. A `SCOPE.md` Non-goals row whose reason is "deferred to Phase N" is a
  Delivery Plan row here.
- If you created or changed any content above, set *Last updated* in the document
  header to today. If nothing needed changing, leave the date as it is — an export on
  its own is not a document change.

### 2. Build the HTML

1. Copy `assets/journey-template.html` to a working copy in the session's scratchpad
   directory (or the system temp directory if none is configured). Never edit the
   shipped asset.
2. Replace **every occurrence** of the four content markers. Note `CONTENT:TITLE`
   appears twice — once in `<title>`, once in the cover `<h1>`:

   | Marker | Content |
   |---|---|
   | `<!-- CONTENT:TITLE -->` | The project name (both occurrences) |
   | `<!-- CONTENT:SUBTITLE -->` | `User Journeys &amp; Delivery Plan` |
   | `<!-- CONTENT:META -->` | The "Prepared for" line and the date from the document's About This Document section, separated by `<br>` |
   | `<!-- CONTENT:BODY -->` | Everything from "The Product at a Glance" onward, converted per the table below |

   "About This Document" is cover material — its content goes to the cover markers and
   is not repeated in the body.

3. Convert the markdown to HTML using only the classes the template ships:

   | Markdown in `USER_JOURNEYS.md` | HTML |
   |---|---|
   | `##` document section | `<section class="doc-section"><h2>…</h2>` |
   | `###` area name | `<h3>…</h3>` |
   | Area intro sentence | `<p class="lead">…</p>` |
   | `####` journey | `<article class="journey">` containing, in this order: `<span class="ref">Ref: …</span>`, then `<h4>` title — the ref must come first for its float to sit level with the title |
   | `**Who:** …` | `<div class="who">Who: …</div>` |
   | Numbered steps | `<ol><li>…</li></ol>` |
   | `**Outcome:** …` (with any "If something goes wrong" sentence) | `<div class="outcome"><strong>Outcome:</strong> …</div>` |
   | Each "Who Uses It" paragraph | `<div class="role"><span class="role-name">Role</span> — …</div>` |
   | Delivery Plan table | `<table class="phases">` with a header row of `<th>` |
   | Agreed Exclusions list | `<div class="exclusions"><ul><li>…</li></ul></div>` |

   Keep the markdown's order and wording — this step is formatting, not editing. Do not
   add colours, fonts, or classes of your own: the brand block at the top of the
   template is the single source of visual identity.

### 3. Render the PDF

The project slug is the `name` field from `package.json`, lower-cased with spaces and
underscores replaced by hyphens; if there is no `package.json`, use the product name
from `SCOPE.md` treated the same way. If `docs/project_docs/exports/` already contains
an export, reuse the slug already in those filenames.

```bash
node .claude/skills/journey-export/scripts/render-pdf.mjs <working-copy>.html "docs/project_docs/exports/USER_JOURNEYS_[project-slug]_[YYYY-MM-DD].pdf"
```

The script tries the project's Playwright chromium first and falls back to system
Edge/Chrome headless. Both paths produce the same layout. If it exits non-zero, report
the error — do not hand-roll an alternative renderer.

### 4. Verify and hand over

1. Read the PDF and confirm: the cover renders, every section of `USER_JOURNEYS.md` is
   present, the Delivery Plan table is intact, and no content is clipped or overprinted
   at a page break.
2. If a check fails, you may adjust the **working copy** — never the shipped template —
   to fix pagination (split an oversized journey card, move a page break) and re-render,
   at most twice. If it still fails, keep the best output, and report exactly which
   check failed and where.
3. Report the output path, and say whether `USER_JOURNEYS.md` was created or updated in
   Step 1. Commit both together on the contributor branch, per the commit rule in
   `AGENTS.md` (Collaborative working).

---

## Branding

The template carries Libra's real identity, taken from libraeurope.com's own design
tokens:

| Token | Value | Used for |
|---|---|---|
| `--libra-primary` | `#1e3a5f` (libra-navy) | Cover, headings, table header |
| `--libra-primary-dark` | `#0f1f33` (libra-navy-darker) | Cover gradient base |
| `--libra-accent` | `#0891b2` (libra-teal) | Cover rule, journey card edge |
| `--libra-ink` / `--libra-muted` | `#2a2a3d` / `#6b6b84` (slate-900 / 600) | Body and secondary text |
| `--libra-line` / `--libra-wash` | `#e0e0e8` / `#f8f8fb` (slate-200 / 50) | Rules and tinted panels |

Type is Outfit for body and UI, DM Serif Display for the cover title and section
headings — the same pairing the website uses.

Two blocks in `assets/journey-template.html` hold all of this:

- **`LIBRA BRAND`** at the top of the stylesheet — colours and font stacks. Change
  brand values here and nowhere else.
- **`BRAND ASSETS`** at the bottom — the two font files (latin subsets) and the
  reversed Libra logo, embedded as base64 data URIs so the document renders identically
  with no network access. Do not hand-edit; to swap an asset, base64 the new file and
  replace the single value. Both fonts are SIL Open Font License 1.1, which permits
  embedding.

The branded footer band appears on the cover only. Content pages carry none by design —
see the comment in the template's cover-footer block before attempting to add one.

---

## What this skill never does

- Never invents journeys, capabilities, or dates that are not in the source documents
- Never includes internal detail — table names, routes, code, agent-context wording
- Never edits `CORE_FLOWS.md` — if the flows themselves look wrong, stop and tell the
  developer instead
- Never edits the shipped template or the brand block to fix a one-off document
- Never commits on a protected branch, and never pushes or opens a pull request
