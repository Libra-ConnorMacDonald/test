/**
 * Hook wiring — checks .claude/settings.json the way Claude Code runs it: every
 * handler in exec form with an absolute ${CLAUDE_PROJECT_DIR} path, so it still
 * starts after the session has moved into a subfolder and needs no shell (Git
 * Bash or PowerShell). Also checks each hook reports its own failure instead of
 * passing silently.
 *
 * Run: node --test '.claude/hooks/test/*.test.mjs'
 *      (the glob, not the bare folder: Node 24 reads --test arguments as globs)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SUBFOLDER = join(ROOT, 'docs');
const settings = JSON.parse(readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8'));

/** Every command handler, with the event and matcher it sits under. */
const handlers = Object.entries(settings.hooks ?? {}).flatMap(([event, groups]) =>
  groups.flatMap(({ matcher, hooks }) => hooks.map((hook) => ({ event, matcher, hook })))
);

const runsScript = (name) => ({ hook }) => hook.args?.[0]?.endsWith(`/.claude/hooks/${name}`);
const label = ({ event, matcher, hook }) =>
  `${event} ${matcher}${hook.if ? ` if ${hook.if}` : ''} ${hook.args?.slice(1).join(' ') ?? ''}`.trim();

/** Runs a handler as Claude Code would: placeholder substituted, no shell, given cwd. */
function runHandler(hook, payload, { cwd = SUBFOLDER, env = {} } = {}) {
  const args = hook.args.map((arg) => arg.replaceAll('${CLAUDE_PROJECT_DIR}', ROOT));
  return spawnSync(hook.command, args, {
    cwd,
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, ...env },
    encoding: 'utf8',
  });
}

test('every hook handler runs node in exec form from the project root', () => {
  assert.ok(handlers.length > 0, 'settings.json wires no hooks');
  for (const handler of handlers) {
    const { hook } = handler;
    assert.equal(hook.command, 'node', label(handler));
    assert.ok(Array.isArray(hook.args), `${label(handler)}: no args, so it would run through a shell`);
    assert.match(hook.args[0], /^\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/[\w-]+\.mjs$/, label(handler));
  }
});

test('both hooks run when the session is in a subfolder', (t) => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'hook-wiring-test-')));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const env = { TMPDIR: scratch, TEMP: scratch, TMP: scratch };

  const guard = handlers.filter(runsScript('branch-guard.mjs'));
  const gate = handlers.filter(runsScript('security-gate.mjs'));
  assert.ok(guard.length > 0, 'branch-guard is not wired');
  assert.ok(gate.length > 0, 'security-gate is not wired');

  // Payloads chosen so the outcome is the same on any branch: a write outside
  // the repository, and a git command the gate does not care about.
  for (const handler of guard) {
    const result = runHandler(handler.hook, {
      session_id: 'hook-wiring-test',
      cwd: SUBFOLDER,
      hook_event_name: handler.event,
      tool_name: 'Write',
      tool_input: { file_path: join(scratch, 'notes.md'), content: 'x' },
    }, { env });
    assert.equal(result.status, 0, `${label(handler)}: ${result.stderr}`);
    assert.equal(result.stderr, '', label(handler));
  }
  for (const handler of gate) {
    const result = runHandler(handler.hook, {
      cwd: SUBFOLDER,
      hook_event_name: handler.event,
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    }, { env });
    assert.equal(result.status, 0, `${label(handler)}: ${result.stderr}`);
    assert.equal(result.stderr, '', label(handler));
  }
});

test('the security gate is filtered to git and gh commands only', () => {
  const filters = handlers.filter(runsScript('security-gate.mjs')).map(({ hook }) => hook.if);
  // Any git or gh anywhere in the command, so the filter is never narrower than
  // what the gate looks for: bash -c 'git push', env git push, git.exe push,
  // $(which git) push and "C:\...\git.exe" push all reach it.
  assert.deepEqual(
    [...filters].sort(),
    ['Bash(*gh*)', 'Bash(*git*)', 'PowerShell(*gh*)', 'PowerShell(*git*)']
  );
});

test('the security gate gives up well before its hook times out', () => {
  // A hook that times out lets the command through, so the gate's own budget must
  // run out first, with room for Node to start and print the deny.
  const source = readFileSync(join(ROOT, '.claude', 'hooks', 'security-gate.mjs'), 'utf8');
  const budget = Number(source.match(/^const BUDGET = (\d+)/m)?.[1]);
  assert.ok(budget > 0, 'no BUDGET constant in security-gate.mjs');
  for (const handler of handlers.filter(runsScript('security-gate.mjs'))) {
    assert.ok(
      handler.hook.timeout * 1000 >= budget + 5000,
      `${label(handler)}: timeout ${handler.hook.timeout} s against a ${budget} ms budget`
    );
  }
});

test('allowing git fetch never allows it to run an upload-pack command', () => {
  // git fetch --upload-pack=<cmd> runs <cmd>, and git accepts any unambiguous
  // abbreviation down to --upl, so the deny rules match that prefix.
  const { allow = [], deny = [] } = settings.permissions ?? {};
  for (const tool of ['Bash', 'PowerShell']) {
    if (!allow.some((rule) => rule.startsWith(`${tool}(git fetch`))) continue;
    assert.ok(deny.includes(`${tool}(git fetch *--upl*)`), `${tool}: git fetch is allowed without the --upload-pack deny rule`);
  }
});

test('a hook that cannot read its input fails visibly but does not block', () => {
  for (const name of ['branch-guard.mjs', 'security-gate.mjs']) {
    const handler = handlers.find(runsScript(name));
    const result = runHandler(handler.hook, 'not json');
    // Exit 1 is Claude Code's non-blocking hook error; exit 2 would block.
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, new RegExp(`^${name.replace('.mjs', '')} failed`), name);
  }
});
