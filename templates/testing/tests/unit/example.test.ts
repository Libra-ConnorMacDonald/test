// tests/unit/example.test.ts
// WORKED EXAMPLE. Copied from `templates/testing/` in the project template.
//
// Delete this file once `lib/` has real modules to test.
//
// It imports nothing beyond the devDependencies the harness installs, so `pnpm
// test` and `pnpm exec tsc --noEmit` are both green the moment it is copied. Its
// job is to demonstrate the assertion style for precision arithmetic — the one
// place where the obvious assertion is quietly wrong.

import { describe, it, expect } from 'vitest';

// In a real test, import the function under test. The `@/` alias resolves via
// the project's `tsconfig.json` paths — see `resolve.tsconfigPaths` in
// `vitest.config.ts`.
//
// import { formatMinorUnits } from '@/lib/money';

/**
 * Stand-in for a real `lib/` module so this example runs on a fresh copy.
 * Money held as integer minor units — pence, cents — never as a float.
 */
function addMinorUnits(a: number, b: number): number {
  return a + b;
}

/** Renders integer minor units as a fixed two-decimal string. */
function formatMinorUnits(value: number): string {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const major = Math.trunc(absolute / 100);
  const minor = String(absolute % 100).padStart(2, '0');
  return `${sign}${major}.${minor}`;
}

describe('formatMinorUnits', () => {
  it('adds without floating-point error', () => {
    // `0.1 + 0.2` is `0.30000000000000004`. Integer minor units cannot drift.
    expect(formatMinorUnits(addMinorUnits(10, 20))).toBe('0.30');
  });

  it('pads a value below one major unit', () => {
    expect(formatMinorUnits(5)).toBe('0.05');
  });

  it('keeps the sign on a negative value', () => {
    expect(formatMinorUnits(-1250)).toBe('-12.50');
  });

  it('nets to zero without sign ambiguity', () => {
    // Formatting normalises negative zero to '0.00', so a balance that nets out
    // never renders as '-0.00'.
    expect(formatMinorUnits(addMinorUnits(500, -500))).toBe('0.00');
  });
});

/*
 * ---------------------------------------------------------------------------
 * WHEN THIS PROJECT ADDS Big.js — COPY THIS PATTERN
 * ---------------------------------------------------------------------------
 *
 * `AGENTS.md` mandates Big.js for all monetary and precision arithmetic, never
 * native JS floats. Big.js is an application dependency, chosen and installed by
 * the project — the test harness does not ship it. Add it, and its types,
 * alongside the first `lib/` module that needs it:
 *
 *   pnpm add big.js
 *   pnpm add -D @types/big.js
 *
 * The types are not optional. Big.js ships none of its own, so without
 * `@types/big.js` every `Big` is `any` and `tsc --noEmit` proves nothing about
 * the code where precision matters most.
 *
 * Assert on the STRING, never on the Big instance:
 *
 *   import Big from 'big.js';
 *   import { addMoney } from '@/lib/money';
 *
 *   function expectBig(actual: Big, expected: string, dp = 2): void {
 *     expect(actual.toFixed(dp)).toBe(expected);
 *   }
 *
 *   it('adds without floating-point error', () => {
 *     expectBig(addMoney('0.1', '0.2'), '0.30');
 *   });
 *
 *   it('compares exact values when precision matters more than formatting', () => {
 *     expect(addMoney('0.1', '0.2').eq(new Big('0.3'))).toBe(true);
 *   });
 *
 * Why not compare the instances directly. `toEqual` mostly works, because Big
 * normalises on construction — `Big('1.0')` and `Big('1')` are structurally
 * identical — which is exactly what makes the failures surprising:
 *
 *   1. `Big(0)` and `Big('-0')` differ on their sign field and FAIL `toEqual`,
 *      even though `.eq()` returns true. Money that nets to zero hits this.
 *   2. Big.js defines `toJSON()`, so a FAILING `toEqual` prints the useless
 *      "expected 1 to deeply equal 1" — both sides serialise identically.
 *   3. `toBe` never works, because the instances are distinct objects.
 *   4. A Big cannot be compared to a plain object or to a number — instances
 *      carry an own `constructor` property, so the shapes never match.
 *
 * `toFixed(dp)` is safer than `toString()` for money. Big.js always returns
 * normal notation from `toFixed`, whereas `toString` switches to exponential
 * notation at large and small exponents.
 * ---------------------------------------------------------------------------
 */
