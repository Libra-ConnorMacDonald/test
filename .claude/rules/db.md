---
paths:
  - "db/**"
  - "drizzle.config.*"
---

# Database

Loads when you work in `db/`. The data-safety rule in `AGENTS.md` (ask before every data-altering operation) still applies everywhere.

Read first: the tables the task reads or writes in `docs/agent_context/SCHEMA_REFERENCE.md`, and `docs/agent_context/DATABASE.md` for the commands.

- **What lives here:** `db/` holds the schema and migrations only, with a single schema export in `db/schema.ts`. Seed scripts live in `db/seeds/`.
- **Tables and fields** match `SCHEMA_REFERENCE.md`. Derived values are derived, never stored. Audit and history rows are written wherever the reference requires them.
- **Queries are parameterised.** Never build SQL from strings.
- **Generating a migration file** runs without asking: it only writes a file. Applying a migration, pushing the schema and seeding alter data: state the exact command and the database, then wait for a yes (`DATABASE.md`, "Ask before running"). One yes covers one action.
- **Never** push against production. Development sessions never point at the production database; database branching is in `docs/general_docs/COLLABORATION.md`.
- **Seed and fixture data** is synthetic only: fictional names, `@example.com` addresses.
- **Money and precision:** store amounts in a precise type and do the arithmetic with Big.js, never native JavaScript floats.
