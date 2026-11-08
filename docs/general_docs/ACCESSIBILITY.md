# Accessibility Standards

> Read this document before writing any UI component code.
> All UI changes must comply with these standards without exception.

---

## Standard

Comply with **WCAG 2.1 AA** minimum. AAA where feasible.

## Required on every UI component

- Labels on all form fields
- Proper **ARIA** roles and attributes
- Adequate colour contrast (4.5:1 minimum for text)
- `alt` / `aria-label` text on all media elements
- Semantic HTML for clear document structure
- Every clickable or interactive element must visibly indicate interactivity (e.g. `cursor-pointer`)
- Keyboard navigable — all interactions must be reachable without a mouse
- Focus states must be visible — never remove outlines without a replacement

## Auditing

- Every page or major UI area a change touches must be covered by an axe-core scan in the end-to-end suite (`e2e/a11y/`) — this is the automated gate and it runs per task
- Fix all axe violations before marking any UI task complete; document any warning left unresolved with a reason
- Automated scanning catches only a portion of WCAG issues — keyboard navigation and screen-reader behaviour must still be verified by hand
- Run a Lighthouse accessibility audit periodically, at the end of a phase or before a release — it is a manual check, not a per-task gate
