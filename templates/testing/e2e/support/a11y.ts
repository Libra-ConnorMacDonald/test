// e2e/support/a11y.ts
// axe-core accessibility helper for Playwright specs.
// Copied from `templates/testing/` in the project template — edit freely once copied.
//
// axe is the AUTOMATED gate: it runs on every CI build and blocks the merge.
// Automated scanning catches only a portion of WCAG issues — the rest needs
// manual keyboard and screen-reader verification. Keyboard traps, focus order,
// alt-text quality, screen-reader announcement and reflow all remain manual
// checks — see `docs/general_docs/ACCESSIBILITY.md`.

import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * WCAG 2.1 Level AA. The levels are cumulative, so the Level A tags are required
 * too — omitting `wcag2a` and `wcag21a` silently skips the majority of rules.
 * Add `'wcag22aa'` if the project targets WCAG 2.2.
 */
export const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/**
 * A rule waived for ONE scan, with a mandatory reason.
 *
 * Never use `disableRules()` for this — it kills the rule globally for the scan,
 * so a new instance of the same problem elsewhere on the page goes undetected.
 * Filtering by rule id against a documented list keeps every waiver greppable.
 */
export type AcceptedViolations = Record<string, { reason: string; ticket?: string }>;

export type A11yScanOptions = {
  /** Narrow the scan to one subtree, for example `'main'`. */
  include?: string;
  /** Remove subtrees from the scan. One selector per entry — arrays are not supported by axe. */
  exclude?: string[];
  /** Rules waived for this scan only. Every entry needs a reason. */
  accepted?: AcceptedViolations;
  /** Override the rule tags. Defaults to WCAG 2.1 AA. */
  tags?: readonly string[];
};

/** Compact fingerprint — the raw violation objects produce a 200-line diff. */
function fingerprints(violations: Result[]): { rule: string; impact: string | null | undefined; targets: string[] }[] {
  return violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    // `target` nests arrays for iframe and shadow-DOM boundaries — flatten first.
    targets: violation.nodes.map((node) => node.target.flat().join(' ')),
  }));
}

/** Human-readable block printed above the diff, naming the rule and the offending node. */
function describeViolations(violations: Result[]): string {
  if (violations.length === 0) {
    return 'No violations.';
  }

  return violations
    .map(
      (violation) =>
        `[${violation.impact}] ${violation.id}: ${violation.help}\n  ${violation.helpUrl}\n` +
        violation.nodes
          .map((node) => `  - ${node.target.flat().join(' ')}\n    ${node.html}`)
          .join('\n'),
    )
    .join('\n\n');
}

/**
 * Scan the current page and fail the test on any unwaived WCAG 2.1 AA violation.
 *
 * Prefer the `a11yScan` fixture in `e2e/support/fixtures.ts` — it binds this
 * function to the test's own page.
 */
export async function runA11yScan(page: Page, options: A11yScanOptions = {}): Promise<void> {
  const accepted = options.accepted ?? {};

  // A waiver with no reason is a silently disabled rule. Refuse it.
  for (const [rule, entry] of Object.entries(accepted)) {
    if (!entry.reason.trim()) {
      throw new Error(`Accepted accessibility violation '${rule}' has no reason — every waiver must state one.`);
    }
  }

  const builder = new AxeBuilder({ page }).withTags([...(options.tags ?? WCAG_21_AA)]);

  if (options.include) {
    builder.include(options.include);
  }

  // axe takes a single selector per call — chain one `.exclude()` per entry.
  for (const selector of options.exclude ?? []) {
    builder.exclude(selector);
  }

  const results = await builder.analyze();
  const unexpected = results.violations.filter((violation) => !(violation.id in accepted));

  // A waiver hides the rule page-wide, so a page that starts with one waived
  // node and grows to twenty still scans clean. Print what was waived and how
  // many nodes it covered, so the cost of each waiver stays visible in the log
  // rather than decaying silently into permanent blanket permission.
  const waived = results.violations.filter((violation) => violation.id in accepted);
  for (const violation of waived) {
    const { reason, ticket } = accepted[violation.id];
    console.warn(
      `Accessibility waiver applied on ${page.url()}: ${violation.id} — ` +
        `${violation.nodes.length} node(s) suppressed. Reason: ${reason}` +
        (ticket ? ` (${ticket})` : ''),
    );
  }

  expect(
    fingerprints(unexpected),
    `\nAccessibility violations:\n\n${describeViolations(unexpected)}\n`,
  ).toEqual([]);

  // axe reports zero false positives by design, so anything it could not decide
  // lands in `incomplete` and is invisible to the assertion above. Surface it —
  // a passing scan is not proof the page is clean.
  if (results.incomplete.length > 0) {
    console.warn(
      `Accessibility checks needing manual review on ${page.url()}: ` +
        results.incomplete.map((violation) => violation.id).join(', '),
    );
  }
}
