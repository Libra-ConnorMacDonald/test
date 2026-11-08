# Permissions Reference

> All roles with complete access matrices. Read this before implementing any
> role-gated feature.
>
> **Rules:**
> - Sections and UI elements the user has no access to must **not be rendered** —
>   not disabled, not CSS-hidden, not rendered with a tooltip. If they cannot access
>   it, the element does not exist in the DOM.
> - Forbidden routes must return HTTP 403 — not redirect. Read the role with `auth()` and
>   call `forbidden()` from `next/navigation` in a page or layout with no `loading.tsx` or
>   `<Suspense>` above it, or return a 403 from `proxy.ts`; `NextResponse.json({ error: "Forbidden" }, { status: 403 })`
>   in API routes. Never use Clerk's `auth.protect({ role })`, which returns 404.
>   Placement rules: Where Role Gates Sit in `docs/agent_context/ROUTING.md`.
> - Never query the database to determine a user's role — roles are stored in the
>   auth provider (e.g. Clerk `publicMetadata.role`) and extracted server-side.

---

## Role Definitions

> Replace the examples below with your project's actual roles.

```ts
// lib/auth/utils.ts
export type Role = "[ROLE_1]" | "[ROLE_2]" | "[ROLE_3]" | "ADMIN";
```

---

## Role Template

```markdown
## [ROLE_NAME]

**Default landing:** `/[path]`

**Purpose:** [One sentence describing what this role does in the system]

### Navigation rendered
- [Section 1] ✓
- [Section 2] ✗ (not rendered)

### Permitted actions
- [Action 1]
- [Action 2]

### Prohibited actions
- Cannot [action]
- Cannot access [section]

### API routes accessible
- `GET /api/[resource]` — [what it can read]
- `PATCH /api/[resource]/[id]` — [what it can write]

### Special behaviours
- [Any edge cases or conditional rules for this role]
```

---

## Roles

*Roles will be populated here during onboarding.*

---

## Permission Matrix Summary

> A quick-reference table — keep this in sync with the individual role sections above.

| Feature | [ROLE_1] | [ROLE_2] | [ROLE_3] | ADMIN |
|---|---|---|---|---|
| [Action 1] | ✓ | ✓ | ✗ | ✓ |
| [Action 2] | ✗ | ✓ | ✗ | ✓ |
| [Config access] | ✗ | ✗ | ✗ | ✓ |

---

## Forbidden Route Behaviour

Any direct URL access to a forbidden route must return HTTP 403:

- Non-ADMIN access to `/config/*` → 403 via `forbidden()` in layout
- [Role] accessing [route] → 403
- [Add all forbidden route rules here]

**Do not** redirect. Use `forbidden()` in a page or layout with no `loading.tsx` or
`<Suspense>` above it, or a 403 response from `proxy.ts`. Below a Suspense boundary the
status is already 200. `forbidden()` requires `experimental.authInterrupts: true` in
`next.config.ts`; re-check that on every Next.js upgrade.

---

## API Route Role Guards

Every API route follows the route skeleton in `docs/general_docs/SECURITY.md` §5.4. A
role-gated route adds one check straight after authentication: read the role from the
auth provider and return `NextResponse.json({ error: "Forbidden" }, { status: 403 })` when
it is not permitted, before rate limiting or any database work.
