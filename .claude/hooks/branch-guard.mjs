#!/usr/bin/env node
/**
 * Branch guard — PreToolUse and PostToolUse hook.
 *
 * Keeps work off protected branches without standing in the way of someone who
 * has a good reason to be there. On the first file write on a protected branch it
 * asks; once the developer says yes, the rest of that session on that branch runs
 * without further prompting. Written in Node rather than shell so it behaves
 * identically on Windows, macOS and Linux.
 *
 * Usage — both wired in .claude/settings.json:
 *   branch-guard.mjs           PreToolUse  — decides
 *   branch-guard.mjs record    PostToolUse — remembers a yes
 *
 * Configuration: .claude/collab.json — see docs/general_docs/COLLABORATION.md.
 *
 * Never blocks the session on its own account. No git or no config allows the
 * write quietly; an unexpected error goes to stderr with exit 1, which Claude
 * Code shows as a hook error without blocking the write.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, relative, isAbsolute, sep, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);

const DEFAULTS = {
  enabled: true,
  guardMode: 'ask',
  integrationBranch: 'main',
  releaseBranch: 'main',
  protectedBranches: ['main'],
  branchPattern: '{user}/{task}-{slug}',
  allowOnIntegration: [],
};

const allow = () => null;

function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    })
  );
  return null;
}

/** Throws on unreadable or malformed input — Claude Code always sends a JSON payload. */
function readPayload() {
  return JSON.parse(readFileSync(0, 'utf8'));
}

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Minimal glob matcher — supports `**`, `*` and `?`. Enough for path allowlists
 * without pulling a dependency into a hook that runs on every write.
 */
function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

const slug = (value) =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Where a session's approval for a branch is remembered. Outside the repository
 * on purpose — an approval is a property of this session, not of the code, and
 * must never end up in a commit.
 */
function approvalMarker(sessionId, branch) {
  return join(
    tmpdir(),
    'claude-branch-guard',
    `${slug(sessionId) || 'session'}--${slug(branch) || 'branch'}.ok`
  );
}

/**
 * Everything both entry points need to know: which branch, whether it is
 * protected, and the resolved config. Returns null when there is nothing to do.
 */
function inspect(payload) {
  const cwd = payload.cwd ?? process.cwd();

  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], cwd);
  } catch {
    return null; // Not a git repository — nothing to protect.
  }

  let config = { ...DEFAULTS };
  try {
    const raw = readFileSync(join(root, '.claude', 'collab.json'), 'utf8');
    config = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // No config yet — fall back to protecting main only.
  }

  if (config.enabled === false) return null;
  if (process.env.COLLAB_GUARD === 'off') return null;

  let branch;
  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  } catch {
    return null;
  }
  // Detached HEAD — not a branch anyone merges into, and not our problem.
  if (!branch || branch === 'HEAD') return null;

  const protectedBranches = new Set(
    [
      ...(config.protectedBranches ?? []),
      config.integrationBranch,
      config.releaseBranch,
    ].filter(Boolean)
  );
  if (!protectedBranches.has(branch)) return null;

  return { cwd, root, config, branch };
}

/**
 * Where a path really lands, with symlinks, junctions, `subst` drives, 8.3 short
 * names and letter case resolved. A write often targets a file that does not
 * exist yet, so resolve the nearest existing ancestor and append the rest.
 */
function realPath(path) {
  const rest = [];
  let current = path;
  for (;;) {
    try {
      return join(realpathSync.native(current), ...rest);
    } catch {
      const parent = dirname(current);
      if (parent === current) return path;
      rest.unshift(basename(current));
      current = parent;
    }
  }
}

/** The path of `target` relative to `root`, or null when it lies outside it. */
function inside(root, target) {
  const rel = relative(root, target);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? null : rel;
}

/**
 * Whether the guard has a say over this write. Writes outside the repo (plan
 * files, auto-memory, the scratchpad) and `allowOnIntegration` paths are never
 * gated, so they must never count as an approval either.
 */
function isGated(payload, { cwd, root, config }) {
  const filePath = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
  if (!filePath) return true;

  // Inside if either view says so. The real path catches an alias of the repository
  // (symlink, junction, subst drive, 8.3 name, letter case); the path as written
  // catches a junction inside the repository that leads outside it, whose files Git
  // for Windows still lists and commits. Match allowOnIntegration on the path as
  // written when it is inside, since that is the path Git reports.
  const target = resolve(cwd, filePath);
  const rel = inside(root, target) ?? inside(realPath(root), realPath(target));
  if (rel === null) return false;

  const posixRel = rel.split(sep).join('/');
  return !(config.allowOnIntegration ?? []).some((pattern) =>
    globToRegExp(pattern).test(posixRel)
  );
}

/** PostToolUse: the write happened, so the developer allowed it. Remember that. */
function record(payload) {
  if (!WRITE_TOOLS.has(payload.tool_name ?? '')) return allow();

  const context = inspect(payload);
  if (!context || !isGated(payload, context)) return allow();

  try {
    const marker = approvalMarker(payload.session_id ?? '', context.branch);
    mkdirSync(join(tmpdir(), 'claude-branch-guard'), { recursive: true });
    writeFileSync(marker, `${context.branch}\n`);
  } catch {
    // Losing the marker only costs another prompt.
  }
  return allow();
}

/** PreToolUse: allow, ask, or deny. */
function check(payload) {
  if (!WRITE_TOOLS.has(payload.tool_name ?? '')) return allow();

  const context = inspect(payload);
  if (!context || !isGated(payload, context)) return allow();

  const { cwd, config, branch } = context;
  const mode = process.env.COLLAB_GUARD_MODE || config.guardMode || 'ask';

  // Already approved for this branch in this session — do not ask again. Block
  // mode has nothing to approve, so an earlier marker never opens it.
  if (mode !== 'block') {
    try {
      if (existsSync(approvalMarker(payload.session_id ?? '', branch))) return allow();
    } catch {
      /* fall through to asking */
    }
  }

  let user = 'work';
  try {
    user = slug(git(['config', 'user.name'], cwd)) || 'work';
  } catch {
    /* keep the default */
  }
  const example = (config.branchPattern ?? DEFAULTS.branchPattern)
    .replace('{user}', user)
    .replace('{task}', '123')
    .replace('{slug}', 'short-description');

  const cut =
    `git checkout ${config.integrationBranch} && git pull --ff-only && ` +
    `git checkout -b ${example}`;

  if (mode === 'block') {
    return decide(
      'deny',
      `'${branch}' is a protected branch and the guard is in block mode. ` +
        `Cut a contributor branch, then retry:\n  ${cut}\n` +
        `See docs/general_docs/COLLABORATION.md. Do not disable the guard to get ` +
        `past this — tell the developer if you believe the block is wrong.`
    );
  }

  return decide(
    'ask',
    `About to edit files on '${branch}', which is a protected branch ` +
      `(integration: '${config.integrationBranch}', release: '${config.releaseBranch}').\n\n` +
      `Approve to keep working here — the rest of this session on '${branch}' will ` +
      `not ask again. Decline if this should go on its own branch:\n  ${cut}\n\n` +
      `Branch naming and the merge-back route: docs/general_docs/COLLABORATION.md`
  );
}

try {
  const payload = readPayload();
  if (process.argv[2] === 'record') record(payload);
  else check(payload);
} catch (err) {
  // Visible but not blocking: exit 1 is a non-blocking hook error.
  process.stderr.write(`branch-guard failed, so it did not check this write: ${err?.message ?? err}\n`);
  process.exit(1);
}
process.exit(0);
