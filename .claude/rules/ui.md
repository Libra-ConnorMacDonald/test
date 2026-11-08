---
paths:
  - "components/**"
  - "app/**/*.{tsx,jsx,css}"
  - "**/*.css"
---

# UI

Loads when you work on a component, a page, a layout or the stylesheet. The one-line rules in `AGENTS.md` (permission absence, 403, British English) still apply everywhere.

Read first: the patterns the task uses in `docs/agent_context/UI_PATTERNS.md`, `docs/project_docs/THEME_GUIDELINES.md`, `docs/general_docs/ACCESSIBILITY.md`, and the UI section of `docs/general_docs/ENGINEERING_STANDARDS.md`.

- **Patterns:** follow `UI_PATTERNS.md`. A new repeating pattern is added there at close-out.
- **Colours** come only from the CSS custom properties in `app/globals.css`. No hex value in code (`docs/project_docs/THEME_GUIDELINES.md` §2). Never take colour, font or spacing from a generic skill.
- **Permission-gated elements are not rendered.** Not disabled, not hidden with CSS.
- **States:** handle the empty, error and loading states, and what each role sees.
- **Accessibility:** every component meets `ACCESSIBILITY.md`, and every page or major UI area the change touches gets an axe-core scan in `e2e/a11y/`.
- **Server first:** Server Components by default in `app/`. Mark a Client Component explicitly with `'use client'`.
- **Browser-only libraries** are imported dynamically with `ssr: false`.
- **Layering:** `app/` holds pages and API routes only. `components/` is UI only and may import from `lib/`, never the reverse.
- **Copy** is British English and plain: no em dashes, no subtitle repeating its heading, no filler.
