# Core Flows Reference

> All user flows, organised by application area. Written for an implementing agent — be dense and precise.
> Each flow must include enough detail for an agent to implement it correctly
> without needing to ask clarifying questions.
>
> **Rules:**
> - Flows are grouped by application area — not a flat numbered list
> - Document flows in priority order within each area
> - Always include: trigger, roles, steps, business rules, DB tables, API routes, UI states
> - Anything not yet known at onboarding time is marked as `[TBD]` — fill in as the project is built
> - Update this file whenever a flow changes — do not let it drift from the implementation
> - Deferred flows (a later phase than the current one) are documented here but clearly marked as deferred
> - All conventions from `AGENTS.md` apply automatically — they are not restated per flow

---

## Area Template

```markdown
## Area: [Area Name]

**Purpose:** [One sentence describing what this area does and its end goal]

---

### Flow [Area Prefix]-[N] — [Flow Name]

**Trigger:** [What causes this flow to begin — user action, URL navigation, background event]
**Roles:** [Which roles can trigger or see this flow]

**Steps:**
1. [Step 1 — be precise about component names, store actions, API calls]
2. [Step 2]
3. [Step 3]

**Business rules:**
- [Rule 1]
- [Rule 2]

**DB tables:** [Comma-separated list of tables read or written, or TBD]
**API routes:** [e.g. GET /api/[resource], POST /api/[resource], or TBD]

**UI states:**
- Loading: [what the user sees while data is loading]
- Empty: [what the user sees if there is no data]
- Error: [what the user sees if something fails]

**Phase:** [Phase A / Deferred — Phase B]
```

---

## Areas & Flows

*Populated during onboarding. One section per application area.*

---

## Background & Automated Flows

*Document any scheduled jobs, webhooks, or event-driven processes here.*

---

## Deferred Flows

*Flows captured during onboarding but not in scope for Phase A. Implement in the phase noted.*
