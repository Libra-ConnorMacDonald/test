# Database — Seeding & Migrations

> Read this document when running migrations, seeding data, or making schema changes.
> Commands below reflect the default stack. Update if your project uses a different ORM or driver.

---

## Commands

```bash
# Generate a migration file from the schema (writes a file, touches no database)
pnpm drizzle-kit generate

# Apply migration files to the database the connection string points at
pnpm drizzle-kit migrate

# Development: push the schema straight to the development database branch
pnpm drizzle-kit push

# Seed reference data (run once after initial migration)
pnpm db:seed
```

---

## Ask before running

Applying a migration, pushing the schema and seeding all alter data, so each one
follows the data-safety rule in `AGENTS.md`:

1. State the exact command and the database it will run against
2. Stop and wait for the developer's yes
3. Run that one command. One yes covers one action, not the next

This holds for the development database branch too. It is shared by every
contributor, so a `drizzle-kit push` or `db:push` against it is a data-altering
operation like any other. Generating a migration file is not: it only writes a
file, so `drizzle-kit generate` runs without asking.

---

## Rules

- **Never** run `push` against production. Production changes go through `generate`, then `migrate`, from a merged pull request
- Migrations must be idempotent — safe to re-run without side effects
- Seed scripts live in `db/seeds/` and run independently of migrations
- The application must not be expected to function without required seed data — document it below

---

## Required Seed Data

*Populated during onboarding. List any reference data that must exist for the application to function.*

---

## Schema Reference

Full schema with table definitions, field types, relationships, and business rules:
`docs/agent_context/SCHEMA_REFERENCE.md`
