#!/usr/bin/env node
/**
 * Scaffold check: fails when a scaffold document in docs/agent_context/ gains
 * project content. The template ships these documents blank. Onboarding fills
 * them in a project made from the template, never in the template itself.
 *
 * Run: node .template/checks/check-scaffolds.mjs
 * Paths resolve from this file, so any working directory will do. No
 * dependencies. Exits 0 when every scaffold is blank, or 1 with one line per
 * finding naming the file, the line and what was found there.
 *
 * Terms used below:
 * - unfilled: blank, a dash, TBD, a [square-bracketed placeholder] such as
 *   [ROLE_1] or [e.g. Phase A], or guidance written wholly in italics such as
 *   *Populated during onboarding.* Italics and backticks around it are ignored.
 * - Fenced code blocks hold the entry templates and blockquotes hold the rules,
 *   so neither counts as content unless a rule below says otherwise.
 *
 * Every scaffold gets three generic rules:
 * 1. Entry headings. No heading of level 3 or deeper outside a code block.
 *    A real decision, log entry, flow, table, role or fixture adds one.
 * 2. Table rows. Every table row starts with an unfilled cell. Real areas,
 *    ledger lines, matrix rows, constants and coverage rows do not. Two shipped
 *    exceptions: the bug-fix log's row in the EXECUTION_LOG index, and settings
 *    tables (header "Setting | Value"), which have a rule of their own.
 * 3. Template fields. No "**Label:** value" line outside a code block that uses
 *    a label from the file's own fenced entry template (such as **Trigger:** in
 *    CORE_FLOWS or **Date:** in DECISIONS) with a filled-in value.
 *
 * Then each file has its own signals:
 * - CURRENT_STATE: the status fields above the first section (Active phase,
 *   active log, blockers) are unfilled.
 * - DECISIONS, EXECUTION_LOG_BUGFIX: the section that collects entries holds
 *   guidance only.
 * - EXECUTION_LOG: names no phase log such as EXECUTION_LOG_A.md, and no phase
 *   log file exists. Onboarding creates both.
 * - CORE_FLOWS: the areas, background and deferred sections hold guidance only.
 * - SCHEMA_REFERENCE: the global rules keep placeholder labels, and the tables
 *   and algorithms sections hold guidance only.
 * - PERMISSIONS_REFERENCE: the Role type names no role but placeholders and
 *   ADMIN, and the roles section holds guidance only.
 * - SCOPE: the product statement holds guidance only.
 * - ROUTING: every listed route starts with a placeholder segment, and the
 *   sub-views and access rules sections hold guidance only.
 * - SERVER_LOGIC: the server-authoritative section holds placeholders only.
 * - DATABASE: the required seed data section holds guidance only.
 * - TEST_REFERENCE: the Current Coverage fields are unfilled, and so are the
 *   auth provider, sign-in and roles rows of the test auth settings table.
 * - UI_PATTERNS: the patterns section holds guidance only.
 *
 * Sections are found by a loose match on their heading, so rewording a heading
 * rarely matters. If a section, field list or table cannot be found at all, the
 * check fails and says so rather than quietly checking nothing. When a scaffold
 * is restructured on purpose, update its entry in SCAFFOLDS below.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIR = 'docs/agent_context';
const SELF = '.template/checks/check-scaffolds.mjs';

// ---------------------------------------------------------------------------
// What unfilled looks like

/** Blank, a dash, TBD or [bracketed], once italics and backticks are peeled off. */
function isPlaceholder(text) {
  let s = text.trim();
  for (let before; before !== s; ) {
    before = s;
    s = s.replace(/^(\*\*|\*|_|`)([\s\S]*)\1$/, '$2').trim();
  }
  return s === '' || /^[-\u2013\u2014]$/.test(s) || /^TBD$/i.test(s) || /^\[[\s\S]*\]$/.test(s);
}

/** A whole line or cell in italics: guidance for whoever fills the document in. */
const isGuidance = (text) => /^([*_])(?!\1)[\s\S]*[^*_\s]\1$/.test(text.trim());

const isUnfilled = (text) => isPlaceholder(text) || isGuidance(text);

// ---------------------------------------------------------------------------
// Reading a document

const FIELD = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?\*\*([^*]+?)(?::\*\*|\*\*:)\s*(.*)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;

/** "**Label:** value", with or without a list marker. */
function field(text) {
  const m = FIELD.exec(text);
  return m && { label: m[1].trim(), value: m[2].trim() };
}

/** The text of a list item, checkbox removed, or null. */
function listItem(text) {
  const m = LIST_ITEM.exec(text);
  return m ? m[1] : null;
}

function cells(text) {
  return text
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

/** One record per line: its number, whether it sits in a code block or quote, and its section. */
function parse(text) {
  const lines = [];
  let fence = null; // the opening marker while inside a code block
  let section = null; // the current level-2 heading; null above the first one
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = { n: i + 1, text: raw, fenced: false, quote: false, heading: null, section };
    const marker = /^\s*(`{3,}|~{3,})/.exec(raw)?.[1];
    if (fence) {
      line.fenced = true;
      const closes = marker && marker[0] === fence[0] && marker.length >= fence.length;
      if (closes && /^\s*[`~]+\s*$/.test(raw)) fence = null;
    } else if (marker) {
      fence = marker;
      line.fenced = true;
      line.opensFence = true;
    } else if (/^\s*>/.test(raw)) {
      line.quote = true;
    } else {
      const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(raw);
      if (h) {
        line.heading = { level: h[1].length, title: h[2] };
        if (h[1].length <= 2) section = h[1].length === 2 ? h[2] : null;
        line.section = section;
      }
    }
    lines.push(line);
  });
  return lines;
}

/** Runs of table lines outside code blocks and quotes, split into header and body rows. */
function tables(lines) {
  const runs = [];
  let run = null;
  for (const line of lines) {
    if (line.fenced || line.quote || !line.text.trim().startsWith('|')) {
      run = null;
      continue;
    }
    if (!run) runs.push((run = []));
    run.push({ ...line, cells: cells(line.text) });
  }
  const isSeparator = (row) => row.cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  return runs.map((rows) =>
    rows.length > 1 && isSeparator(rows[1])
      ? { header: rows[0].cells, body: rows.slice(2).filter((row) => !isSeparator(row)) }
      : { header: [], body: rows.filter((row) => !isSeparator(row)) }
  );
}

/** The lines under the first level-2 heading matching `pattern`, up to the next one. */
function section(doc, pattern) {
  const start = doc.lines.findIndex((l) => l.heading?.level === 2 && pattern.test(l.heading.title));
  if (start === -1) return null;
  const end = doc.lines.findIndex((l, i) => i > start && l.heading && l.heading.level <= 2);
  return {
    title: doc.lines[start].heading.title,
    lines: doc.lines.slice(start + 1, end === -1 ? undefined : end),
  };
}

// ---------------------------------------------------------------------------
// Findings

const clip = (text) => {
  const s = text.trim().replace(/\s+/g, ' ');
  return s.length > 72 ? `${s.slice(0, 69)}...` : s;
};

const found = (line, message) => ({ n: line.n, message });

const missing = (what) => ({
  n: 0,
  message:
    `could not find ${what}. ` +
    `If the scaffold changed shape on purpose, update its rule in ${SELF}`,
});

// ---------------------------------------------------------------------------
// Generic rules, applied to every scaffold

function entryHeadings(doc) {
  return doc.lines
    .filter((l) => l.heading && l.heading.level >= 3)
    .map((l) =>
      found(
        l,
        `heading "${clip(l.heading.title)}" is an entry; ` +
          'the template keeps entry headings inside its code-block examples'
      )
    );
}

/** Key and value tables ("Setting | Value") are checked by their own rule. */
const isSettingsTable = (table) => /^setting$/i.test(table.header[0] ?? '');

function tableRows(doc, { shippedRows } = {}) {
  return doc.tables
    .filter((table) => !isSettingsTable(table))
    .flatMap((table) => table.body)
    .filter((row) => !isUnfilled(row.cells[0] ?? '') && !shippedRows?.test(row.cells[0]))
    .map((row) =>
      found(
        row,
        `table row starting "${clip(row.cells[0])}" is filled in; ` +
          'the template ships placeholder rows only'
      )
    );
}

function templateFields(doc) {
  const labels = new Set(
    doc.lines
      .filter((l) => l.fenced)
      .map((l) => field(l.text))
      .filter((f) => f && !isPlaceholder(f.label))
      .map((f) => f.label.toLowerCase())
  );
  return doc.lines
    .filter((l) => !l.fenced && !l.quote)
    .map((l) => ({ l, f: field(l.text) }))
    .filter(({ f }) => f && labels.has(f.label.toLowerCase()) && !isUnfilled(f.value))
    .map(({ l, f }) =>
      found(l, `"${clip(`${f.label}: ${f.value}`)}" fills in a field from the entry template`)
    );
}

// ---------------------------------------------------------------------------
// File-specific rules

/** A section that ships with guidance only: italics, quotes, placeholders, rules, blank lines. */
function guidanceOnly(pattern) {
  return (doc) => {
    const part = section(doc, pattern);
    if (!part) return [missing(`a section whose heading matches ${pattern}`)];
    return part.lines
      .filter((l) => {
        if (l.quote || l.heading) return false; // headings: see entryHeadings
        if (l.fenced) return l.opensFence === true; // one finding per code block
        const t = l.text.trim();
        if (t === '' || /^(?:-{3,}|\*{3,}|_{3,})$/.test(t)) return false; // blank or a rule
        if (t.startsWith('|')) return false; // tables: see tableRows
        if (isGuidance(t)) return false;
        const item = listItem(t);
        return item === null || !isUnfilled(item);
      })
      .map((l) =>
        found(l, l.fenced
          ? `a code block in "${part.title}", which the template ships with guidance only`
          : `"${clip(l.text)}" in "${part.title}", which the template ships with guidance only`)
      );
  };
}

/** Every list item in `lines` is a field whose label (or value) is unfilled. */
function unfilledFields(lines, where, part) {
  const items = lines.filter((l) => !l.fenced && !l.quote && listItem(l.text) !== null);
  if (!items.length) return [missing(`the fields in ${where}`)];
  return items.flatMap((l) => {
    const f = field(l.text);
    if (!f) return [found(l, `"${clip(l.text)}" in ${where} is not a template field`)];
    if (part === 'label' ? isPlaceholder(f.label) : isUnfilled(f.value)) return [];
    return [found(l, `${where}: "${clip(`${f.label}: ${f.value}`)}" is filled in`)];
  });
}

function statusFields(doc) {
  return unfilledFields(doc.lines.filter((l) => l.section === null), 'the status block', 'value');
}

function sectionFields(pattern, part) {
  return (doc) => {
    const s = section(doc, pattern);
    if (!s) return [missing(`a section whose heading matches ${pattern}`)];
    return unfilledFields(s.lines, `"${s.title}"`, part);
  };
}

const PHASE_LOG = /EXECUTION_LOG_(?!BUGFIX\b)[A-Za-z0-9]+\.md/;

function phaseLogNames(doc) {
  return doc.lines
    .filter((l) => !l.fenced && !l.quote && PHASE_LOG.test(l.text))
    .map((l) =>
      found(
        l,
        `names phase log ${PHASE_LOG.exec(l.text)[0]}; ` +
          'onboarding lists phase logs in a project, not in the template'
      )
    );
}

function roleType(doc) {
  const start = doc.lines.findIndex((l) => /\btype\s+Role\s*=/.test(l.text));
  if (start === -1) return [missing('the Role type')];
  // The union may run on over following lines that start with "|".
  let end = start + 1;
  while (end < doc.lines.length && doc.lines[end].text.trim().startsWith('|')) end++;
  const text = doc.lines.slice(start, end).map((l) => l.text).join(' ');
  const roles = [...text.matchAll(/["'`]([^"'`]+)["'`]/g)]
    .map((m) => m[1])
    .filter((role) => role !== 'ADMIN' && !isPlaceholder(role));
  if (!roles.length) return [];
  const names = roles.map((role) => `"${role}"`).join(', ');
  return [
    found(
      doc.lines[start],
      `the Role type names ${names}; the template ships placeholder roles and ADMIN only`
    ),
  ];
}

function routeList(doc) {
  const routes = doc.lines.filter((l) => !l.quote && /^\s*\/(?!\/)\S/.test(l.text));
  if (!routes.length) return [missing('the top-level route list')];
  return routes
    .filter((l) => !/^\s*\/\[/.test(l.text))
    .map((l) =>
      found(l, `route "${clip(l.text)}" is real; the template lists placeholder routes only`)
    );
}

/** The settings onboarding answers. The other rows ship with working defaults. */
const ONBOARDING_SETTINGS = /auth provider|sign-in|roles/i;

function authSettings(doc) {
  const table = doc.tables.find(isSettingsTable);
  if (!table) return [missing('the test auth settings table (header "Setting | Value")')];
  const rows = table.body.filter((row) => ONBOARDING_SETTINGS.test(row.cells[0]));
  if (!rows.length) return [missing(`settings rows matching ${ONBOARDING_SETTINGS}`)];
  return rows
    .filter((row) => !isUnfilled(row.cells[1] ?? ''))
    .map((row) =>
      found(row, `test auth setting "${clip(row.cells[0])}" is filled in ("${clip(row.cells[1])}")`)
    );
}

// ---------------------------------------------------------------------------
// The scaffolds

const SCAFFOLDS = [
  { file: 'CURRENT_STATE.md', rules: [statusFields] },
  { file: 'DECISIONS.md', rules: [guidanceOnly(/^decisions$/i)] },
  {
    file: 'EXECUTION_LOG.md',
    rules: [phaseLogNames],
    shippedRows: /^`?EXECUTION_LOG_BUGFIX\.md`?$/,
  },
  { file: 'EXECUTION_LOG_BUGFIX.md', rules: [guidanceOnly(/log$/i)] },
  {
    file: 'CORE_FLOWS.md',
    rules: [guidanceOnly(/^areas/i), guidanceOnly(/background/i), guidanceOnly(/deferred/i)],
  },
  {
    file: 'SCHEMA_REFERENCE.md',
    rules: [
      sectionFields(/global rules/i, 'label'),
      guidanceOnly(/^tables$/i),
      guidanceOnly(/algorithm/i),
    ],
  },
  { file: 'PERMISSIONS_REFERENCE.md', rules: [roleType, guidanceOnly(/^roles$/i)] },
  { file: 'SCOPE.md', rules: [guidanceOnly(/product statement/i)] },
  {
    file: 'ROUTING.md',
    rules: [routeList, guidanceOnly(/sub-views/i), guidanceOnly(/access rules/i)],
  },
  { file: 'SERVER_LOGIC.md', rules: [guidanceOnly(/server-authoritative/i)] },
  { file: 'DATABASE.md', rules: [guidanceOnly(/seed data/i)] },
  { file: 'TEST_REFERENCE.md', rules: [sectionFields(/current coverage/i, 'value'), authSettings] },
  { file: 'UI_PATTERNS.md', rules: [guidanceOnly(/^patterns$/i)] },
];

function check({ file, rules, shippedRows }) {
  const path = join(ROOT, DIR, file);
  if (!existsSync(path)) return [missing('this scaffold, which the template ships')];
  const lines = parse(readFileSync(path, 'utf8'));
  const doc = { lines, tables: tables(lines) };
  const all = [
    ...rules.flatMap((rule) => rule(doc)),
    ...entryHeadings(doc),
    ...tableRows(doc, { shippedRows }),
    ...templateFields(doc),
  ];
  // One finding per line: the first rule to flag it says the most.
  const seen = new Set();
  return all
    .filter((f) => f.n === 0 || (!seen.has(f.n) && seen.add(f.n)))
    .sort((a, b) => a.n - b.n);
}

const findings = SCAFFOLDS.flatMap((scaffold) =>
  check(scaffold).map((f) => `${DIR}/${scaffold.file}${f.n ? `:${f.n}` : ''}: ${f.message}`)
);

const shipped = new Set(['EXECUTION_LOG.md', 'EXECUTION_LOG_BUGFIX.md']);
for (const name of readdirSync(join(ROOT, DIR))) {
  if (/^EXECUTION_LOG_.+\.md$/.test(name) && !shipped.has(name)) {
    findings.push(
      `${DIR}/${name}: is a phase log; ` +
        'onboarding creates phase logs in a project, not in the template'
    );
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(
    `\ncheck-scaffolds: ${findings.length} finding(s). ` +
      `The scaffold documents in ${DIR}/ ship blank; ` +
      'project content belongs in a project made from the template.'
  );
  process.exit(1);
}
console.log(`check-scaffolds: all ${SCAFFOLDS.length} scaffold documents in ${DIR}/ are blank.`);
