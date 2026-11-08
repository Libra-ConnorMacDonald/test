/**
 * Security gate — drives the hook as Claude Code does, with a PreToolUse payload on
 * stdin, against a throwaway repository that has a local bare remote. Each test
 * builds its own repository, so nothing touches a real one.
 *
 * Run: node --test '.claude/hooks/test/*.test.mjs'
 *      (the glob, not the bare folder: Node 24 reads --test arguments as globs)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'security-gate.mjs');

/** A clone with an upstream, everything pushed, git config isolated from the developer's. */
function setup(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'security-gate-test-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  writeFileSync(join(base, 'gitconfig'), '');

  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'CLAUDE_PROJECT_DIR']) delete env[key];
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: join(base, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  });

  const remote = join(base, 'remote.git');
  const repo = join(base, 'repo');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, stdio: 'ignore' });
  git(base, 'init', '--bare', '-b', 'main', remote);
  git(base, 'clone', remote, repo);
  git(repo, 'commit', '--allow-empty', '-m', 'init');
  git(repo, 'push', '-u', 'origin', 'main');
  git(repo, 'remote', 'set-head', 'origin', 'main');

  /** Writes a file and commits it, without pushing. */
  const commit = (cwd, file) => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), `${Math.random()}\n`);
    git(cwd, 'add', file);
    git(cwd, 'commit', '-m', `change ${file}`);
  };

  /** Records a review of HEAD (or `rev`) the way the agent does. */
  const review = (cwd = repo, rev) => {
    const result = spawnSync(process.execPath, [HOOK, 'reviewed', ...(rev ? [rev] : [])], { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };

  /** Runs the hook; returns 'allow' or 'deny', and never accepts 'ask'. */
  const gate = (command, { cwd = repo, tool = 'Bash' } = {}) => {
    const result = spawnSync(process.execPath, [HOOK], {
      cwd,
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command }, cwd }),
      env: { ...env, CLAUDE_PROJECT_DIR: repo },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    if (!result.stdout.trim()) return 'allow';
    const { permissionDecision, permissionDecisionReason } = JSON.parse(result.stdout).hookSpecificOutput;
    assert.notEqual(permissionDecision, 'ask', 'the gate must never ask the developer');
    gate.reason = permissionDecisionReason;
    return permissionDecision;
  };

  return { base, repo, git, commit, review, gate };
}

test('a reviewed and recorded code push goes through with no prompt', (t) => {
  const { repo, commit, review, gate } = setup(t);
  commit(repo, 'lib/session.ts');
  review();
  assert.equal(gate('git push'), 'allow');
});

test('a code push with no recorded review is denied, telling the agent what to run', (t) => {
  const { repo, commit, gate } = setup(t);
  commit(repo, 'lib/session.ts');
  assert.equal(gate('git push'), 'deny');
  assert.match(gate.reason, /\/security-review/);
  assert.match(gate.reason, /reviewed/);
  assert.match(gate.reason, /lib\/session\.ts/);
});

test('a docs-only commit after a recorded review needs no fresh review', (t) => {
  const { repo, commit, review, gate } = setup(t);
  commit(repo, 'lib/session.ts');
  review();
  commit(repo, 'docs/notes.md');
  assert.equal(gate('git push'), 'allow');
});

test('a new code commit after a recorded review needs a fresh one', (t) => {
  const { repo, commit, review, gate } = setup(t);
  commit(repo, 'lib/session.ts');
  review();
  commit(repo, 'lib/auth.ts');
  assert.equal(gate('git push'), 'deny');
  review();
  assert.equal(gate('git push'), 'allow');
});

test('in-scope paths include proxy.ts and Claude\'s own config', (t) => {
  for (const file of ['proxy.ts', '.claude/hooks/branch-guard.mjs', '.claude/settings.json', '.mcp.json']) {
    const { repo, commit, gate } = setup(t);
    commit(repo, file);
    assert.equal(gate('git push'), 'deny', file);
  }
});

test('docs-only and test-only pushes pass straight through', (t) => {
  const { repo, commit, gate } = setup(t);
  commit(repo, 'README.md');
  commit(repo, 'docs/general_docs/GUIDE.md');
  commit(repo, 'tests/unit/session.test.ts');
  commit(repo, 'e2e/specs/login.spec.ts');
  assert.equal(gate('git push'), 'allow');
});

test('every plain push form is judged the same way', (t) => {
  const { repo, commit, review, gate } = setup(t);
  const forms = ['git push', 'git push origin', 'git push origin main', 'git push -u origin HEAD',
    'git -C . push', 'git.exe push --force-with-lease origin main', 'git push origin main 2>&1'];

  commit(repo, 'docs/guide.md');
  for (const command of forms) assert.equal(gate(command), 'allow', command);
  commit(repo, 'lib/session.ts');
  for (const command of forms) assert.equal(gate(command), 'deny', command);
  review();
  for (const command of forms) assert.equal(gate(command), 'allow', command);
});

test('a push or merge in any other form is denied, even with nothing to send', (t) => {
  const { gate } = setup(t);
  const others = [
    // more than one command: whatever runs first can change what is sent
    "echo x > lib/y.ts && git add -A && git commit -m 'x' && git push",
    'git push; echo done', 'git push && git push', 'cd .. && git push', 'pnpm add left-pad && git push',
    // options and refspecs that send more, or elsewhere
    'git --no-pager push', 'git -c push.default=matching push', 'git --git-dir=../x/.git push',
    'GIT_DIR=../x/.git git push', 'git push --all origin', 'git push --tags', 'git push --mirror origin',
    'git push -o ci.skip origin', 'git push origin main:main', 'git push origin +main', 'git push --force',
    'git push origin stash@{0}', 'git push https://example.com/r.git main',
    // wrapped or quoted
    "bash -c 'git push'", 'git "push"', 'git pu\\sh', 'xargs git push', '& git push',
    'git -C "a b" -c "user.name=A B" push', 'git subtree push --prefix=lib origin x',
    'git merge -m "bring it in" feature', 'git pull && git merge origin/main',
    'gh pr merge 7 --auto', 'gh pr merge 7 --admin', 'gh -R o/r pr merge 7', 'gh "pr" merge 7',
    'GH pr merge 7', 'GH_REPO=o/r gh pr merge 7', 'gh pr merge 7 <(git push)', 'gh pr merge #12 13 --merge',
    // git or gh named by full path or through a command
    '& "C:\\Program Files\\Git\\cmd\\git.exe" push', '$(which git) push', "'git' push",
    // a subcommand built at run time could be a push or merge
    'git $OPTS push origin main', 'git $(echo push)', 'git `echo push`', 'git ${SUB:-push}', 'git @splat',
    'git -C . $SUB', 'git "$SUB"', 'git pu?h', 'git p*h', 'git --attr-source x $SUB', 'gh $SUB 7',
    'gh pr $ACTION 7', 'gh -R o/r pr $ACTION 7', 'gh pr mer[g]e 7', 'git "`echo push`"', 'gh pr "`echo merge`" 7',
    'git pu`sh', 'git pu`echo sh`', 'gh pr mer`echo ge` 7', 'git "pu`echo sh`"',
    "echo '`'; git pu\"`echo sh`\"", 'echo \\`; git pu"`echo sh`"',
    // a redirection before the subcommand leaves it a push
    'git >/dev/null push origin main', 'git 2>&1 push', 'git -C . >log push', 'gh pr >/dev/null merge 7',
    'git &>/dev/null push', 'git 2>x merge feature', 'gh >x pr merge 7', 'git>/dev/null push',
    'git&>/dev/null push', 'gh>x pr merge 7', 'gh pr>x merge 7',
    // other ways git sends commits somewhere
    'git send-pack ../x.git main', 'git http-push https://example.com/r.git main', 'git svn dcommit', 'git p4 submit',
  ];
  for (const command of others) {
    assert.equal(gate(command), 'deny', command);
    assert.match(gate.reason, /command on its own/, command);
  }
});

test('a push or merge that is only mentioned is not one', (t) => {
  const { gate } = setup(t);
  for (const command of ['git log --oneline --merges', 'git branch --merged', 'git merge-base HEAD main',
    'git config push.default', 'git stash push -m wip', 'git commit -m "push the fix, then merge"',
    'gh pr view 7 --json mergeable', 'gh pr list --state merged',
    // expansions in arguments and option values are fine: only the subcommand must be literal
    'git -C "$(git rev-parse --show-toplevel)" status', 'git -C $HOME/x log --format=%H', 'gh pr view $N',
    'git "status"', 'git status;', 'git --version', 'git log -1 --grep "needs git 2.45, (git) or gh 2.94"',
    'gh --version | head -1', 'git --version && git status', 'git --no-pager log -1 > out.txt']) {
    assert.equal(gate(command), 'allow', command);
  }
});

test('a push from a worktree is judged on that worktree\'s commits and reviews', (t) => {
  const { base, repo, git, commit, review, gate } = setup(t);
  const tree = join(base, 'worktree');
  git(repo, 'worktree', 'add', '-b', 'feature', tree);
  git(tree, 'push', '-u', 'origin', 'feature');

  // Code waits in the worktree, the main checkout is clean: the worktree's push is denied.
  commit(tree, 'app/page.tsx');
  assert.equal(gate('git push', { cwd: tree }), 'deny');
  assert.equal(gate(`git -C "${tree}" push`), 'deny');
  // A review recorded in the worktree is seen from the main checkout too: one shared record.
  review(tree);
  assert.equal(gate(`git -C "${tree}" push`), 'allow');

  // Docs wait in the worktree, unreviewed code waits in the main checkout: the worktree's push passes.
  git(tree, 'push');
  commit(tree, 'docs/notes.md');
  commit(repo, 'lib/auth.ts');
  assert.equal(gate('git push', { cwd: tree }), 'allow');
  assert.equal(gate('git push origin main', { cwd: tree }), 'deny');
});

test('a new branch is judged from where it left the default branch', (t) => {
  const { repo, git, commit, review, gate } = setup(t);
  git(repo, 'checkout', '-b', 'docs-only');
  commit(repo, 'docs/notes.md');
  assert.equal(gate('git push -u origin docs-only'), 'allow');

  git(repo, 'checkout', '-b', 'code');
  commit(repo, 'lib/session.ts');
  assert.equal(gate('git push -u origin code'), 'deny');
  review();
  assert.equal(gate('git push -u origin code'), 'allow');
  assert.equal(gate('git push origin HEAD'), 'allow');
});

test('each branch a push names is judged, and only those', (t) => {
  const { repo, git, commit, review, gate } = setup(t);
  git(repo, 'checkout', '-b', 'docs-branch');
  commit(repo, 'docs/notes.md');
  git(repo, 'checkout', '-b', 'code-branch');
  commit(repo, 'lib/session.ts');
  git(repo, 'checkout', 'main');
  assert.equal(gate('git push origin docs-branch'), 'allow');
  assert.equal(gate('git push origin docs-branch code-branch'), 'deny');
  review(repo, 'code-branch');
  assert.equal(gate('git push origin docs-branch code-branch'), 'allow');
  // Deleting a branch sends no code.
  assert.equal(gate('git push origin --delete code-branch'), 'allow');
});

test('code already on the remote, outside its shared branches, still counts', (t) => {
  const { base, repo, git, commit, gate } = setup(t);
  const teammate = join(base, 'teammate');
  git(base, 'clone', join(base, 'remote.git'), teammate);
  git(teammate, 'checkout', '-b', 'theirs');
  commit(teammate, 'lib/theirs.ts');
  git(teammate, 'push', '-u', 'origin', 'theirs');

  git(repo, 'fetch');
  assert.equal(gate('git merge origin/theirs'), 'deny');
  git(repo, 'checkout', '-b', 'mine');
  git(repo, 'merge', 'origin/theirs');
  assert.equal(gate('git push -u origin mine'), 'deny');
});

test('a bare push is denied when git config would send more than the current branch', (t) => {
  const { repo, git, gate } = setup(t);
  git(repo, 'config', 'push.default', 'matching');
  assert.equal(gate('git push'), 'deny');
  assert.match(gate.reason, /Name it/);
  assert.equal(gate('git push origin main'), 'allow');
});

test('a merge is judged on what it brings in', (t) => {
  const { repo, git, commit, review, gate } = setup(t);
  git(repo, 'checkout', '-b', 'feature');
  commit(repo, 'lib/session.ts');
  git(repo, 'checkout', 'main');

  assert.equal(gate('git merge feature'), 'deny');
  assert.equal(gate('git merge --no-ff --no-edit origin/main feature'), 'deny');
  review(repo, 'feature');
  assert.equal(gate('git merge --no-ff --no-edit feature'), 'allow');
  // Syncing with what is already on the remote's default branch, or stepping out of a merge.
  assert.equal(gate('git merge origin/main'), 'allow');
  assert.equal(gate('git merge --abort'), 'allow');
});

test('a gh pr merge that gh cannot describe is denied, never asked', (t) => {
  const { gate } = setup(t);
  // The scratch repository has no GitHub remote, so gh pr view fails.
  assert.equal(gate('gh pr merge 1 --merge'), 'deny');
  assert.match(gate.reason, /could not describe/);
});

test('a commit message in a quoted Bash heredoc may mention a push or merge', (t) => {
  const { gate } = setup(t);
  const message = 'why git push and gh pr merge 12 are gated';
  // Data: a quoted heredoc feeding a git or gh message, as a command on its own.
  assert.equal(gate(`git commit -F - <<'EOF'\n${message}\nEOF`), 'allow');
  assert.equal(gate(`git commit -q --file=- <<'EOF'\n${message}\nEOF`), 'allow');
  assert.equal(gate(`gh pr create --title 'Gate' --body-file - <<'EOF'\n${message}\nEOF`), 'allow');
  // Not certainly data.
  for (const command of [
    `git commit -F - <<'EOF'\nnotes\nEOF\ngit push`, // a push after it still counts
    `git commit -F - <<'EOF'\nEOF\ngit push origin main\nEOF`, // Bash ends an empty heredoc at its first line
    `git commit -F - <<-'EOF'\n\tEOF\ngit push origin main\nEOF`,
    `git add -A && git commit -F - <<'EOF'\n${message}\nEOF`, // anything before it could change what git is
    `PATH=/tmp/x git commit -F - <<'EOF'\n${message}\nEOF`,
    `shopt -s expand_aliases\nalias git='sh -s'\ngit commit -F - <<'EOF'\ngit push\nEOF`,
    `git commit -m '${message}'`, // only heredocs are set aside
    `git commit -F - <<EOF\n$(git push)\nEOF`, // an unquoted delimiter expands
    `bash <<'EOF'\ngit push\nEOF`,
    `cat > run.sh <<'EOF'\ngit push\nEOF`,
    `git commit -F - <<'EOF' && sh\ngit push\nEOF`, // something runs after it on its line
    `x="'" git commit -F - <<'EOF'\n$(git push)\nEOF`, // quotes before it that may not balance
    `# it's\ngit commit -F - <<'EOF'\n$(git push)\nEOF`, // a comment before it
    `bash -c "git commit -F - <<'EOF'\n$(git push)\nEOF\n"`,
  ]) assert.equal(gate(command), 'deny', command);
  // PowerShell has no heredocs, so nothing is set aside there.
  assert.equal(gate(`git commit -F - <<'EOF'\n${message}\nEOF`, { tool: 'PowerShell' }), 'deny');
});

test('gh api may read anything but write only to issues, labels and milestones', (t) => {
  const { gate } = setup(t);
  for (const command of [
    'gh api repos/o/r/issues', 'gh api user --jq .login',
    'gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq \'.[].title\'',
    'gh api -X POST repos/o/r/labels -f name=docs',
    'gh api repos/{owner}/{repo}/milestones -f title="Phase A — Foundation"',
    "gh api -X PATCH repos/o/r/issues/12 -f state=closed -f body='Done: see #3'",
  ]) assert.equal(gate(command), 'allow', command);
  for (const command of [
    'gh api -X PUT repos/o/r/pulls/7/merge', 'gh api -X PUT repos/o/r/pulls/7/mer"ge"',
    'gh api -X PUT "repos/o/r/pulls/7/$(echo m)erge"', 'gh "api" -X PUT repos/o/r/pulls/7/merge',
    'GH api -X PUT repos/o/r/pulls/7/merge', 'gh api graphql -f query=@mutation.graphql',
    'gh api -X PUT repos/o/r/pulls/7 --input body.json',
    'gh api -XPUT repos/o/r/contents/lib/session.ts -f content=eA==',
    'gh api -X POST repos/o/r/git/refs -f ref=refs/heads/x',
    "gh api repos/o/r/issues/1/comments -f body='@lib/session.ts'",
    'gh api -X PUT repos/o/r/issues/../pulls/7/merge', 'gh api -X PUT repos/o/r/issues/%2e%2e/pulls/7/merge',
    'gh api -X PUT repos/o/../o/r/pulls/7/merge',
    'gh api repos/o/r/issues/1/comments -f body=x && git push',
  ]) assert.equal(gate(command), 'deny', command);
});

test('aliases set on the command line are refused, since they could push or merge unseen', (t) => {
  const { gate } = setup(t);
  for (const command of ["git -c 'alias.p=!git push' p", 'git -c alias.p=push p origin',
    'git config alias.p push', 'git config --global include.path ../x.cfg', 'GIT_CONFIG_COUNT=1 git p',
    "gh alias set m 'pr merge --admin'"]) {
    assert.equal(gate(command), 'deny', command);
  }
  assert.equal(gate('git log -- lib/include.ts docs/alias.md'), 'allow');
});

test('what the destination has is asked of it, not read from refs on this machine', (t) => {
  const { base, repo, git, commit, gate } = setup(t);
  commit(repo, 'lib/session.ts');
  // A remote-tracking ref pointed at the unreviewed code does not make it pushed.
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.equal(gate('git push origin main'), 'deny');
  // Nor does fetching it from somewhere else under the destination's name.
  const real = join(base, 'remote.git');
  const elsewhere = join(base, 'elsewhere.git');
  git(base, 'init', '--bare', '-b', 'main', elsewhere);
  git(repo, 'push', elsewhere, 'main');
  git(repo, 'remote', 'set-url', 'origin', elsewhere);
  git(repo, 'remote', 'set-url', '--push', 'origin', real);
  git(repo, 'fetch', 'origin');
  assert.equal(gate('git push origin main'), 'deny');
  // A rewrite that sends the ls-remote somewhere other than the push is refused: here the push
  // URL comes from url plus pushInsteadOf, while ls-remote would follow insteadOf elsewhere.
  git(repo, 'remote', 'set-url', 'origin', real);
  git(repo, 'config', '--unset', 'remote.origin.pushurl');
  git(repo, 'config', `url.${elsewhere}.insteadOf`, real);
  git(repo, 'config', `url.${real}.pushInsteadOf`, real);
  assert.equal(gate('git push origin main'), 'deny');
  assert.match(gate.reason, /insteadOf/);
  git(repo, 'config', '--unset', `url.${elsewhere}.insteadOf`);
  git(repo, 'config', '--unset', `url.${real}.pushInsteadOf`);
  // A remote that pushes to several URLs cannot be asked as one.
  git(repo, 'remote', 'set-url', '--add', '--push', 'origin', real);
  git(repo, 'remote', 'set-url', '--add', '--push', 'origin', elsewhere);
  assert.equal(gate('git push origin main'), 'deny');
  assert.match(gate.reason, /several URLs/);
});

test('a destination that has moved on is fetched before the push is judged', (t) => {
  const { base, repo, git, commit, gate } = setup(t);
  const teammate = join(base, 'teammate');
  git(base, 'clone', join(base, 'remote.git'), teammate);
  commit(teammate, 'docs/theirs.md');
  git(teammate, 'push', 'origin', 'main');
  git(repo, 'checkout', '-b', 'notes');
  commit(repo, 'docs/notes.md');
  assert.equal(gate('git push -u origin notes'), 'deny');
  assert.match(gate.reason, /git fetch origin/);
  git(repo, 'fetch', 'origin');
  assert.equal(gate('git push -u origin notes'), 'allow');
});

test('previews and squash merges are plain forms, judged like the rest', (t) => {
  const { repo, git, commit, review, gate } = setup(t);
  git(repo, 'checkout', '-b', 'feature');
  commit(repo, 'lib/session.ts');
  assert.equal(gate('git push --dry-run -u origin feature'), 'deny');
  git(repo, 'checkout', 'main');
  assert.equal(gate('git merge --squash feature'), 'deny');
  review(repo, 'feature');
  assert.equal(gate('git merge --squash feature'), 'allow');
  assert.equal(gate('git push -n --porcelain origin feature'), 'allow');
});

test('a rename that moves code out of scope still counts as code', (t) => {
  const { repo, git, commit, review, gate } = setup(t);
  commit(repo, 'lib/session.ts');
  review();
  git(repo, 'push');
  mkdirSync(join(repo, 'docs'));
  git(repo, 'mv', 'lib/session.ts', 'docs/old-session.md');
  git(repo, 'commit', '-m', 'move it');
  assert.equal(gate('git push'), 'deny');
});

test('a long review record does not slow the gate, and is not duplicated', (t) => {
  const { repo, commit, review, gate } = setup(t);
  const record = join(repo, '.git', 'security-reviewed');
  commit(repo, 'lib/session.ts');
  review();
  review();
  assert.equal(readFileSync(record, 'utf8').trim().split('\n').length, 1);

  const timed = () => {
    const started = Date.now();
    assert.equal(gate('git push'), 'allow');
    return Date.now() - started;
  };
  const one = timed();
  // 500 more records: the time must not grow with them (it once grew by two git calls each).
  const noise = Array.from({ length: 500 }, (_, i) => i.toString(16).padStart(40, 'a')).join('\n');
  writeFileSync(record, `${noise}\n${readFileSync(record, 'utf8')}`);
  const many = timed();
  assert.ok(many < one * 3 + 1000, `501 records took ${many} ms against ${one} ms for one`);
});

test('a long run of git options cannot stall the gate', (t) => {
  const { gate } = setup(t);
  const started = Date.now();
  assert.equal(gate(`git ${'-C '.repeat(2000)}x status`), 'allow');
  assert.ok(Date.now() - started < 5000, 'the gate took longer than 5 seconds');
});

test('a push the gate cannot check in time is denied, never let through', (t) => {
  const { repo, git, commit, gate } = setup(t);
  // A destination that never answers, so git ls-remote hangs until the budget runs out.
  git(repo, 'remote', 'set-url', 'origin', 'ssh://example.invalid/remote.git');
  // The # turns the host and command git appends into a shell comment.
  git(repo, 'config', 'core.sshCommand', 'sleep 60 #');
  commit(repo, 'lib/session.ts');
  const started = Date.now();
  assert.equal(gate('git push'), 'deny');
  const took = Date.now() - started;
  assert.ok(took >= 20000, `denied after ${took} ms, before the budget ran out, so not for lack of time`);
  assert.ok(took < 30000, 'the gate ran past its hook timeout');
});
