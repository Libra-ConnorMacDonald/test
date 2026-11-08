# Theme Guidelines

> Single source of truth for all visual design decisions on this project.
> Populated during onboarding and expanded as the UI grows.
> All agents must read the relevant section of this document before writing any UI code.
> Colours follow the colour rule in §2: `app/globals.css` is their single source of truth.

---

## 1. Brand Colours

### 1.1 Primary Palette

| Role | Name | Hex | CSS Variable | Usage |
|---|---|---|---|---|
| Primary | [name] | `#[hex]` | `--color-primary` | [usage] |
| Accent | [name] | `#[hex]` | `--color-accent` | [usage] |
| Surface | [name] | `#[hex]` | `--color-surface` | [usage] |

### 1.2 Neutral Scale

[Describe the neutral/grey scale used — e.g. Tailwind Slate, a custom grey ramp, etc.]

### 1.3 Semantic Colours

| Role | Token | Value |
|---|---|---|
| Background | `--color-background` | |
| Foreground | `--color-foreground` | |
| Muted | `--color-muted` | |
| Border | `--color-border` | |
| Error | `--color-error` | |
| Success | `--color-success` | |
| Warning | `--color-warning` | |

### 1.4 Application-Specific Colours

*Add any status colours, category colours, or data visualisation colours specific to this project.*
*Document the rule for how each colour is applied and whether it can be overridden.*

---

## 2. CSS Variables

**The colour rule.** The CSS custom properties in `app/globals.css` are the single source of truth for
every colour. Components use them, directly or through the Tailwind classes mapped to them, never a hex
value. Where TypeScript needs a colour (a chart, a canvas, a map layer), its constant is derived from the
variable, as `'var(--color-primary)'` or read at runtime with `getComputedStyle`, never a hand-copied hex
value. The hex values in this document record what `app/globals.css` holds: change the CSS first.

```css
:root {
  /* Brand */
  --color-primary: #[hex];
  --color-accent: #[hex];
  --color-surface: #[hex];

  /* Semantic */
  --color-background: #ffffff;
  --color-foreground: var(--color-primary);
  --color-muted: var(--color-surface);
  --color-muted-foreground: [value];
  --color-border: [value];

  /* Status */
  --color-error: [value];
  --color-success: [value];
  --color-warning: [value];
}

.dark {
  --color-background: [value];
  --color-foreground: [value];
  --color-muted: [value];
  --color-border: [value];
}
```

---

## 3. Typography

### 3.1 Font Families

| Role | Font | Variable | Usage |
|---|---|---|---|
| Body / UI | [font name] | `--font-sans` | All body text, labels, inputs, buttons |
| Headings | [font name] | `--font-serif` | Headings and page titles (if applicable) |
| Monospace | [font name] | `--font-mono` | Code, logs, technical content |

### 3.2 Font Loading

Load via `next/font/google` (or equivalent) in `lib/fonts.ts`. Apply variables to the root `<html>` element in `app/layout.tsx`.

*Document the exact import and configuration once fonts are chosen.*

### 3.3 Type Scale

| Element | Size | Weight | Line Height |
|---|---|---|---|
| h1 | | | |
| h2 | | | |
| h3 | | | |
| Body | | | |
| Small / Label | | | |

---

## 4. Spacing & Layout

*Document the spacing scale, container widths, and any fixed layout dimensions that must not change without explicit approval.*

### 4.1 Spacing Scale

[Tailwind default / custom scale — describe here]

### 4.2 Container

[Max width, padding, responsive behaviour]

### 4.3 Fixed Layout Dimensions

*List any shell dimensions that are non-negotiable — e.g. sidebar width, header height, bottom bar height.*
*Agents must never change these without a spec update.*

| Element | Dimension | Notes |
|---|---|---|
| [e.g. Sidebar] | [e.g. w-14 / 56px] | Fixed — do not change |

---

## 5. Component Patterns

*Document the visual rules for core components. Expand this section as components are built.*

### Buttons

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | | | | |
| Secondary | | | | |
| Destructive | | | | |
| Ghost | | | | |

### Cards

[Background, border, radius, shadow, padding]

### Form Inputs

[Border, focus ring colour, error state, placeholder colour]

### Navigation

[Background, active state, hover state, role-gating rule — not rendered vs disabled]

---

## 6. Dark Mode

[Describe the dark mode strategy — CSS class toggle, system preference, or both.]

All dark mode overrides live in the `.dark` block in `app/globals.css`.
No component should hardcode light or dark values — always use the semantic variables above.

---

## 7. Animation

| Property | Value | Notes |
|---|---|---|
| Default duration | [e.g. 300ms] | |
| Default easing | [e.g. ease-in-out] | |
| Library | Motion for components and UI state. GSAP for timelines and scroll-driven sequences | Never both on one element. Rules in `docs/agent_context/UI_PATTERNS.md` |

*Document any specific animation patterns — slide-in panels, page transitions, loading states.*

---

## 8. Responsive Behaviour

### Breakpoints

[Tailwind default / custom — list the breakpoints used and what changes at each]

### Key Responsive Rules

*Document layout changes that agents must implement consistently.*

| Viewport | Rule |
|---|---|
| Mobile | |
| Tablet | |
| Desktop | |

---

## 9. Colour Contrast Reference

*Populate as colour combinations are established. All combinations must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).*

| Combination | Ratio | WCAG AA |
|---|---|---|
| Primary on white | | |
| White on primary | | |
| Accent on white | | |

---

## 10. Implementation Checklist

*Update this checklist as the design system is built out. Agents run through this before marking any UI phase complete.*

- [ ] CSS variables defined in `app/globals.css` (`:root` and `.dark`)
- [ ] Font variables applied to root `<html>` element
- [ ] All component colours reference CSS variables — no hardcoded hex values
- [ ] All interactive elements have visible focus states
- [ ] WCAG 2.1 AA contrast ratios verified for all text combinations
- [ ] Dark mode tested at all breakpoints
- [ ] Responsive behaviour verified at mobile, tablet, and desktop viewports

---

*Expand this document as the project's UI complexity grows.*
*If a visual rule is established during development that isn't documented here, add it immediately.*
