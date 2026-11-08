/**
 * Status line — feeds the script session JSON on stdin, as Claude Code does, and
 * checks the row it prints. Each test gets its own throwaway repository, so the
 * branch, collab.json and CURRENT_STATE.md are whatever the test says.
 *
 * Run: node --test '.claude/hooks/test/*.test.mjs'
 *      (the glob, not the bare folder: Node 24 reads --test arguments as globs)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = join(ROOT, '.claude', 'statusline.mjs');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';

/** A repository on `branch` with the given collab.json and Active phase line. */
function setup(t, { branch = 'main', collab = { protectedBranches: ['main', 'dev'] }, phase } = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'statusline-test-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const root = join(base, 'repo');
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(base, 'gitconfig'), '');

  const env = { ...process.env };
  for (const key of ['NO_COLOR', 'GIT_DIR', 'GIT_WORK_TREE']) delete env[key];
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: join(base, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  });

  const git = (...args) => execFileSync('git', args, { cwd: root, env, stdio: 'ignore' });
  git('init', '-b', 'main');
  git('commit', '--allow-empty', '-m', 'init');
  if (branch !== 'main') git('checkout', '-b', branch);

  if (collab) writeFileSync(join(root, '.claude', 'collab.json'), JSON.stringify(collab));
  if (phase !== undefined) {
    mkdirSync(join(root, 'docs', 'agent_context'), { recursive: true });
    writeFileSync(
      join(root, 'docs', 'agent_context', 'CURRENT_STATE.md'),
      `# Current State\n\n- **Active phase:** ${phase}\n- **Active execution log:** [e.g. log]\n`
    );
  }

  return { base, root, env };
}

/** Runs the script with `payload` on stdin; returns the printed row. */
function run({ root, env }, payload, { colour = false } = {}) {
  const input = typeof payload === 'string' ? payload : JSON.stringify({ cwd: root, ...payload });
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: root,
    input,
    env: colour ? env : { ...env, NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout.trimEnd();
}

const window = (tokens, size = 1_000_000) => ({
  context_window: {
    total_input_tokens: tokens,
    context_window_size: size,
    used_percentage: Math.round((tokens / size) * 100),
  },
});

test('a ticket branch shows its name and issue number, with no warning', (t) => {
  const repo = setup(t, { branch: 'ste/123-booking-form' });
  const row = run(repo, window(50_000));
  assert.equal(row, 'ste/123-booking-form | #123 | ctx 50K/1M');
});

test('a protected branch is marked, in red, and has no issue number', (t) => {
  const repo = setup(t, { branch: 'main' });
  assert.equal(run(repo, window(50_000)), 'main (protected) | ctx 50K/1M');
  assert.ok(run(repo, window(50_000), { colour: true }).includes(`${RED}main (protected)`));

  const dev = setup(t, { branch: 'dev' });
  assert.match(run(dev, {}), /^dev \(protected\)$/);
});

test('protected branches come from collab.json, with main as the fallback', (t) => {
  const release = setup(t, { branch: 'release', collab: { protectedBranches: [], releaseBranch: 'release' } });
  assert.equal(run(release, {}), 'release (protected)');

  const noConfig = setup(t, { branch: 'main', collab: null });
  assert.equal(run(noConfig, {}), 'main (protected)');
});

test('a linked worktree and a subfolder show their own branch', (t) => {
  const repo = setup(t, { branch: 'main' });
  const tree = join(repo.base, 'tree');
  execFileSync('git', ['worktree', 'add', '-b', 'ste/88-worktree', tree], {
    cwd: repo.root,
    env: repo.env,
    stdio: 'ignore',
  });
  mkdirSync(join(tree, '.claude'));
  writeFileSync(join(tree, '.claude', 'collab.json'), JSON.stringify({ protectedBranches: ['main'] }));
  mkdirSync(join(tree, 'docs'));
  assert.equal(run({ root: join(tree, 'docs'), env: repo.env }, {}), 'ste/88-worktree | #88');
});

test('a detached HEAD says so', (t) => {
  const repo = setup(t, { branch: 'main' });
  execFileSync('git', ['checkout', '--detach'], { cwd: repo.root, env: repo.env, stdio: 'ignore' });
  assert.equal(run(repo, {}), 'detached HEAD');
});

test('an ad-hoc branch has no issue number', (t) => {
  const repo = setup(t, { branch: 'ste/fix-session-refresh' });
  assert.equal(run(repo, {}), 'ste/fix-session-refresh');
});

test('the issue number follows the branch pattern in collab.json', (t) => {
  const repo = setup(t, { branch: 'task-45/booking', collab: { branchPattern: 'task-{task}/{slug}' } });
  assert.equal(run(repo, {}), 'task-45/booking | #45');
});

test('the active phase shows once it is filled in, and not while it is a placeholder', (t) => {
  const filled = setup(t, { branch: 'ste/7-login', phase: 'Phase B — Core flows' });
  assert.equal(run(filled, {}), 'ste/7-login | #7 | Phase B — Core flows');

  const placeholder = setup(t, {
    branch: 'ste/7-login',
    phase: '[e.g. Phase A — Foundation — must match the milestone title exactly]',
  });
  assert.equal(run(placeholder, {}), 'ste/7-login | #7');
});

test('below the checkpoint, context use is green with no marker', (t) => {
  const repo = setup(t, { branch: 'ste/1-a' });
  const row = run(repo, window(199_999), { colour: true });
  assert.ok(row.includes(`${GREEN}ctx 199K/1M`), row);
  assert.doesNotMatch(row, /checkpoint|hand off/);
});

test('at the checkpoint, context use turns yellow and says so', (t) => {
  const repo = setup(t, { branch: 'ste/1-a' });
  const row = run(repo, window(200_000), { colour: true });
  assert.ok(row.includes(`${YELLOW}ctx 200K/1M checkpoint`), row);
  assert.match(run(repo, window(399_999)), /ctx 399K\/1M checkpoint$/);
});

test('at the handoff threshold, context use turns red and says so', (t) => {
  const repo = setup(t, { branch: 'ste/1-a' });
  const row = run(repo, window(400_000), { colour: true });
  assert.ok(row.includes(`${RED}ctx 400K/1M hand off`), row);
  assert.match(run(repo, window(1_000_000)), /ctx 1M\/1M hand off$/);
});

test('the thresholds match the ones HANDOFF.md writes down', (t) => {
  const doc = readFileSync(join(ROOT, 'docs', 'general_docs', 'HANDOFF.md'), 'utf8');
  const threshold = (name) => {
    const match = doc.match(new RegExp(String.raw`^\| ${name} \| ([\d,]+) \|`, 'm'));
    assert.ok(match, `HANDOFF.md has no ${name} row in its Context thresholds table`);
    return Number(match[1].replaceAll(',', ''));
  };
  const checkpoint = threshold('Checkpoint');
  const handoff = threshold('Handoff');
  assert.ok(checkpoint < handoff, 'the checkpoint comes before the handoff');

  // Read the behaviour, not the source: each marker appears exactly at its value.
  const repo = setup(t, { branch: 'ste/1-a' });
  const size = handoff * 2;
  assert.doesNotMatch(run(repo, window(checkpoint - 1, size)), /checkpoint|hand off/);
  assert.match(run(repo, window(checkpoint, size)), / checkpoint$/);
  assert.match(run(repo, window(handoff - 1, size)), / checkpoint$/);
  assert.match(run(repo, window(handoff, size)), / hand off$/);
});

test('thresholds are in tokens, so a smaller window reaches them at a higher percentage', (t) => {
  const repo = setup(t, { branch: 'ste/1-a' });
  assert.equal(run(repo, window(150_000, 200_000)), 'ste/1-a | #1 | ctx 150K/200K');
});

test('missing context fields drop or fall back, never fail', (t) => {
  const repo = setup(t, { branch: 'ste/1-a' });

  // No context_window at all: the segment is left out.
  assert.equal(run(repo, {}), 'ste/1-a | #1');

  // Early in a session: nulls and a zero total.
  assert.equal(
    run(repo, {
      context_window: {
        total_input_tokens: 0,
        context_window_size: 1_000_000,
        used_percentage: null,
        current_usage: null,
      },
    }),
    'ste/1-a | #1 | ctx 0K/1M'
  );

  // No total: the last call's input tokens, without its output.
  assert.equal(
    run(repo, {
      context_window: {
        current_usage: {
          input_tokens: 2,
          cache_creation_input_tokens: 10_000,
          cache_read_input_tokens: 240_000,
          output_tokens: 99_000,
        },
      },
    }),
    'ste/1-a | #1 | ctx 250K checkpoint'
  );

  // Only a percentage and the window size.
  assert.equal(
    run(repo, { context_window: { used_percentage: 45, context_window_size: 1_000_000 } }),
    'ste/1-a | #1 | ctx 450K/1M hand off'
  );
});

test('outside a git repository, or with no usable input, it still exits cleanly', (t) => {
  const { base, env } = setup(t);
  const outside = join(base, 'not-a-repo');
  mkdirSync(outside);
  assert.equal(run({ root: outside, env }, window(10_000)), 'ctx 10K/1M');
  assert.equal(run({ root: outside, env }, 'not json'), '');
  assert.equal(run({ root: outside, env }, ''), '');
});

test('settings.json runs the status line with node from the project root', () => {
  const settings = JSON.parse(readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const { statusLine } = settings;
  assert.equal(statusLine?.type, 'command');
  // Shell form is all statusLine supports. ${CLAUDE_PROJECT_DIR} in double quotes
  // works in both shells Claude Code uses: Git Bash and sh expand the variable, and
  // Claude Code rewrites it to ${env:CLAUDE_PROJECT_DIR} for PowerShell.
  assert.equal(statusLine.command, 'node "${CLAUDE_PROJECT_DIR}/.claude/statusline.mjs"');

  // From a subfolder, with the placeholder resolved, it runs the shipped script.
  const script = statusLine.command.match(/^node "(.+)"$/)[1].replaceAll('${CLAUDE_PROJECT_DIR}', ROOT);
  const result = spawnSync(process.execPath, [script], {
    cwd: join(ROOT, 'docs'),
    input: JSON.stringify({ cwd: join(ROOT, 'docs'), ...window(10_000) }),
    env: { ...process.env, NO_COLOR: '1' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ctx 10K\/1M\n$/);
});
