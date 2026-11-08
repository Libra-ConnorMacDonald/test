// PreToolUse (Bash | PowerShell): security gate G2 (docs/general_docs/SECURITY.md §4).
//
// Before a push or merge takes code off this machine or into a shared branch, checks that
// /security-review has run on that code. When a review leaves nothing unresolved, the agent
// records the commit it covered:
//
//   node .claude/hooks/security-gate.mjs reviewed [<commit or branch>]     (default: HEAD)
//
// The record lives in the repository's shared git directory, so every worktree sees it and
// it never reaches a commit. A review covers its commit and everything before it.
//
// A push or merge must be a command on its own, in a plain form the gate reads in full:
//
//   git [-C <path>] push [-u|--force-with-lease|--follow-tags|--dry-run|-q|-v] [<remote> [<branch>...]]
//   git [-C <path>] push <remote> --delete <branch>...
//   git [-C <path>] merge [--no-ff|--ff-only|--squash|--no-edit|-q] [<ref>...]  (or --abort, --continue)
//   gh pr merge [<number>] [--merge|--squash|--rebase|--delete-branch]
//
// Anything else that runs a push or merge is denied with these forms, so shell syntax cannot
// hide what is sent. A push is judged on what it names (or HEAD) against what the destination
// itself (asked with git ls-remote) has of its default branch, the integration branch and the
// branch itself; a merge on what it brings in; a pull request on its own commits against the
// base GitHub reports. Any change in G2's scope that no recorded review covers means deny, with
// a reason telling the agent what to run. The developer is never asked. Docs-only and test-only
// work passes. `gh api` may read anything but write only to issues, labels and milestones.
//
// It guards against mistakes, not a determined attempt to get round it: existing git or gh
// aliases, scripts and other terminals are not seen, and the CI review stays the independent
// check. A hook that runs out of time lets the command through (Claude Code from 2.1.295 can
// block instead, with "onFailure": "block"), so the gate denies once it has used 25 seconds.
//
// Never blocks on its own failure: an unexpected error goes to stderr with exit 1, which
// Claude Code shows as a hook error while the command still runs.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Paths in G2's scope (SECURITY.md §4). Keep the two lists in step.
// Add any other code folders (a native app, packages/) here AND in SECURITY.md §4.
const IN_SCOPE = [
  /^(app|lib|components|db|worker|scripts|\.github)\//,
  /^\.claude\//, // hooks, permissions, skills and their scripts all steer what runs locally
  /^\.mcp\.json$/,
  /^middleware\.ts$/,
  /^proxy\.ts$/, // middleware.ts was renamed proxy.ts in Next.js 16
  /^next\.config\./,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^vercel\.json$/,
  /^public\/sw/,
]
const inScope = (file) => IN_SCOPE.some((re) => re.test(file))

const SELF = fileURLToPath(import.meta.url)
const G2 = 'Security gate G2 (docs/general_docs/SECURITY.md §4):'
const lines = (text) => (text ?? '').split('\n').map((s) => s.trim()).filter(Boolean)

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }))
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Asking git, within a time budget

const STARTED = Date.now()
const BUDGET = 25000 // well inside the hook's 30 s timeout, which would let the command through

/** stdout of a command, or null when it fails. Running out of budget is a deny, never a pass. */
function run(file, args, cwd) {
  const left = BUDGET - (Date.now() - STARTED)
  if (left < 500) deny(`${G2} the gate ran out of time checking this, so it is not allowed through. Retry it.`)
  try {
    return execFileSync(file, args, { cwd, encoding: 'utf8', timeout: left, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
const git = (args, cwd) => run('git', args, cwd)
const commitOf = (rev, cwd) => git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`], cwd) || null
const isName = (value) => typeof value === 'string' && /^[\w./-]+$/.test(value)

function recordFile(cwd) {
  const dir = git(['rev-parse', '--git-common-dir'], cwd)
  if (!dir) throw new Error(`${cwd} is not inside a git repository`)
  return join(resolve(cwd, dir), 'security-reviewed')
}

/** Recorded reviews, newest last; only full hashes, and only recent ones (older ones are pushed). */
function reviewed(cwd) {
  try {
    return lines(readFileSync(recordFile(cwd), 'utf8')).filter((sha) => /^[0-9a-f]{40,64}$/.test(sha)).slice(-200)
  } catch {
    return []
  }
}

/** The shared branch work lands on (.claude/collab.json), default main. */
function integrationBranch(cwd) {
  try {
    const top = git(['rev-parse', '--show-toplevel'], cwd)
    const name = JSON.parse(readFileSync(join(top, '.claude', 'collab.json'), 'utf8')).integrationBranch
    return isName(name) ? name : 'main'
  } catch {
    return 'main'
  }
}

const example = (files) => ` (${files.length} code file${files.length === 1 ? '' : 's'}, e.g. ${files[0]})`
const howTo = (rev) =>
  `Run /security-review on it. If it leaves nothing unresolved, record the review with ` +
  `\`node "${SELF}" reviewed${rev ? ` ${rev}` : ''}\`, then retry.`

/**
 * Denies unless every in-scope file touched by commits in `head`, and in none of `exclude`, is
 * covered by a recorded review. Renames show their old path too, and merges show what their
 * resolution changed. Every revision is a hash or a full ref name, so none can read as an option;
 * `head` and `exclude` are resolved commits, so --ignore-missing only skips reviews since pruned.
 */
function judge(head, exclude, cwd, what, rev) {
  const log = git(['log', '--no-renames', '--name-only', '--format=', '--diff-merges=dense-combined',
    '--ignore-missing', head, '--not', ...exclude, ...reviewed(cwd)], cwd)
  if (log === null) deny(`${G2} git could not list the commits ${what}, so it is not allowed through.`)
  const files = [...new Set(lines(log).filter(inScope))]
  if (files.length) deny(`${G2} ${what} code with no recorded security review${example(files)}. ${howTo(rev)}`)
}

// ---------------------------------------------------------------------------
// The three commands that may push or merge

const folder = (dir, session) => (dir ? resolve(session, dir.replace(/^"(.*)"$/s, '$1')) : session)
const words = (text) => text.trim().split(/[ \t]+/).filter(Boolean)

/**
 * What the push destination itself has of its default branch, the integration branch and
 * `branch`, asked of the URL the push goes to. Local refs/remotes are not trusted: anything on
 * this machine can rewrite them, and they may not even come from that URL.
 */
function remoteHas(remote, branch, cwd) {
  const urls = lines(git(['remote', 'get-url', '--push', '--all', remote], cwd))
  if (urls.length !== 1 || urls[0].startsWith('-')) {
    deny(`${G2} \`${remote}\` pushes to ${urls.length > 1 ? 'several URLs' : 'no URL the gate can read'}, so this push cannot be checked.`)
  }
  // ls-remote applies insteadOf rewrites of its own; it must reach the URL the push goes to.
  if (git(['ls-remote', '--get-url', urls[0]], cwd) !== urls[0]) {
    deny(`${G2} a url.*.insteadOf rule sends \`${remote}\`'s push URL elsewhere when asked what it has, so this push cannot be checked.`)
  }
  const wanted = new Set(['HEAD', ...[integrationBranch(cwd), branch].filter(Boolean).map((name) => `refs/heads/${name}`)])
  const listing = git(['ls-remote', urls[0], ...wanted], cwd)
  if (listing === null) deny(`${G2} could not ask \`${remote}\` what it already has, so this push cannot be checked.`)
  const commits = lines(listing).map((line) => line.split('\t')).filter(([, ref]) => wanted.has(ref)).map(([sha]) => sha)
  if (commits.some((sha) => !/^[0-9a-f]{40,64}$/.test(sha) || !commitOf(sha, cwd))) {
    deny(`${G2} \`${remote}\` has commits not fetched here. Run \`git fetch ${remote}\`, then retry.`)
  }
  return commits
}

/** git push: each ref named (or HEAD) against what the destination already has. */
function checkPush(dir, args, session) {
  if (args.includes('-d') || args.includes('--delete')) return // deleting a branch sends no code
  const cwd = folder(dir, session)
  const [named, ...refs] = args.filter((arg) => !arg.startsWith('-'))
  const current = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd)
  const config = (...keys) => git(['config', ...keys], cwd)
  // Where git sends it when no remote is named.
  const remote = named ?? (current && config('--get', `branch.${current}.pushRemote`)) ??
    config('--get', 'remote.pushDefault') ?? (current && config('--get', `branch.${current}.remote`)) ?? 'origin'
  if (!lines(git(['remote'], cwd)).includes(remote)) {
    deny(`${G2} \`${remote}\` is not a remote here. Push as \`git push <remote> <branch>\`.`)
  }
  if (!refs.length && (config('--get', 'push.default') === 'matching' || config('--get-all', `remote.${remote}.push`) ||
    config('--type=bool', '--get', `remote.${remote}.mirror`) === 'true')) {
    deny(`${G2} this repository's git config pushes more than the current branch. Name it: \`git push ${remote} <branch>\`.`)
  }
  for (const ref of refs.length ? refs : ['HEAD']) {
    const head = commitOf(ref, cwd)
    if (!head) deny(`${G2} \`${ref}\` is not a commit here, so this push cannot be checked.`)
    judge(head, remoteHas(remote, ref === 'HEAD' ? current : ref, cwd), cwd, 'this push carries', refs.length ? ref : '')
  }
}

/**
 * git merge: what each ref brings in that HEAD and the shared branches do not have. A merge stays
 * on this machine, so local refs serve here; the push that would take it anywhere asks the remote.
 */
function checkMerge(dir, args, session) {
  if (args.some((arg) => ['--abort', '--continue', '--quit'].includes(arg))) return
  const cwd = folder(dir, session)
  const refs = args.filter((arg) => !arg.startsWith('-'))
  const has = ['HEAD', ...['HEAD', integrationBranch(cwd)].map((branch) => `refs/remotes/origin/${branch}`)]
    .filter((r) => commitOf(r, cwd))
  for (const ref of refs.length ? refs : ['@{upstream}']) {
    const head = commitOf(ref, cwd)
    if (!head) deny(`${G2} \`${ref}\` is not a commit here, so this merge cannot be checked.`)
    judge(head, has, cwd, 'this merge brings in', ref)
  }
}

/** gh pr merge: the pull request's own commits against its base, both as GitHub reports them. */
function checkPrMerge(args, cwd) {
  const numbers = args.filter((arg) => /^\d+$/.test(arg))
  if (numbers.length > 1) deny(`${G2} merge one pull request at a time.`)
  let pr = null
  try {
    pr = JSON.parse(run('gh', ['pr', 'view', ...numbers, '--json', 'number,headRefOid,baseRefOid,baseRefName'], cwd))
  } catch {}
  const isSha = (value) => /^[0-9a-f]{40,64}$/.test(String(value))
  if (!Number.isInteger(pr?.number) || !isSha(pr.headRefOid) || !isSha(pr.baseRefOid) || !isName(pr.baseRefName)) {
    deny(`${G2} gh could not describe this pull request, so its changes cannot be checked.`)
  }
  if (!commitOf(pr.headRefOid, cwd) || !commitOf(pr.baseRefOid, cwd)) {
    deny(`${G2} pull request #${pr.number}'s commits are not all fetched here. Run ` +
      `\`git fetch origin ${pr.baseRefName} pull/${pr.number}/head\`, then retry.`)
  }
  judge(pr.headRefOid, [pr.baseRefOid], cwd, `pull request #${pr.number} carries`, pr.headRefOid)
}

// ---------------------------------------------------------------------------
// Reading the command

// The plain forms. Every word is literal in Bash and PowerShell alike: no quotes, expansions,
// separators or refspec colons, and no ref can start with a dash. A quoted -C path may hold
// spaces and backslashes, but nothing that expands.
const REF = String.raw`[A-Za-z0-9_][\w./-]*`
const DIR = String.raw`(?:"(?:[^"$\`\\\n]|\\(?![\\"\n]))*"|[\w./:-]+)`
const AT = String.raw`^git(?:\.exe)?(?:[ \t]+-C[ \t]+(${DIR}))?[ \t]+`
const TAIL = String.raw`(?:[ \t]+2>&1)?$`
const PUSH = new RegExp(String.raw`${AT}push((?:[ \t]+(?:-u|--set-upstream|-q|--quiet|-v|--verbose|-n|--dry-run|--porcelain|--force-with-lease|--follow-tags|-d|--delete|${REF}))*)${TAIL}`)
const MERGE = new RegExp(String.raw`${AT}merge((?:[ \t]+(?:--no-ff|--ff-only|--ff|--squash|--no-edit|-q|--quiet|--abort|--continue|--quit|${REF}))*)${TAIL}`)
const PR_MERGE = new RegExp(String.raw`^gh(?:\.exe)?[ \t]+pr[ \t]+merge((?:[ \t]+(?:\d+|--merge|--squash|--rebase|--delete-branch|-[msrd]))*)${TAIL}`)

// Where git or gh is told to push or merge: after git and its options, or gh pr and its options.
// Checked in the command as written, with quotes, backslashes and backticks dropped, with each
// quoted or escaped string as one word, and with quotes dropped and every backtick as $ (never
// part of a literal word, since pairing backticks up is easily thrown), so quoting cannot hide one.
const VALUE = String.raw`(?:\$\([^)]*\)|\x60[^\x60]*\x60|\S)+`
const OPTIONS = String.raw`(?:\s+-\S*(?:\s+(?!-)${VALUE})?)*` // any option, with or without a value
const AFTER = String.raw`(?:\.exe)?[\x22\x27\x60)]*` // "C:\…\git.exe" push, $(which git) push
const RUNS = [
  new RegExp(String.raw`\bgit${AFTER}${OPTIONS}\s+(?:(?:subtree\s+)?(?:push|merge)|send-pack|http-push|svn\s+dcommit|p4\s+submit)\b(?![-.\w])`, 'i'),
  new RegExp(String.raw`\bgh${AFTER}${OPTIONS}\s+pr${OPTIONS}\s+merge\b(?![-.\w])`, 'i'),
]
// A git or gh subcommand that is not a literal word ($X, $(…), backticks, %X%, @splat, a glob)
// could be a push or merge, so it counts as one. Checked once quotes are dropped or collapsed.
// A shell operator or the end of the line there means no subcommand at all (gh --version | head);
// a redirection does not, since Bash runs git >/dev/null push, and git>/dev/null push, as a push.
const GIT_VALUED = String.raw`-[Cc]|--(?:git-dir|work-tree|namespace|config-env|exec-path|attr-source|super-prefix)`
const GIT_OPTIONS = String.raw`(?:\s+(?:${GIT_VALUED})\s+${VALUE}|\s+(?!(?:${GIT_VALUED})\s)-\S*)*`
const GH_OPTIONS = String.raw`(?:\s+(?:-R|--repo)\s+${VALUE}|\s+(?!(?:-R|--repo)\s)-\S*)*`
const NOT_LITERAL = String.raw`(?:[ \t]+|(?=[<>]|&>))(?![-|;)#]|&(?!>))(?![\w.,:+=/-]+(?=[\s;&|)]|$))\S`
const BUILT = [
  new RegExp(String.raw`\bgit${AFTER}${GIT_OPTIONS}${NOT_LITERAL}`, 'i'),
  new RegExp(String.raw`\bgh${AFTER}${GH_OPTIONS}(?:\s+pr${GH_OPTIONS})?${NOT_LITERAL}`, 'i'),
]
// A git alias or included config set on the command line, or a gh alias, could run either unseen.
const ALIASES = new RegExp([
  String.raw`\b(?:alias\.[^\s=]+|include(?:if\.[^\s=]+)?\.path)\s*=`, // -c, --config-env
  String.raw`\bconfig\s+(?:-\S+\s+)*(?:alias|include|includeif)\.`, // git config
  String.raw`\bGIT_CONFIG_\w*\s*=`,
  String.raw`\bgh(?:\.exe)?\s+alias\s+(?:set|import)\b`,
].join('|'), 'i')

// Bash only: a heredoc with a quoted delimiter (nothing in it expands) that feeds a git or gh
// message is data. It is set aside only when that command starts the whole command (nothing
// before it can change what git or gh is), its arguments are plain words and single-quoted
// strings, so the << is certainly a heredoc, and nothing follows it on its line.
const CHUNK = String.raw`(?:[\w \t./:=@,+%-]|'[^'\n]*')*`
const SINK = String.raw`[ \t]*(?:git(?:\.exe)?[ \t]+(?:commit|tag)\b${CHUNK}[ \t](?:-F|--file)|` +
  String.raw`gh(?:\.exe)?[ \t]+(?:pr|issue|release)[ \t]+[\w-]+${CHUNK}[ \t](?:-F|--body-file|--notes-file))(?:=|[ \t]+)-[ \t]*`
// The body is optional and lazy (??): Bash ends the heredoc at the first terminator line, even
// the very next one, so the strip must never run on past it.
const MESSAGE = new RegExp(String.raw`^(${SINK}<<-?[ \t]*(['"])([\w-]+)\2)[ \t]*\n(?:[\s\S]*?\n)??[ \t]*\3[ \t]*(?=\n|$)`)

// gh api: reads pass; writes only to endpoints that hold no code and merge nothing.
const GH_API = /\bgh(?:\.exe)?\s+api\b[^\n]*/gi
const GH_API_WRITES = /(?:^|\s)-[A-Za-z]*[XfF]|--(?:method|field|raw-field|input)\b/
const FIELD = String.raw`(?:-X\s+(?:POST|PATCH|PUT|DELETE)|-[fF]\s+[\w.\[\]-]+=(?:'(?!@)[^']*'|"(?!@)[^"$\`\\]*"|[\w.:/,-]*))`
// Path segments never start with a dot and are never %-encoded, so `..` cannot climb out.
const SEGMENT = String.raw`(?!\.)[\w.-]+`
const GH_API_ALLOWED = new RegExp(String.raw`^gh(?:\.exe)?\s+api(?:\s+${FIELD})*\s+\/?repos\/(?:${SEGMENT}|\{owner\})\/` +
  String.raw`(?:${SEGMENT}|\{repo\})\/(?:issues|labels|milestones)(?:\/${SEGMENT})*(?:\s+${FIELD})*$`, 'i')

const FORMS = 'a push or merge must be a command on its own, in a plain form the gate can read in full: ' +
  '`git push [-u] [<remote> [<branch>]]`, `git push <remote> --delete <branch>`, `git merge [--no-ff] <ref>` or ' +
  '`gh pr merge [<number>] --merge`, each optionally with `git -C <path>`. Run anything else as a separate ' +
  'command, and name git and gh subcommands literally. If this only mentions them, in a commit message say, ' +
  'write the text to a file and pass that (`git commit -F <file>`, `--body-file <file>`), or in Bash use a ' +
  "quoted heredoc as a command on its own (`git commit -F - <<'EOF'`)."

try {
  if (process.argv[2] === 'reviewed') {
    const sha = commitOf(process.argv[3] ?? 'HEAD', process.cwd())
    if (!sha) throw new Error(`${process.argv[3] ?? 'HEAD'} is not a commit here`)
    if (!reviewed(process.cwd()).includes(sha)) appendFileSync(recordFile(process.cwd()), `${sha}\n`)
    process.stdout.write(`security-gate: recorded the review of ${sha.slice(0, 7)} and everything before it\n`)
    process.exit(0)
  }

  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  const payload = JSON.parse(raw)
  const original = payload?.tool_input?.command ?? ''
  const command = payload.tool_name === 'Bash' ? original.replace(MESSAGE, '$1') : original
  const session = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const views = [command, command.replace(/['"\\`]/g, ''), command.replace(/'[^']*'|"[^"]*"|\\[\s\S]/g, 'Q'),
    command.replace(/['"]/g, '').replace(/`/g, '$')]

  const calls = (text) => [...text.matchAll(GH_API)].map(([call]) => call.trim())
  const seen = calls(command)
  if (views.some((view) => calls(view).length > seen.length) ||
    seen.some((call) => GH_API_WRITES.test(call) && !GH_API_ALLOWED.test(call))) {
    deny(`${G2} this \`gh api\` call writes somewhere the gate does not allow, or in a form it cannot read. ` +
      'It may write to issues, labels and milestones, with plain or quoted -f values. Push and merge with ' +
      '`git push` and `gh pr merge <number> --merge` instead.')
  }
  if (views.some((view) => ALIASES.test(view))) {
    deny(`${G2} this sets a git alias, included config or gh alias, which could push or merge where the ` +
      'gate cannot see it. Run the command it stands for directly.')
  }
  if (!views.some((view) => RUNS.some((re) => re.test(view))) &&
    !views.slice(1).some((view) => BUILT.some((re) => re.test(view)))) process.exit(0)

  const whole = command.trim()
  let form
  if ((form = PUSH.exec(whole))) checkPush(form[1], words(form[2]), session)
  else if ((form = MERGE.exec(whole))) checkMerge(form[1], words(form[2]), session)
  else if ((form = PR_MERGE.exec(whole))) checkPrMerge(words(form[1]), session)
  else deny(`${G2} ${FORMS}`)
} catch (err) {
  // never block a command because the gate itself failed, but never fail silently either
  process.stderr.write(`security-gate failed, so it did not check this command: ${err?.message ?? err}\n`)
  process.exit(1)
}
process.exit(0)
