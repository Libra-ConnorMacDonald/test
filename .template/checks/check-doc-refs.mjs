#!/usr/bin/env node
/**
 * Reference check: fails when a Markdown file in the template points at a file,
 * a heading or a numbered section that does not exist.
 *
 * Run: node .template/checks/check-doc-refs.mjs
 * Paths resolve from this file, so any working directory will do. No
 * dependencies. Exits 0 when every reference resolves, or 1 with one line per
 * finding naming the file, the line, the reference and what is wrong with it.
 *
 * Which files: every Markdown file git tracks or would track (so a new file is
 * checked before it is committed), skills and prompt files included. Fenced code
 * blocks are skipped: they hold commands, entry templates and examples, which
 * name files a project creates later.
 *
 * What counts as a reference:
 * 1. Paths in backticks. A span is read as a repo path when it has no spaces and
 *    either starts with a top-level entry of the repository (`docs/...`,
 *    `.claude/...`) or has a slash and a file extension. Bare Markdown file names
 *    such as `SECURITY.md` are looked up by name anywhere in the repository.
 *    Other bare names (`package.json`, `auth.ts`) are too ambiguous to check.
 *    A path resolves against the repository root, the file's own folder, or the
 *    skill folder it sits in, so a skill can say `scripts/planner-prompt.md`.
 *    Paths written without backticks are checked too when they start with a
 *    top-level folder of the repository, such as docs/general_docs/SECURITY.md.
 * 2. Markdown links to local files, resolved against the file's folder, and the
 *    #anchor on any of them, checked against the target's headings using
 *    GitHub's anchor rules.
 * 3. Numbered sections: `§4` or `§5.1` after a Markdown file name, such as
 *    `SECURITY.md` §4, needs a heading numbered 4 or 5.1 in that file. A § with
 *    no file name right before it may refer to the last Markdown file named
 *    earlier on the same line or to the file it appears in (if that file numbers
 *    its headings), and passes when either has the section.
 * 4. Named steps: "Section 7 of ONBOARDING.md", "`ONBOARDING.md`, Section 10b"
 *    or "Step 0" next to a file name needs a heading in that file carrying the
 *    same word and number.
 * 5. Named sections: a backticked Markdown file followed by a capitalised title
 *    in brackets or quotes, such as `AGENTS.md` (Collaborative working) or
 *    `CLOSE_OUT.md`, "Changing AGENTS.md", needs a heading with that title,
 *    ignoring case and punctuation.
 *
 * What is never a finding:
 * - Placeholders: anything holding [x], <n>, {task}, a glob star or an ellipsis.
 * - URLs, absolute paths and home-relative paths.
 * - Paths that exist only in a project made from the template, listed in
 *   PROJECT_ONLY below. Keep that list short and say why each entry is there.
 *   The one exception: a named helper in e2e/support/ ships in the harness, so
 *   it must exist under templates/testing/.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join, normalize, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ---------------------------------------------------------------------------
// Paths that only exist once a project is built from the template

/**
 * Each entry matches a repo-relative path from its start. A trailing slash
 * covers everything below that folder. Bare file names such as package.json
 * are never checked (see rule 1), so they need no entry here.
 */
const PROJECT_ONLY = [
  // The application itself, laid out as in ENGINEERING_STANDARDS.md, File Structure.
  // app/ ships as the starter, but the docs name files a project adds there.
  'app/', 'components/', 'lib/', 'db/', 'public/', 'node_modules/',
  // The test harness, copied from templates/testing/ by the Phase A setup task.
  'tests/', 'e2e/', '.github/workflows/test.yml',
  // Run output and working folders, all gitignored.
  '.tasks/', 'test-results/', 'playwright-report/', 'blob-report/',
  // One per ticket when tickets run side by side (COLLABORATION.md, Parallel work).
  '.claude/worktrees/',
  // Project subagents, added when a role in TOOLKIT.md's routing table gets its own file.
  '.claude/agents/',
  // Written by the journey-export skill.
  'docs/project_docs/exports/',
];

/** Created by onboarding, one per phase. EXECUTION_LOG.md and the bug-fix log ship. */
const PHASE_LOG = /^(?:docs\/agent_context\/)?EXECUTION_LOG_(?!BUGFIX\.md$)[A-Z0-9]+\.md$/;

const isProjectOnly = (path) =>
  PHASE_LOG.test(path) ||
  PROJECT_ONLY.some((entry) => path.startsWith(entry) || `${path}/` === entry);

/** File names used as examples of a convention, not as references. */
const EXAMPLE_NAMES = new Set(['SCREAMING_SNAKE_CASE.md']);

// ---------------------------------------------------------------------------
// The files

function listFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('.claude/worktrees/') && existsSync(join(ROOT, line)));
}

const FILES = listFiles();
const MARKDOWN = FILES.filter((file) => file.endsWith('.md'));
const TOP_LEVEL = new Set(FILES.map((file) => file.split('/')[0]));
const TOP_DIRS = [...new Set(FILES.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))];
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A path in plain prose that starts with a top-level folder, not inside a URL or a longer path. */
const PLAIN_PATH = new RegExp(`(?<![\\w/.:-])((?:${TOP_DIRS.map(escape).join('|')})/[\\w./-]*)`, 'g');
const BY_NAME = new Map();
for (const file of FILES) {
  const name = basename(file);
  BY_NAME.set(name, [...(BY_NAME.get(name) ?? []), file]);
}

const exists = (path) => existsSync(join(ROOT, path));
const isFile = (path) => exists(path) && statSync(join(ROOT, path)).isFile();

// ---------------------------------------------------------------------------
// Reading a Markdown file

/** Lines outside fenced code blocks, with inline code still in place. */
function proseLines(text) {
  const lines = [];
  let fence = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(raw)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^\s*[`~]+\s*$/.test(raw)) fence = null;
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }
    lines.push({ n: i + 1, text: raw });
  });
  return lines;
}

const headingCache = new Map();

/** Every heading in a file: its text, and its GitHub anchor. */
function headings(file) {
  if (headingCache.has(file)) return headingCache.get(file);
  const seen = new Map();
  const list = proseLines(readFileSync(join(ROOT, file), 'utf8'))
    .map((line) => /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line.text)?.[1])
    .filter((title) => title !== undefined)
    .map((title) => {
      const base = slug(title);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { title, anchor: count ? `${base}-${count}` : base };
    });
  headingCache.set(file, list);
  return list;
}

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces to hyphens. */
function slug(title) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

// ---------------------------------------------------------------------------
// Resolving a path

const PLACEHOLDER = /[[\]<>{}*]|\.\.\.|…|YYYY/;

/** The skill folder a file sits in, such as .claude/skills/test-author, or null. */
function skillDir(file) {
  return /^(\.claude\/skills\/[^/]+)\//.exec(file)?.[1] ?? null;
}

/** The repo-relative path a reference points at, or null when nothing matches. */
function resolve(ref, from) {
  const clean = ref.replace(/\/$/, '');
  const bases = ['', posix.dirname(from), skillDir(from)].filter((base) => base !== null);
  for (const base of bases) {
    const path = normalize(posix.join(base, clean)).replace(/\\/g, '/');
    if (!path.startsWith('..') && exists(path)) return path;
  }
  return null;
}

/** A Markdown file named by a reference: a path, or a bare name found anywhere. */
function markdownTargets(ref, from) {
  if (!ref.includes('/')) return BY_NAME.get(ref) ?? [];
  const path = resolve(ref, from);
  return path && isFile(path) ? [path] : [];
}

// ---------------------------------------------------------------------------
// The checks

const findings = [];
const report = (file, n, ref, message) => findings.push(`${file}:${n}: ${ref}: ${message}`);

/** Is this backticked span meant as a path in the repository? */
function looksLikePath(span) {
  if (/\s/.test(span) || PLACEHOLDER.test(span)) return false;
  if (/^(?:[a-z]+:|\/|~|@|-)/i.test(span)) return false; // URLs, absolute, home, packages, flags
  const first = span.split('/')[0];
  if (span.includes('/') && TOP_LEVEL.has(first)) return true;
  if (span.includes('/') && /\.[a-z]{1,5}$/i.test(span)) return true;
  // Bare names: only the template's own upper-case document names, such as
  // SECURITY.md. Lower-case ones (summary.md, task.md) are run output or are
  // named relative to something the sentence already gave.
  return /^[A-Z0-9_]+\.md$/.test(span) && !EXAMPLE_NAMES.has(span);
}

function checkPath(file, n, raw) {
  const ref = raw.replace(/[#:].*$/, '').replace(/[.,;]$/, '');
  if (!ref) return;
  // The shared test helpers ship in the harness, so a named one must exist there.
  if (/^e2e\/support\/[^/]+\.\w+$/.test(ref)) {
    if (!exists(`templates/testing/${ref}`)) report(file, n, raw, 'no such helper in templates/testing/');
    return;
  }
  if (isProjectOnly(ref)) return;
  if (!ref.includes('/')) {
    if (!BY_NAME.has(ref)) report(file, n, raw, 'no file by this name in the repository');
    return;
  }
  if (!resolve(ref, file)) report(file, n, raw, 'path does not exist');
}

function checkLink(file, n, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return; // external
  const [rawPath, anchor] = target.split('#');
  const path = decodeURI(rawPath);
  let resolved = file;
  if (path) {
    if (PLACEHOLDER.test(path)) return;
    const joined = normalize(posix.join(posix.dirname(file), path)).replace(/\\/g, '/');
    if (isProjectOnly(joined)) return;
    if (joined.startsWith('..') || !exists(joined)) {
      report(file, n, `(${target})`, 'link target does not exist');
      return;
    }
    resolved = joined;
  }
  if (anchor && resolved.endsWith('.md') && !headings(resolved).some((h) => h.anchor === anchor.toLowerCase())) {
    report(file, n, `(${target})`, `no heading in ${resolved} has the anchor #${anchor}`);
  }
}

const NUMBERED = (number) => new RegExp(`^${number.replace('.', '\\.')}(?:[.\\s]|$)`);

function checkSection(file, n, number, targets, label) {
  if (!targets.length) return; // the path check reports a missing file
  const found = targets.some((target) => headings(target).some((h) => NUMBERED(number).test(h.title)));
  if (!found) report(file, n, label, `no heading numbered ${number} in ${targets.join(' or ')}`);
}

function checkNamedStep(file, n, word, number, targets, label) {
  if (!targets.length) return;
  const pattern = new RegExp(`\\b${word}\\s+${number}\\b`, 'i');
  const found = targets.some((target) => headings(target).some((h) => pattern.test(h.title)));
  if (!found) report(file, n, label, `no heading "${word} ${number}" in ${targets.join(' or ')}`);
}

const words = (text) => slug(text).replace(/[-_]+/g, ' ').trim();

function checkNamedSection(file, n, title, targets, label) {
  if (!targets.length) return;
  const want = words(title);
  const found = targets.some((target) =>
    headings(target).some((h) => words(h.title).includes(want))
  );
  if (!found) report(file, n, label, `no heading "${title}" in ${targets.join(' or ')}`);
}

/** A Markdown file name, backticked or not, as it appears in prose. */
const MD_NAME = '`?((?:[\\w.-]+\\/)*[\\w.-]+\\.md)`?';
const SECTION_AFTER_FILE = new RegExp(`${MD_NAME},?\\s+\\(?((?:§\\s?\\d+(?:\\.\\d+)?(?:\\s*(?:[-\\u2013,]|and|or|to)\\s*)?)+)`, 'g');
const STEP_AFTER_FILE = new RegExp(`${MD_NAME},?\\s+\\(?(Section|Step)\\s+(\\d+[a-z]?)\\b`, 'gi');
const NAMED_AFTER_FILE = /`((?:[\w.-]+\/)*[\w.-]+\.md)`,? (?:\(([A-Z][^)]{2,60})\)|"([A-Z][^"]{2,60})")/g;
const STEP_BEFORE_FILE = new RegExp(`\\b(Section|Step)\\s+(\\d+[a-z]?)\\s+(?:of|in)\\s+${MD_NAME}`, 'gi');

function checkFile(file) {
  const lines = proseLines(readFileSync(join(ROOT, file), 'utf8'));
  const ownNumbered = headings(file).some((h) => /^\d+(?:\.\d+)?[.\s]/.test(h.title));

  for (const { n, text } of lines) {
    // 1. Paths in backticks.
    for (const m of text.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)) {
      if (looksLikePath(m[1])) checkPath(file, n, m[1]);
    }

    // 2. Links, outside inline code.
    const bare = text.replace(/`[^`]*`/g, '');
    for (const m of bare.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) checkLink(file, n, m[1]);

    // 1, continued. Plain-text paths, once inline code, links and URLs are gone.
    const plain = bare.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '');
    for (const m of plain.matchAll(PLAIN_PATH)) {
      const next = plain[m.index + m[0].length] ?? '';
      if (/[[<{*]/.test(next)) continue; // the path runs on into a placeholder
      checkPath(file, n, m[1].replace(/[.,;:]+$/, ''));
    }

    // 3. Numbered sections after a file name, then bare ones in this file.
    const claimed = new Set();
    for (const m of text.matchAll(SECTION_AFTER_FILE)) {
      const targets = markdownTargets(m[1], file);
      for (const s of m[2].matchAll(/§\s?(\d+(?:\.\d+)?)/g)) {
        claimed.add(m.index + m[0].indexOf(s[0], m[1].length));
        checkSection(file, n, s[1], targets, `${m[1]} §${s[1]}`);
      }
    }
    for (const s of text.matchAll(/§\s?(\d+(?:\.\d+)?)/g)) {
      if (claimed.has(s.index)) continue;
      const named = [...text.slice(0, s.index).matchAll(new RegExp(MD_NAME, 'g'))].pop();
      const targets = [...(named ? markdownTargets(named[1], file) : []), ...(ownNumbered ? [file] : [])];
      if (targets.length) checkSection(file, n, s[1], targets, `§${s[1]}`);
    }

    // 4. Named steps and sections next to a file name.
    for (const m of text.matchAll(STEP_AFTER_FILE)) {
      checkNamedStep(file, n, m[2], m[3], markdownTargets(m[1], file), `${m[1]} ${m[2]} ${m[3]}`);
    }
    for (const m of text.matchAll(STEP_BEFORE_FILE)) {
      checkNamedStep(file, n, m[1], m[2], markdownTargets(m[3], file), `${m[1]} ${m[2]} of ${m[3]}`);
    }

    // 5. Named sections after a backticked file name.
    for (const m of text.matchAll(NAMED_AFTER_FILE)) {
      const title = m[2] ?? m[3];
      if (/^(?:Section|Step)\s+\d/i.test(title)) continue; // rule 4
      checkNamedSection(file, n, title, markdownTargets(m[1], file), `${m[1]} (${title})`);
    }
  }
}

MARKDOWN.forEach(checkFile);

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(
    `\ncheck-doc-refs: ${findings.length} broken reference(s). Fix the reference, or, if it ` +
      'names something only a project made from the template has, add it to PROJECT_ONLY ' +
      'in .template/checks/check-doc-refs.mjs.'
  );
  process.exit(1);
}
console.log(`check-doc-refs: every reference in ${MARKDOWN.length} Markdown files resolves.`);
