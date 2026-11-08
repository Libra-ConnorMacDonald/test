---
paths:
  - "app/api/**"
  - "app/**/route.{ts,tsx}"
  - "app/**/*actions*.{ts,tsx}"
  - "app/**/actions/**"
  - "lib/**"
  - "proxy.ts"
  - "middleware.ts"
---

# API routes and server logic

Loads when you work on an API route, a Server Action, `lib/` or the proxy. The one-line rules in `AGENTS.md` (403, data safety, security) still apply everywhere.

Read first: `docs/agent_context/SERVER_LOGIC.md` for server-authoritative logic, the tables the task touches in `docs/agent_context/SCHEMA_REFERENCE.md`, the roles in `docs/agent_context/PERMISSIONS_REFERENCE.md`, and the API section of `docs/general_docs/SECURITY.md` §3.

- **Prefer the server primitives.** Server Components, Server Actions and server functions come before API routes. Add an API route only when it is strictly necessary.
- **Responses:** every API route response uses `NextResponse.json()`.
- **Validation:** every API route and Server Action validates its input with a schema before using it, and sanitises user input.
- **Access control:** every route that needs a role or permission checks it on the server, with the least privilege the task needs. Permission-protected fields are protected here, at the API layer, not only in the UI. Route handlers and Server Functions always check for themselves; a layout gate does not cover them.
- **Forbidden is 403.** Never a redirect. Where the gate sits: `docs/agent_context/ROUTING.md`, Where Role Gates Sit.
- **Cookies:** the auth provider owns its session cookie; the app's own cookies are `HttpOnly`, `Secure` and `SameSite=Lax` or `Strict` (`docs/general_docs/SECURITY.md` §5.5). Use CSRF protection where it applies.
- **Logging:** log errors with enough context to act on, and never log sensitive user information.
- **Money and precision:** complex monetary or precision arithmetic uses Big.js, never native JavaScript floats.
- **Layering:** `lib/` holds business logic and utilities and never imports from `components/`.
