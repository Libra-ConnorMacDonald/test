# Routing & Navigation Contract

> Read this document when building or modifying any route, navigation element,
> or access-controlled page. Populated during onboarding and updated as routes are added.

---

## Rules (always enforced)

- Routes the user has no access to: **not rendered** in navigation, **403** if accessed directly
- Never redirect for access control — always return 403
- A redirect leaks that the route exists; 403 does not
- Use `forbidden()` from `next/navigation` with `experimental: { authInterrupts: true }` in `next.config.ts`

---

## Where Role Gates Sit

A 403 is only real if the check runs before the response starts streaming. Once a `loading.tsx` or `<Suspense>` fallback renders, the headers are sent and the status is fixed at 200. A later `forbidden()` still shows the forbidden page, but the status stays 200.

- Run each route's role gate in one of two places:
  - `proxy.ts`, returning a 403 response directly. `forbidden()` cannot be called there.
  - A page or layout with no `loading.tsx` or `<Suspense>` above it, awaited at the top of the component before it returns anything that suspends.
- Never below a `loading.tsx`. A `loading.tsx` wraps the page and any nested layouts in its own folder and every folder beneath. It does not wrap the layout in its own folder, so a gate in that layout still returns 403.
- The root layout cannot call `forbidden()`.
- Read the role with `auth()` and call `forbidden()` yourself. Never use Clerk's `auth.protect({ role })` or `auth.protect({ permission })` as a role gate: a signed-in user without the role gets a 404, not a 403.
- A layout gate does not re-run on client navigation between its child pages, and does not stop those pages rendering. Repeat the check in the page or the data access function. Server Functions and route handlers always check for themselves.
- `forbidden()` is still experimental and needs `experimental.authInterrupts`. Re-check this against the Next.js docs on every upgrade, and change the config only when the docs do.

---

## Top-Level Routes

*Populated during onboarding. Add routes here as they are built.*

```
/[section-1]
/[section-2]
/[section-3]      ([ROLE] only)
```

---

## Sub-Views

*List any nested view structures and the URL pattern they follow.*

---

## Default Route per Role

| Role | Default landing |
|---|---|
| [ROLE_1] | `/[path]` |
| [ROLE_2] | `/[path]` |

---

## Access Rules

*Document any route-level access rules that differ from the general permissions matrix.*

*Full permissions matrix: `docs/agent_context/PERMISSIONS_REFERENCE.md`*
