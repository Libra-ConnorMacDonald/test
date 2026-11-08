#!/usr/bin/env node
// Renders a standalone HTML file to PDF for the journey-export skill.
// Usage: node render-pdf.mjs <input.html> <output.pdf>
//
// Renderer selection: the project's Playwright chromium if installed (present
// after the Phase A test harness task), otherwise a system Chrome/Edge in
// headless mode. Both honour the template's @page CSS, so output is identical.
// No dependencies of its own — never add any.

import { existsSync, mkdirSync, statSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('Usage: node render-pdf.mjs <input.html> <output.pdf>');
  process.exit(2);
}
const input = resolve(inputArg);
const output = resolve(outputArg);
if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(2);
}
mkdirSync(dirname(output), { recursive: true });

// Every render writes here first and is promoted only once it verifies. Without
// this, a candidate that exits 0 without writing anything would validate against
// the previous export's file and report a success that never happened.
const staging = `${output}.part-${process.pid}`;
const discardStaging = () => {
  try {
    rmSync(staging, { force: true });
  } catch {
    /* best effort */
  }
};
const wroteSomething = () => existsSync(staging) && statSync(staging).size > 0;
const promote = () => renameSync(staging, output);

async function tryPlaywright() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return false; // not installed — fall through to system browser
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(input).href, { waitUntil: 'load' });
    await page.pdf({ path: staging, printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
  if (!wroteSomething()) return false;
  promote();
  return true;
}

function systemBrowserCandidates() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    // Chrome first: corporate policy can block Edge's headless printing, and a
    // blocked Edge hangs until the timeout rather than failing fast.
    // Per-user installs (no admin rights) live under LOCALAPPDATA — the default
    // for many corporate machines, so check those too, then fall back to bare
    // names for anything already on PATH.
    return [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      localAppData && `${localAppData}/Google/Chrome/Application/chrome.exe`,
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      localAppData && `${localAppData}/Microsoft/Edge/Application/msedge.exe`,
      'chrome.exe',
      'msedge.exe',
    ].filter(Boolean);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
}

function tryHeadlessBrowser() {
  const attempted = [];
  for (const exe of systemBrowserCandidates()) {
    const isPath = exe.includes('/');
    if (isPath && !existsSync(exe)) continue;
    // A fresh profile directory keeps headless runs from hanging on the desktop
    // browser's profile lock when it is already open.
    const profile = mkdtempSync(join(tmpdir(), 'journey-export-'));
    try {
      const res = spawnSync(
        exe,
        [
          '--headless',
          '--disable-gpu',
          '--no-first-run',
          '--disable-extensions',
          `--user-data-dir=${profile}`,
          '--no-pdf-header-footer',
          `--print-to-pdf=${staging}`,
          pathToFileURL(input).href,
        ],
        { stdio: 'pipe', timeout: 60000 },
      );
      if (res.status === 0 && wroteSomething()) {
        promote();
        return { exe, attempted };
      }
      attempted.push({
        exe,
        status: res.status,
        error: res.error ? res.error.code || res.error.message : null,
        stderr: (res.stderr ? res.stderr.toString() : '').trim().split('\n').slice(-3).join(' | '),
      });
      discardStaging();
    } finally {
      // A timed-out browser can outlive spawnSync and keep the profile locked;
      // cleanup must never abort the candidate loop.
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch {
        /* best effort — a stray temp profile is harmless */
      }
    }
  }
  return { exe: null, attempted };
}

const viaPlaywright = await tryPlaywright().catch((err) => {
  console.warn(`Playwright renderer failed (${err.message}) — falling back to system browser.`);
  discardStaging();
  return false;
});

if (viaPlaywright) {
  console.log(`PDF written: ${output} (renderer: Playwright chromium)`);
} else {
  const { exe, attempted } = tryHeadlessBrowser();
  if (!exe) {
    if (attempted.length === 0) {
      console.error(
        'No PDF renderer available: Playwright is not installed and no system Chrome/Edge was found.',
      );
    } else {
      console.error('No PDF renderer succeeded. Browsers found, but each failed to render:');
      for (const a of attempted) {
        console.error(`  ${a.exe} — exit ${a.status}${a.error ? ` (${a.error})` : ''}${a.stderr ? `: ${a.stderr}` : ''}`);
      }
    }
    discardStaging();
    process.exit(1);
  }
  console.log(`PDF written: ${output} (renderer: ${exe})`);
}
