# Estimating Time and Effort

> **Portable.** The method is the same on every project. Only the "Gate costs" table and the
> calibration log at the bottom are project-specific, and Claude fills those in.

When asked how long something will take, or when writing an effort column in any
plan or roadmap, estimate in **wall-clock minutes/hours of Claude session time** —
never developer-days. Days are the wrong unit: a Claude session's cost is driven
by verification runs ("gates") and unknowns, not by lines of code. A four-step
phase once estimated at 3½ days took ~2 hours, half of it e2e builds.

---

## Give every estimate as three separate numbers

1. **Build time** — reading and writing code, tests and docs. Rules of thumb
   (starting figures from measured work; recalibrate them from the calibration log):
   ~1–2 min per small edit (a map entry, an import, a one-line wiring change);
   ~3–5 min per file of substantive change; ~5 min per unfamiliar area that must
   be read first where the code explains itself, ~10 min where it does not;
   ~5 min per schema migration; ~5–10 min per new UI component with its tests.
2. **Gate time** — the fixed cost of proving it works, per iteration. Use the
   measured figures in the "Gate costs" table below. Assume at least ONE full gate
   pass per step, plus one extra pass for every step that touches UI not yet seen
   rendered (first-pass UI bugs are normal, not a failure). **Steps built back to
   back and shipped as one commit share their gates** — budget passes per commit,
   not per step. A four-stage change budgeted at ~15 min of gates per stage needed
   two full passes of ~8 min.
3. **Human / calendar time** — anything that needs a person: approvals, pushes,
   secrets, device testing, third-party dashboards. State it as "blocked on you,
   needs X", never as Claude effort. Calendar time = Claude time + human time +
   waiting.

**Format:** `~40 min (25 build + 15 gates — two e2e runs) · then ~10 min of your
device check`. Name where the uncertainty actually sits ("haven't read the
billing module yet"; "depends on the model calling the tool reliably") instead
of padding the whole number. Give a range when there is a real unknown, and say
what the unknown is. **The range must span both branches of it.** In a mature
codebase the commonest unknown is "does a mechanism for this already exist?" —
and the answer is usually yes, so the LOW end of the range is the reuse case.
One step was quoted at 1 h 30 – 2 h, which covered only building a new
mechanism; the codebase already had one, and reusing it took ~15 min.

---

## Calibrate

When a step is finished, write the actual next to the estimate in the plan, and
add the pair to the calibration log below. If estimates drift past 1.5× either
way for two steps running, say so and adjust the rules of thumb above. Keep the
estimate/actual pairs — they are what lets the developer quote a track record to
other people.

---

## What estimates leave out — budget them as named line items

- **An independent review pass** on any change to shared core logic — money,
  auth, a shared engine, anything several routes call: ~20 min of agent time, run
  in parallel with the gates, plus ~10–15 min to verify and act on its findings.
  One such review found a regression every test passed.
- **A read-only simulation on real data** for engine or pipeline changes — the real
  code path over the development database's rows (never production), printing
  what it would produce: ~5 min. One caught two defects the unit tests passed, and
  for a feature backed by a paid model it is the only proof short of a live,
  billed call.
- **Docs** — the close-out (`CLOSE_OUT.md`) and device checks: ~5–10 min. They are not part of the build, so write them while the gates
  run.

---

## End-to-end / browser test suites (Playwright, Cypress, Detox, …)

- **Measure the run, not the tests.** The run is dominated by fixed costs — the
  production build or dev-server warm-up, auth setup, seeding. Adding a spec adds
  seconds, not minutes.
- **Budget one full run per step, plus one re-run for every step that touches a
  page an existing spec drives.** A full suite on a shared dev database has a real
  chance of one flake. Budget the re-run; don't call it a failure.
- **Targeted runs still pay the build** — roughly half a full run, not a tenth.
  Batch changes so each step needs one build.
- **Serial spec files cost their sum**; note when a step adds to one.
- **Behaviour that needs a live AI model is a device check, not an e2e** —
  estimate ~2 min to write the checklist entry, not an automated test.
- **Never edit source while a production build is running**, and never overlap
  two builds (they race on output files). Gates are dead time that cannot be
  overlapped with building — which is why they dominate.

---

## Reporting to other people

| Claude gives | Report it as |
|---|---|
| Build + gate time | **Effort** — what it costs to build (this replaces "3 days") |
| Human time | **Your involvement** — what a person must do, and when |
| Calendar time | **When it will be done** — the only number legitimately in days |

Small changes have a floor (one full gate ≈ the table's total), so five small
items batched into one step are cheaper per item than five separate requests.

---

## Gate costs (measured — Claude fills this in; update when they change)

If this table is still the template, time one full gate pass in the first
session, fill it in, and say so. Do not estimate against defaults for longer.

| Gate | Tool | Typical time | Notes |
|---|---|---|---|
| Type check | `pnpm tsc --noEmit` | [measure] | |
| Lint | `pnpm lint` | [measure] | |
| Unit and integration | Vitest, `pnpm test` | [measure] | [test and file count, and the date measured] |
| Build | `pnpm build` | [measure] | |
| End-to-end | Playwright, `pnpm test:e2e` | [measure] | [the run after the build; a single spec; the flake rate] |

---

## Calibration log (estimate vs actual — keep adding to it)

Actuals are wall-clock from the go-ahead to the pushed commit, taken from the
session transcript and git, not from memory.

Add a row for every ticket when it closes, even one that had no estimate: the
sessions and handoffs columns are worth recording on their own.

Record the ticket type, the model and effort that built it, and whether it passed
review first time. The routing rules in `TOOLKIT.md` read these three columns before
any role moves to a cheaper model: the pass rate for a ticket type on the cheaper
model has to match the current one.

Record the sessions the ticket took and its handoffs, which is the number of
`## Handoff` comments on its issue. These tune the sizing rule in
`TASK_HIERARCHY.md` and the context thresholds in `HANDOFF.md`. If tickets sized by
the rule keep needing a handoff, the rule allows too much; if sessions rarely reach
the checkpoint, the thresholds are too cautious. Say so and adjust them, as for the
rules of thumb above.

| Date | Work | Ticket type | Model and effort | Review | Sessions | Handoffs | Estimated | Actual | |
|---|---|---|---|---|---|---|---|---|---|
| [YYYY-MM-DD] | [the step, and what it covered] | [feature, bug fix, refactor, tests, docs, migration] | [the alias and level, such as `opus` `medium`] | [passed first time, or the number of review rounds] | [sessions that worked the ticket] | [handoff comments on the issue; a split after the second is noted here] | [the figure given, and when, or none] | [wall clock, go-ahead → pushed commit] | [the ratio, and the lesson] |

> Copying this file to another project: blank the gate table and the calibration
> log above, and Claude will time one full gate pass in the first session and
> fill it in.
