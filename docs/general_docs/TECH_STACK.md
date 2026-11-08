# Tech Stack Reference

> This document is the authoritative reference for all technology choices, tooling,
> deployment configuration, and environment setup for this project.
>
> **How to use:** Fill in every section at the start of the project. Update it whenever
> a dependency is added, upgraded, or removed. Agents should read this before making
> any decisions about libraries, commands, or configuration.

---

## Core Stack

> This table is pre-populated with the default stack. Update any row during or after onboarding to reflect your project's actual choices.

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router only) | 15.x | Server Components by default |
| Language | TypeScript (strict mode) | 5.x | `strict: true` in `tsconfig.json` |
| Runtime | Node.js | 24.x | Native WebSocket — no `ws` package needed |
| Database | Neon PostgreSQL (serverless) | — | WebSocket driver required for transactions |
| ORM | Drizzle ORM | 0.45.x | Schema in `db/schema.ts` |
| Auth | Clerk (`@clerk/nextjs`) | 7.x | Roles in `publicMetadata.role` |
| Styling | Tailwind CSS | 4.x | CSS custom properties via `@theme inline` |
| Components | shadcn/ui | latest | Owned by codebase — edit directly in `components/ui/` |
| Server state | TanStack Query | v5 | Server data in Client Components. Set caching and refetching per query |
| Client state | Zustand | v5 | UI state only — no server data |
| Validation | Zod | v4 | All API routes validated |
| Animation | Motion (`motion`) | 14.x | Components and UI state. Import from `motion/react`. `duration: 0.3`, `ease: 'easeOut'` |
| Timeline and scroll animation | GSAP (`gsap`, `@gsap/react`) | 3.x, 2.x | Installed only when onboarding says the project needs it. Free, but not an OSI licence, so licence scanners flag it |
| Unit testing | Vitest | 4.x | Config in `vitest.config.ts` |
| E2E testing | Playwright | 1.62.x | Browsers installed via `pnpm exec playwright install` |
| Accessibility testing | `@axe-core/playwright` | 4.x | Automated WCAG gate in CI |
| Test auth | `@clerk/testing` | 2.x | Testing Tokens — one stored session per role |
| Test env loading | `dotenv` | 17.x | Loaded at the top of `playwright.config.ts` — reads `.env.local` in every worker |
| Hosting | Vercel | — | — |

---

## Package Manager

**Use:** `pnpm`

> If `pnpm` is not available in the environment, fall back to `npm`. Never mix package
> managers within a single project — check `package.json` for the `packageManager` field.

**Key commands:**

```bash
pnpm install              # Install dependencies
pnpm add [package]        # Add a dependency
pnpm add -D [package]     # Add a dev dependency
pnpm remove [package]     # Remove a dependency
pnpm run [script]         # Run a package.json script
```

---

## Dev Tooling

### TypeScript

- **Config:** `tsconfig.json` with `strict: true` — no exceptions
- **Check:** `pnpm tsc --noEmit` — run this before marking any task complete
- Treat all TypeScript errors as blockers — do not suppress with `// @ts-ignore` unless
  there is a documented, unavoidable reason

### Linting

- **Tool:** ESLint
- **Config:** `eslint.config.mjs`
- **Run:** `pnpm lint`
- Fix all lint errors before marking a task complete — do not suppress warnings without justification

### Formatting

> Fill in your formatter of choice:

- **Tool:** [Prettier / Biome / none]
- **Config:** [`.prettierrc` / `biome.json` / —]
- **Run:** `pnpm format`
- Formatting must pass in CI — do not commit unformatted code

### Testing

- **Unit / integration:** Vitest — `pnpm test` (watch: `pnpm test:watch`, coverage: `pnpm test:coverage`). `vitest.config.ts` sets `environment: 'node'` — the scaffolding ships no component-test library, so add one and switch the environment to `jsdom` before writing any component test
- **E2E:** Playwright — `pnpm test:e2e` (interactive: `pnpm test:e2e:ui`)
- **Accessibility:** `@axe-core/playwright` — `pnpm test:a11y`. This is the automated gate in CI; Lighthouse remains a periodic manual check, not a per-task gate
- **Permissions:** `pnpm test:permissions` — the generated `e2e/permissions/permission-matrix.spec.ts`, regenerated wholesale by the `test-author` skill
- **Config:** `vitest.config.ts` and `playwright.config.ts`, both at the project root
- **Coverage target:** 80% for `lib/` — no target enforced on `app/` or `components/`. `vitest.config.ts` enforces it as a hard threshold and Vitest exits non-zero when it is missed. How to start a young project below it: the Coverage rules in `docs/general_docs/TESTING_STANDARDS.md`
- **Test location:** unit and integration in `tests/`, end-to-end in `e2e/` — the scaffolding is copied from `templates/testing/` during the Phase A setup task, never during onboarding
- **Test users:** fixed, one per role, created manually in the auth provider — concurrent CI jobs share them, so every test must scope its own data with a unique per-test identifier rather than assuming a private user. For full isolation, seed and delete a user per run through the Clerk Backend API instead
- **Selectors:** query by accessible role and name — `getByRole`, `getByLabel`, `getByText`. `getByTestId` is permitted only for elements with no accessible identity, such as a chart canvas or a map container, and the spec must carry a one-line comment saying why
- **Permission gating:** an absence assertion takes two parts. First prove the page rendered — `await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()` — then assert the gated element is absent with `await expect(locator).toHaveCount(0)`. Absence on its own also passes on a page that returned 500, rendered an empty error shell, or redirected to sign-in, so it would report the gate working when nothing was ever gated. `expectAbsent` in `e2e/support/permissions.ts` takes the render proof as a required argument — use it rather than a bare `toHaveCount(0)`. Never `toBeDisabled()` and never `not.toBeVisible()`, because both pass against a violating implementation as well as a correct one
- **Forbidden routes:** assert an HTTP 403 status and assert that no redirect occurred — a test that only checks the page looks blocked cannot tell 403 from a redirect
- Every task must ship the tests named in its **Tests** field — see `docs/agent_context/TEST_REFERENCE.md`
- Tests must pass before merging into the integration branch — never skip a test or mark it `.only` to get a build green

---

## Deployment & CI/CD

### Hosting

- **Platform:** Vercel
- **Production branch:** the release branch, `releaseBranch` in `.claude/collab.json`
- **Preview branches:** All pull requests get a preview deployment automatically

### CI Pipeline

```
On pull request:
  1. pnpm audit --prod --audit-level=high               # fails on a high or critical advisory (SECURITY.md §6)
  2. pnpm tsc --noEmit
  3. pnpm lint
  4. pnpm test:coverage                                 # unit and integration, enforces the lib/ coverage threshold
  5. pnpm exec playwright install --with-deps chromium  # browser binaries, not optional
  6. pnpm build
  7. pnpm test:e2e                                      # Playwright starts the app itself
  8. Vercel preview deployment

On merge to the release branch:
  1. All of the above
  2. pnpm drizzle-kit migrate (production)
  3. Vercel production deployment
```

> **Rule:** End-to-end tests run against a locally started server, never against the Vercel
> preview — the `webServer` block in `playwright.config.ts` starts the built app before the
> suite. Never move `pnpm test:e2e` after the preview deployment to borrow its URL: the
> deployment is the last step, so the suite would be waiting on something that does not
> exist yet.

### Environment Promotion

- **Development:** Local `.env.local` — never commit this file
- **Preview:** Vercel preview environment variables (set in Vercel dashboard)
- **Production:** Vercel production environment variables (set in Vercel dashboard)

> **Rule:** Never run `drizzle-kit push` against production. Always use
> `drizzle-kit generate` + `drizzle-kit migrate` for production schema changes.

---

## Environment Variables & Secrets Management

### Required Variables

> List every environment variable the project needs. This table should be
> kept in sync with `.env.example`.

| Variable | Required | Where to find it | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✓ | Neon dashboard | WebSocket connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | Clerk dashboard | Public — safe to expose |
| `CLERK_SECRET_KEY` | ✓ | Clerk dashboard | Secret — never expose client-side |
| `CLERK_WEBHOOK_SECRET` | ✓ | Clerk dashboard | Webhook verification |
| `UPSTASH_REDIS_REST_URL` | ✓ | Upstash dashboard | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ | Upstash dashboard | Rate limiting |
| `E2E_ADMIN_EMAIL` | ✗ | Chosen when the test users are created | Test only — the admin test user's address |
| `E2E_[ROLE]_EMAIL` | ✗ | Chosen when the test users are created | Test only — one row per additional role in the permission matrix. `.env.example` ships `E2E_MANAGER_EMAIL` and `E2E_MEMBER_EMAIL`, matching the default `ROLES` array in `e2e/support/auth.ts` |
| `E2E_USER_PASSWORD` | ✗ | Chosen when the test users are created | Test only — shared password for the per-role test users |
| `E2E_BASE_URL` | ✗ | — | Test only — overrides the locally started server the E2E suite runs against |

> Add rows for every variable your project needs. Test-only variables belong in `.env.local` —
> that is the file the end-to-end harness actually reads, loaded by the `dotenv.config()` call at
> the top of `playwright.config.ts` before any spec is imported, and it is gitignored. Nothing
> loads `.env.test`, so never point a project at it. Never put real values in `.env.example` —
> it carries placeholders only.

### Rules

- **Never commit** `.env.local`, `.env`, or any file containing real secrets
- `.env.example` must exist and be kept up to date — it documents all required variables with placeholder values
- Use a secrets manager (e.g. Vercel environment variables, Doppler) for production
- Validate all environment variables at startup using `t3-env` or equivalent — fail fast rather than silently misconfigure

### Local Setup

```bash
cp .env.example .env.local
# Fill in real values for your local environment
```

---

## Third-Party Services & API Integrations

> Document every external service the project depends on. Update this table
> whenever a new integration is added.

| Service | Purpose | Auth Method | Rate Limits | Notes |
|---|---|---|---|---|
| Neon | PostgreSQL database | Connection string | — | WebSocket driver required |
| Clerk | Authentication & user management | API keys + webhook | — | Roles in `publicMetadata` |
| Upstash Redis | Rate limiting | REST API token | — | Graceful fallback if unavailable |
| Vercel | Hosting & deployment | Vercel token (CI) | — | Preview per PR |

> Add rows for every service: payment providers, email services, analytics, CMS, etc.

### Integration Rules

- All third-party credentials live in environment variables — never hardcoded
- All third-party API calls must handle failure gracefully — no service should be a hard dependency that crashes the app if unavailable
- Document the fallback behaviour for each integration in the table's Notes column

---

## Database

### Driver

**In use:** `@neondatabase/serverless` `Pool` (WebSocket) + `drizzle-orm/neon-serverless`

```ts
// db/index.ts — the only correct implementation
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });
```

> **Do not** switch to `drizzle-orm/neon-http` — the HTTP driver does not support
> `db.transaction()`. All mutation routes use transactions.

### Migration Commands

```bash
pnpm drizzle-kit push        # Dev only — push schema changes directly
pnpm drizzle-kit generate    # Generate a migration file
pnpm drizzle-kit migrate     # Apply migration files
pnpm db:seed                 # Run seed scripts
```

Only `generate` runs without asking. `push`, `migrate` and `db:seed` alter data, the shared development branch included, so an agent states the command and waits for a yes (`docs/agent_context/DATABASE.md`).

### Schema Location

`db/schema.ts` — single file export. See `docs/agent_context/SCHEMA_REFERENCE.md`
for the full table reference.

---

## Design System

Full specification in `docs/project_docs/THEME_GUIDELINES.md` (or equivalent).

**Key tokens:**

| Token | CSS variable | Tailwind class | Usage |
|---|---|---|---|
| Primary | `--color-primary` | `bg-[project]-primary` | Navigation, primary buttons, headings |
| Accent | `--color-accent` | `bg-[project]-accent` | Secondary actions, success states |
| Surface | `--color-surface` | `bg-[project]-surface` | Page backgrounds, card surfaces |

> **Replace this table** with your project's brand tokens. Populated during onboarding if a design system is provided.

**Typography:** [Body and UI font], [display font, if any]. Loaded via `next/font` in `lib/fonts.ts`.

> **Replace** with your project's fonts.

**Component library:** shadcn/ui only. Components live in `components/ui/` and are owned
by the codebase — edit directly, do not import from the package.

**Animation standard:** Motion for components and UI state, `duration: 0.3`, `ease: 'easeOut'`.
GSAP for timelines and scroll-driven sequences, and only once the project has installed it.
Never both on one element. Always respect `prefers-reduced-motion`. Which library to use
when, and the GSAP rules: `docs/agent_context/UI_PATTERNS.md`, Animation Standards.

**Colours** come only from the CSS custom properties in `app/globals.css`, never a hex value in code: the colour rule in `docs/project_docs/THEME_GUIDELINES.md` §2.

---

*Keep this document up to date. An outdated tech stack reference is worse than none.*
