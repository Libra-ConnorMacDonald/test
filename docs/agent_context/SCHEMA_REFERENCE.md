# Schema Reference

> All database tables. Read this before writing any database query or migration.
>
> **Rules:**
> - Update this file whenever a table or column is added, changed, or removed
> - Every column must have a "Notes" entry if there are business rules attached
> - Never let this file drift from `db/schema.ts` — they must stay in sync
> - Derived values (calculated from other columns) must be documented here and never stored

---

## Global Rules

> Fill in the global rules that apply across all tables in your project.
> The examples below are from a reference implementation — replace with your own.

- **[Data type rule]:** e.g. All monetary columns are `numeric`. Use Big.js for all arithmetic.
- **[Derived value rule]:** e.g. Percentage complete is always derived — never stored.
- **[Immutability rule]:** e.g. Once an actual date is set, it cannot be changed.
- **[Hold/state rule]:** e.g. When a record is locked, mutation routes must reject write attempts.
- **[Timestamp rule]:** e.g. `version_date` is always a TIMESTAMP, never a DATE.

---

## Table Template

```markdown
### [table_name]
[One-line description of what this table represents]

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| [column_name] | [type] | [not null / nullable / unique / FK] | [business rule or note] |
| createdAt | timestamp | default now() | |

**Rules:**
- [Table-level business rule 1]
- [Table-level business rule 2]
```

---

## Tables

*Tables will be populated here during onboarding, then updated as the schema evolves.*

---

## Derived Values (Never Stored)

> Document all values that must be calculated, never persisted.

| Value | Formula | Used in |
|---|---|---|
| *[e.g. Completion percentage]* | *[e.g. sections_complete / total_sections × 100]* | *[e.g. Progress bar, dashboard]* |

---

## Schedule / Calculation Algorithms (if applicable)

> If your project has server-side calculations (e.g. date shifting, financial modelling,
> critical path), document the algorithm here so agents implement it consistently.

*Document any complex server-side algorithms here.*
