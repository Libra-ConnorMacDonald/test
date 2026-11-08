#!/usr/bin/env node
/**
 * Import check: fails unless CLAUDE.md is the import of AGENTS.md and nothing
 * else, so the two files cannot drift apart.
 *
 * Run: node .template/checks/check-claude-import.mjs
 * Paths resolve from this file, so any working directory will do. No
 * dependencies. Exits 0 when the import is in place, or 1 naming what is wrong.
 *
 * CLAUDE.md passes when, once block-level HTML comments and blank lines are
 * removed, the one line left is `@AGENTS.md`. Claude Code strips those comments
 * before loading the file, so a note for maintainers costs nothing and is
 * allowed. Any other text would be an instruction AGENTS.md does not carry.
 *
 * AGENTS.md must exist and hold text. Its content is not checked here: the
 * block Next.js appends to it during `next dev` is expected and never a finding.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (name) => (existsSync(ROOT + name) ? readFileSync(ROOT + name, 'utf8') : null);

const findings = [];
const claude = read('CLAUDE.md');
const agents = read('AGENTS.md');

if (claude === null) {
  findings.push('CLAUDE.md: missing. It must contain the line @AGENTS.md.');
} else {
  const lines = claude
    .replace(/^﻿/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1 || lines[0] !== '@AGENTS.md') {
    findings.push(
      'CLAUDE.md: must hold only the import line @AGENTS.md (HTML comments aside). ' +
        'Move any other text into AGENTS.md.'
    );
  }
}

if (agents === null || !agents.trim()) {
  findings.push('AGENTS.md: missing or empty. CLAUDE.md imports it, so every instruction lives there.');
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('check-claude-import: CLAUDE.md imports AGENTS.md and holds nothing else.');
