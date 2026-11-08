/**
 * Branch guard — drives the hook as Claude Code does: a JSON payload on stdin,
 * PreToolUse for the decision, `record` for PostToolUse. Each test gets its own
 * throwaway repository, its own temp folder for approval markers and a fake
 * session id, so nothing leaks between tests or into a real session.
 *
 * Run: node --test '.claude/hooks/test/*.test.mjs'
 *      (the glob, not the bare folder: Node 24 reads --test arguments as globs)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'branch-guard.mjs');

/** A protected-branch repo with the hook's world isolated under one temp folder. */
function setup(t, { branch = 'main', collab = {} } = {}) {
  // realpath: on macOS the temp folder sits behind a symlink, and git reports
  // the resolved path, which would make every in-repo file look outside the repo.
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'branch-guard-test-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const root = join(base, 'repo');
  const markers = join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(markers);
  writeFileSync(join(base, 'gitconfig'), '');

  const env = { ...process.env };
  for (const key of ['COLLAB_GUARD', 'COLLAB_GUARD_MODE', 'GIT_DIR', 'GIT_WORK_TREE']) {
    delete env[key];
  }
  Object.assign(env, {
    // The marker lives under os.tmpdir(), which reads these per platform.
    TMPDIR: markers,
    TEMP: markers,
    TMP: markers,
    // Keep the developer's own git config (signing, hooks) out of the fixture.
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

  const writeCollab = (overrides) =>
    writeFileSync(
      join(root, '.claude', 'collab.json'),
      JSON.stringify({ protectedBranches: ['main'], guardMode: 'ask', ...overrides })
    );
  mkdirSync(join(root, '.claude'));
  writeCollab(collab);

  const run = (args, event, filePath, sessionId, cwd = root) => {
    const payload = {
      session_id: sessionId,
      cwd,
      hook_event_name: event,
      tool_name: 'Write',
      tool_input: { file_path: filePath, content: 'x' },
    };
    const result = spawnSync(process.execPath, [HOOK, ...args], {
      cwd,
      input: JSON.stringify(payload),
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim()
      ? JSON.parse(result.stdout).hookSpecificOutput.permissionDecision
      : 'allow';
  };

  return {
    base,
    markers,
    root,
    outside: join(base, 'scratchpad', 'notes.md'),
    inRepo: (rel) => join(root, ...rel.split('/')),
    writeCollab,
    /** PreToolUse — returns 'allow', 'ask' or 'deny'. */
    before: (filePath, sessionId = 'test-session', cwd = root) =>
      run([], 'PreToolUse', filePath, sessionId, cwd),
    /** PostToolUse — the write went through. */
    after: (filePath, sessionId = 'test-session') =>
      run(['record'], 'PostToolUse', filePath, sessionId),
  };
}

test('a write outside the repository does not switch off the prompt', (t) => {
  const guard = setup(t);

  assert.equal(guard.before(guard.outside), 'allow');
  guard.after(guard.outside);

  assert.equal(guard.before(guard.inRepo('app/page.tsx')), 'ask');
});

test('a write to an allowOnIntegration path does not switch off the prompt', (t) => {
  const guard = setup(t, { collab: { allowOnIntegration: ['.tasks/**'] } });
  const allowed = guard.inRepo('.tasks/notes.md');

  assert.equal(guard.before(allowed), 'allow');
  guard.after(allowed);

  assert.equal(guard.before(guard.inRepo('app/page.tsx')), 'ask');
});

test('in ask mode, one approval covers the rest of the session on that branch', (t) => {
  const guard = setup(t);

  assert.equal(guard.before(guard.inRepo('app/page.tsx')), 'ask');
  guard.after(guard.inRepo('app/page.tsx'));

  assert.equal(guard.before(guard.inRepo('app/layout.tsx')), 'allow');
  assert.equal(guard.before(guard.inRepo('lib/utils.ts')), 'allow');
  // The approval belongs to this session only.
  assert.equal(guard.before(guard.inRepo('lib/utils.ts'), 'another-session'), 'ask');
});

test('in block mode, every in-repo write is denied whatever was approved earlier', (t) => {
  const guard = setup(t);

  // Approved while the guard was asking, then switched to block mid-session.
  guard.after(guard.inRepo('app/page.tsx'));
  assert.equal(guard.before(guard.inRepo('app/layout.tsx')), 'allow');
  guard.writeCollab({ guardMode: 'block' });

  assert.equal(guard.before(guard.inRepo('app/page.tsx')), 'deny');
  guard.after(guard.inRepo('app/page.tsx'));
  assert.equal(guard.before(guard.inRepo('lib/utils.ts')), 'deny');
});

test('a session working in a subfolder is still asked', (t) => {
  const guard = setup(t);
  const docs = guard.inRepo('docs');
  mkdirSync(docs);

  assert.equal(guard.before(join(docs, 'guide.md'), 'test-session', docs), 'ask');
});

test('writes on a contributor branch are never gated', (t) => {
  for (const guardMode of ['ask', 'block']) {
    const guard = setup(t, { branch: 'test/1-contributor', collab: { guardMode } });

    assert.equal(guard.before(guard.inRepo('app/page.tsx')), 'allow', guardMode);
    assert.equal(guard.before(guard.inRepo('lib/utils.ts')), 'allow', guardMode);
  }
});

/**
 * A link at `path` pointing at the folder `target`: a directory junction on
 * Windows, which needs no admin rights, and a directory symlink elsewhere.
 * Returns false when the platform will not create one.
 */
function link(target, path) {
  try {
    symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch {
    return false;
  }
}

/** Windows' 8.3 short form of an existing path, read-only. Null when there is none. */
function shortName(path) {
  if (process.platform !== 'win32') return null;
  const result = spawnSync('cmd', ['/d', '/s', '/c', `"for %I in ("${path}") do @echo %~sI"`], {
    encoding: 'utf8',
    windowsVerbatimArguments: true,
  });
  const short = result.status === 0 ? result.stdout.trim() : '';
  return short && short !== path ? short : null;
}

test('a write reached through a symlink or junction into the repository is gated', (t) => {
  const guard = setup(t);
  mkdirSync(guard.inRepo('app'));
  writeFileSync(guard.inRepo('app/page.tsx'), 'x');
  const alias = join(guard.base, 'alias');
  if (!link(guard.root, alias)) return t.skip('this platform would not create a junction or symlink');

  assert.equal(guard.before(join(alias, 'app', 'page.tsx')), 'ask');
});

test('a write through a junction inside the repository that leads outside it is gated', (t) => {
  // Git for Windows walks into a junction and commits what is behind it, so a
  // write there changes the protected branch even though its real path is outside.
  const guard = setup(t);
  const shared = join(guard.base, 'shared');
  mkdirSync(shared);
  if (!link(shared, guard.inRepo('shared'))) return t.skip('this platform would not create a junction or symlink');

  assert.equal(guard.before(guard.inRepo('shared/notes.md')), 'ask');
});

test('a write reached through another spelling of the repository path is gated', async (t) => {
  await t.test('different letter case', (t) => {
    if (process.platform !== 'win32') return t.skip('paths are case-sensitive here');
    const guard = setup(t);
    mkdirSync(guard.inRepo('app'));
    writeFileSync(guard.inRepo('app/page.tsx'), 'x');
    const respelt = guard.root === guard.root.toUpperCase()
      ? guard.root.toLowerCase()
      : guard.root.toUpperCase();

    assert.equal(guard.before(join(respelt, 'app', 'page.tsx')), 'ask');
  });

  await t.test('an 8.3 short name', (t) => {
    if (process.platform !== 'win32') return t.skip('8.3 short names exist only on Windows');
    const guard = setup(t);
    mkdirSync(guard.inRepo('app'));
    writeFileSync(guard.inRepo('app/page.tsx'), 'x');
    const short = shortName(guard.root);
    if (!short) return t.skip('no 8.3 short name here: short names may be disabled on this volume');

    assert.equal(guard.before(join(short, 'app', 'page.tsx')), 'ask');
  });
});

test('a new file is judged by its nearest existing parent folder', (t) => {
  const guard = setup(t);
  mkdirSync(guard.inRepo('app'));
  const alias = join(guard.base, 'alias');
  if (!link(guard.root, alias)) return t.skip('this platform would not create a junction or symlink');
  const target = join(alias, 'app', 'new', 'page.tsx');
  assert.equal(existsSync(target), false);

  assert.equal(guard.before(target), 'ask');
});

test('a write outside the repository is never gated and never counts as an approval', (t) => {
  const guard = setup(t);
  mkdirSync(join(guard.base, 'scratchpad'));
  const alias = join(guard.base, 'alias');
  const linked = link(guard.base, alias);

  const outsides = [guard.outside];
  if (linked) outsides.push(join(alias, 'scratchpad', 'notes.md'));
  for (const outside of outsides) {
    assert.equal(guard.before(outside), 'allow', outside);
    guard.after(outside);
  }

  const markers = join(guard.markers, 'claude-branch-guard');
  assert.deepEqual(existsSync(markers) ? readdirSync(markers) : [], []);
  assert.equal(guard.before(guard.inRepo('app/page.tsx')), 'ask');
});
