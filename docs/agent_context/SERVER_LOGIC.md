# Server-Side Domain Logic Requirements

> Read this document when building any server action, API route, or logic that
> involves calculations, state transitions, or auditable operations.
> Populated during onboarding and updated as server-side requirements are established.

---

## The Rule

If the client cannot be trusted to calculate something correctly, or if the result
must be auditable, it must be calculated and persisted server-side.

Client-side previews are permitted where UX requires it, but the server must always
recalculate and persist the authoritative result.

---

## Server-Authoritative Logic

*Populated during onboarding from Section 7. Add entries as new requirements are identified.*

- [ ] [Critical calculation or state transition]
- [ ] [Audit-logged operation]
- [ ] [Permission-enforced mutation]

---

## Adding New Requirements

When a new piece of logic is identified as server-authoritative:
1. Add it to the list above
2. Record the decision in `docs/agent_context/DECISIONS.md`
3. Ensure it is enforced at the API layer — never rely on client-side enforcement
