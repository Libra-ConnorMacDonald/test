# User Journeys & Delivery Plan

> **This document is customer-facing.** It is the presentable translation of
> `docs/agent_context/CORE_FLOWS.md` — written for the customer, in their language,
> with no implementation detail. It is what gets exported to the branded PDF via the
> `journey-export` skill and presented back to the customer.
>
> **Rules:**
> - Plain language only — no table names, API routes, component names, schemas, or store actions
> - Every journey traces to a flow in `CORE_FLOWS.md` via its `Ref:` tag — never describe a journey that has no flow behind it, and never invent capability that is not specified
> - Keep each journey under 10 steps — if it needs more, it is two journeys
> - British English, present tense, second person where natural ("you approve the request")
> - Update whenever a user-facing flow is added or changed — this document and `CORE_FLOWS.md` move together
> - Populated during onboarding (Section 9); the structure below ships with the scaffold

---

## About This Document

This document describes [PROJECT NAME] from the perspective of the people who use it:
what they can do, how each journey unfolds, and when each capability will be delivered.
It is intended for review with the customer and reflects the currently agreed scope.

*Prepared by Libra Europe · Last updated: [date]*

---

## The Product at a Glance

> 3–5 lines, adapted from the Product Statement in `docs/agent_context/SCOPE.md` —
> reworded for the customer, not copied.

*Populated during onboarding.*

---

## Who Uses It

> One short paragraph per role, in plain words — what this person is trying to get
> done, not what permissions they hold. Derived from `PERMISSIONS_REFERENCE.md`.

*Populated during onboarding.*

---

## User Journeys

> One section per application area, in the same order as `CORE_FLOWS.md`.
> Journey template:

```markdown
### [Area Name]

[One sentence on what this area is for, in customer language.]

#### [Journey title — verb-first, e.g. "Booking a visit"]  `Ref: [flow ID]`

**Who:** [role name(s) in plain words]

1. [Step — what the person does and what they see, one action per step]
2. [Step]
3. [Step]

**Outcome:** [What has changed for the person when the journey completes.]
[Only if meaningful to the customer:] **If something goes wrong:** [what the person
sees and what happens next — reassurance, not error codes.]
```

*Populated during onboarding, one journey per Phase A flow. Deferred flows belong in
the Delivery Plan below, not here.*

---

## Delivery Plan

> The repository's milestones, one per phase, translated into what the customer will
> be able to see and do at the end of each one. List them with
> `gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[] | "\(.title): \(.open_issues) open / \(.closed_issues) closed"'`;
> each milestone's open and closed issue counts show how far a phase has progressed.
> Epics or sprints map to the same table — one row per delivery increment.

| Phase | What it delivers | Journeys available at the end of it |
|---|---|---|
| *[Phase A — name]* | *[customer-visible outcome, one line]* | *[journey titles, or "Foundation — nothing customer-visible yet"]* |

*Populated during onboarding. Update the row when a phase completes (its milestone has
no open issues left) or its content changes.*

---

## Agreed Exclusions

> The Non-goals from `docs/agent_context/SCOPE.md`, reworded so they are safe and clear
> to present — what the product deliberately does not do, and where that was agreed.
> Omit internal reasoning that should not reach the customer.
>
> Only capabilities ruled out altogether belong here. A Non-goals row whose reason is
> "deferred to Phase N" is a Delivery Plan row, not an exclusion — never present the
> same item as both.

*Populated during onboarding.*

---

*Export with the `journey-export` skill at `.claude/skills/journey-export/` — produces a
Libra-branded PDF in `docs/project_docs/exports/`.*
