#!/usr/bin/env node
/**
 * Status line — the row Claude Code shows below the prompt.
 *
 * Shows the git branch (marked when it is protected), the issue number from the
 * branch name, the active phase from docs/agent_context/CURRENT_STATE.md, and how
 * much of the context window is in use, coloured against the checkpoint and
 * handoff thresholds below. Written in Node so it behaves the same under Git
 * Bash, PowerShell, macOS and Linux.
 *
 * Wired in .claude/settings.json as `statusLine`. Claude Code sends session data
 * as JSON on stdin and shows whatever this prints, after each assistant message.
 *
 * Never fails the status line: a missing field, no git or no config drops that
 * part and shows the rest. It always exits 0, because a non-zero exit blanks
 * the row.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Context thresholds in tokens. docs/general_docs/HANDOFF.md (Context thresholds)
// owns the values and says what each one means; change them there and here
// together. statusline.test.mjs fails if the two disagree.
const CHECKPOINT_TOKENS = 200_000; // commit the work so far
const HANDOFF_TOKENS = 400_000; // hand off to a fresh session

// The same fallbacks as the branch guard, so both agree on what is protected.
const DEFAULTS = {
  integrationBranch: 'main',
  releaseBranch: 'main',
  protectedBranches: ['main'],
  branchPattern: '{user}/{task}-{slug}',
};

const useColour = !process.env.NO_COLOR;
const paint = (code) => (text) => (useColour ? `\x1b[${code}m${text}\x1b[0m` : text);
const red = paint('31');
const yellow = paint('33');
const green = paint('32');
const dim = paint('2');

/** Session data from stdin. Empty when run by hand at a terminal, so it never waits. */
function readPayload() {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(readFileSync(0, 'utf8')) ?? {};
  } catch {
    return {};
  }
}

/**
 * Repository root and branch, read from the git files rather than by running git:
 * this runs after every message, and starting git can take seconds on Windows.
 * Handles a linked worktree, whose `.git` is a file pointing at its git dir.
 * Branch is 'HEAD' when detached. Null outside a repository.
 */
function gitState(cwd) {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const dotGit = join(dir, '.git');
    let stat;
    try {
      stat = statSync(dotGit);
    } catch {
      if (dirname(dir) === dir) return null;
      continue; // No .git here: keep walking up.
    }
    try {
      let gitDir = dotGit;
      if (stat.isFile()) {
        const target = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m)?.[1].trim();
        gitDir = resolve(dir, target);
      }
      const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
      const branch = head.match(/^ref:\s*refs\/heads\/(.+)$/)?.[1] ?? 'HEAD';
      return { root: dir, branch };
    } catch {
      return { root: dir, branch: null }; // A repository, but its HEAD is unreadable.
    }
  }
}

function readConfig(root) {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(join(root, '.claude', 'collab.json'), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function isProtected(branch, config) {
  return [...(config.protectedBranches ?? []), config.integrationBranch, config.releaseBranch]
    .filter(Boolean)
    .includes(branch);
}

/**
 * The issue number in a branch named by `branchPattern`, e.g. 123 in
 * `ste/123-booking-form`. Ad-hoc and hotfix branches have none.
 */
function issueNumber(branch, config) {
  const pattern = config.branchPattern ?? DEFAULTS.branchPattern;
  if (!pattern.includes('{task}')) return null;
  const source = pattern
    .split(/(\{user\}|\{task\}|\{slug\})/)
    .map((part) => {
      if (part === '{user}') return '[^/]+';
      if (part === '{task}') return '(\\d+)';
      if (part === '{slug}') return '.+';
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return branch.match(new RegExp(`^${source}$`))?.[1] ?? null;
}

/** The Active phase line of CURRENT_STATE.md, or null while it is still a [placeholder]. */
function activePhase(root) {
  try {
    const text = readFileSync(join(root, 'docs', 'agent_context', 'CURRENT_STATE.md'), 'utf8');
    const value = text.match(/^\s*-\s*\*\*Active phase:\*\*\s*(.*)$/m)?.[1].trim();
    if (!value || value.startsWith('[')) return null;
    return value.replace(/`/g, '');
  } catch {
    return null;
  }
}

/**
 * Tokens in the context window. Prefers the total Claude Code reports, then the
 * last call's usage, then the percentage. All count input only, which is what
 * fills the window. Null when nothing has been reported yet.
 */
function contextTokens(context) {
  if (!context || typeof context !== 'object') return null;
  const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  const total = number(context.total_input_tokens);
  if (total !== null && total > 0) return total;

  const usage = context.current_usage;
  if (usage && typeof usage === 'object') {
    const sum =
      (number(usage.input_tokens) ?? 0) +
      (number(usage.cache_creation_input_tokens) ?? 0) +
      (number(usage.cache_read_input_tokens) ?? 0);
    if (sum > 0) return sum;
  }

  const percent = number(context.used_percentage);
  const size = number(context.context_window_size);
  if (percent !== null && size !== null) return Math.round((percent / 100) * size);

  return total; // 0 before the first response, or null when absent
}

const kilo = (tokens) =>
  tokens >= 1_000_000 ? `${+(tokens / 1_000_000).toFixed(1)}M` : `${Math.floor(tokens / 1000)}K`;

function contextSegment(context) {
  const tokens = contextTokens(context);
  if (tokens === null) return null;
  const size = typeof context.context_window_size === 'number' ? `/${kilo(context.context_window_size)}` : '';
  const text = `ctx ${kilo(tokens)}${size}`;
  if (tokens >= HANDOFF_TOKENS) return red(`${text} hand off`);
  if (tokens >= CHECKPOINT_TOKENS) return yellow(`${text} checkpoint`);
  return green(text);
}

function render(payload) {
  const segments = [];
  const cwd = payload.workspace?.current_dir ?? payload.cwd ?? process.cwd();
  const git = gitState(cwd);
  const root = git?.root || payload.workspace?.project_dir || cwd;
  const config = readConfig(root);

  if (git?.branch) {
    const { branch } = git;
    if (branch === 'HEAD') segments.push(yellow('detached HEAD'));
    else if (isProtected(branch, config)) segments.push(red(`${branch} (protected)`));
    else segments.push(branch);

    const issue = branch === 'HEAD' ? null : issueNumber(branch, config);
    if (issue) segments.push(`#${issue}`);
  }

  const phase = activePhase(root);
  if (phase) segments.push(phase);

  const context = contextSegment(payload.context_window);
  if (context) segments.push(context);

  return segments.join(dim(' | '));
}

try {
  process.stdout.write(`${render(readPayload())}\n`);
} catch {
  // Something unforeseen: print nothing rather than an error in the status row.
}
process.exit(0);
