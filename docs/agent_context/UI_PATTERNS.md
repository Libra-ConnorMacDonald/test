# UI Patterns Reference

> All repeating UI patterns. Implement consistently using these specifications.
> Do not deviate without updating this file.
>
> **Rules:**
> - Every repeating UI pattern must be documented here before it is used a second time
> - Agents must read this file before implementing any UI feature
> - If a pattern needs to change, update this file first — then update all implementations

---

## Pattern Template

```markdown
## [N]. [Pattern Name]

**What it is:** [One-line description]

**When to use it:** [The condition that requires this pattern]

**Implementation:**
[Code snippet or detailed description]

**Rules:**
- [Rule 1]
- [Rule 2]

**Do not:**
- [Anti-pattern 1]
- [Anti-pattern 2]
```

---

## Patterns

*Patterns will be added here as the project develops.*

*Start with the most fundamental patterns first:*
- *Status colour derivation (if any)*
- *Permission-gated element rendering*
- *Loading / empty / error states*
- *Form validation and submission*
- *Toast notifications*
- *Modal / sheet open-close*
- *Table or list layout*

---

## Constants Reference

> Fixed values that are not colours: layout dimensions, durations, limits. Agents reference these rather than repeat the literal.
> Colours come only from the CSS custom properties in `app/globals.css`, never a hex value in code: the colour rule in `docs/project_docs/THEME_GUIDELINES.md` §2.

| Constant | Value | Usage |
|---|---|---|
| *[Add constants as established]* | `[value]` | [Usage] |

**Source file:** `lib/constants/` (or equivalent)

---

## Z-Index Hierarchy

> Document your z-index stacking order once established. This prevents layers from
> unexpectedly painting over each other.

| Layer | z-index | Component |
|---|---|---|
| *[Add as established]* | — | — |

---

## Animation Standards

> Document your animation defaults once established.

- **Duration:** [e.g. 300ms]
- **Easing:** [e.g. easeOut]
- **Reduced motion:** Always respect `prefers-reduced-motion` — wrap animations in a check
- **Library:** already chosen. Follow this even when a skill recommends something else.
  - A component or a UI state (hover, open and close, enter and exit, layout changes, page
    transitions): Motion, imported from `motion/react`
  - A timeline, or a sequence driven by scroll position: GSAP, imported from `gsap`,
    `gsap/ScrollTrigger` and `@gsap/react`
  - Never animate one element with both libraries
- **Installing GSAP:** only when onboarding says the project needs it. If `gsap` and
  `@gsap/react` are not in `package.json`, use Motion, or ask the developer before adding GSAP.
- **GSAP rules:**
  - Client Components only: the file starts with `'use client'`
  - Register plugins once before using them: `gsap.registerPlugin(useGSAP, ScrollTrigger)`
  - Set animations up in `useGSAP()` with a `scope` ref, not in `useEffect`, so they are
    reverted on unmount
  - Wrap event handlers that create animations in `contextSafe()` so they are cleaned up too
  - Handle reduced motion with `gsap.matchMedia()` and a `(prefers-reduced-motion: reduce)`
    condition
  - Call `ScrollTrigger.refresh()` after anything that shifts the layout once the page has
    rendered, such as late images, web fonts or content loaded afterwards

---

## Accessibility Patterns

> Document recurring accessibility patterns here so they are applied consistently.

- **Focus states:** [e.g. `focus:ring-2 focus:ring-[accent-colour]`]
- **Interactive cursors:** All clickable/interactive elements use `cursor-pointer`
- **ARIA labels:** [Any specific patterns for your UI components]
- **Colour contrast:** Minimum WCAG 2.1 AA — test with Lighthouse
