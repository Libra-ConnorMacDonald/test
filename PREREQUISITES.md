# Prerequisites

> **Run through this guide before running onboarding on a new project.**
> These are the tools your machine needs to run the template's workflow and the
> skills it ships with. The skills themselves — including the task dispatcher
> at `.claude/skills/task-dispatcher/` — are already inside the repo and don't
> need to be installed separately.
>
> If you skip this guide and run onboarding first, you'll hit errors partway
> through.

---

## What you're installing

| Category | Purpose |
|---|---|
| **Core workflow tools** | Git, GitHub CLI, Node, pnpm, VS Code, Claude Code, the TypeScript language server — needed by every project |
| **Shell and data tools** | bash, jq, Python — needed by the task-dispatcher orchestrator script that ships with this template |
| **Testing tooling** | Playwright browser binaries — downloaded per project, not installed globally |

The first two sets are needed before you start. The orchestrator script is already in the repo, but it's a bash script that processes JSON and does some Python-based parsing — without bash, jq, and Python installed on your machine, the script can't run.

Playwright is the exception — its browsers are downloaded per project, after onboarding rather than before it. See **Playwright browsers** below.

---

## Required tools

| Tool | Purpose | Minimum version |
|---|---|---|
| **Git** | Version control — `git mv`, commits, `git diff` | 2.30+ |
| **Node.js** | JavaScript runtime for Next.js, pnpm, all Node-based tooling, and the hooks and status line in `.claude/` | The major version in `.nvmrc` (26.x) |
| **pnpm** | Package manager (preferred over npm). `package.json` pins the exact version and pnpm switches to it by itself. That version blocks dependency install scripts unless `pnpm-workspace.yaml` allows them, which `docs/general_docs/SECURITY.md` §6 relies on | 9.7+ |
| **VS Code** (or equivalent) | Editor with integrated terminal | Latest |
| **Claude Code CLI** | The agent itself. Install it with Anthropic's native installer, which keeps it up to date | Latest |
| **Git Bash** (Windows) or **bash** (Mac/Linux) | Runs the orchestrator script | Any modern version |
| **jq** | Parses JSON output from the orchestrator's planner | 1.6+ |
| **Python** | Runs cycle detection, branch-name derivation, and safe template substitution inside the orchestrator. Either `python3` or `python` on `PATH` — the orchestrator probes for both | 3.10+ |
| **GitHub CLI** (`gh`) | The task backlog — creating and reading issues, milestones, and the Project board — plus the pull-request command the dispatcher's close-out proposes. Older versions error on Projects-related fields | 2.94.0+ |
| **TypeScript language server** (`typescript-language-server` and `typescript`, installed globally) | The `typescript-lsp` plugin starts it to give Claude type errors and code navigation. Without it the plugin reports an error | Latest |

pnpm refuses to install on a Node.js major version other than the one in `.nvmrc`. A version manager such as nvm or fnm reads `.nvmrc` and switches for you.

---

## Optional but recommended

| Tool | Purpose |
|---|---|
| **Docker Desktop** | If your project uses Postgres, Redis, or other services locally |
| **Vercel CLI** | Manage deployments, link projects, pull environment variables locally — needed if your project deploys to Vercel |
| **Neon CLI** | Create branches, run migrations against branch databases, manage roles — needed if your project uses Neon Postgres |

---

## Install by platform

### Windows

Open **PowerShell as Administrator**.

**1. Check winget is available** (built into Windows 11 and modern Windows 10):

```powershell
winget --version
```

If winget isn't found, install App Installer from the Microsoft Store, then restart PowerShell.

**2. Install everything:**

```powershell
winget install Git.Git
winget install --id GitHub.cli
winget install OpenJS.NodeJS.LTS
winget install Microsoft.VisualStudioCode
winget install jqlang.jq
winget install Python.Python.3.12
```

**3. Install pnpm and the TypeScript language server** (via npm, after Node.js is installed):

```powershell
npm install -g pnpm
npm install -g typescript-language-server typescript
```

**4. Install Claude Code** with the native installer, the method Anthropic recommends. It doesn't need Administrator, so an ordinary PowerShell window works too:

```powershell
irm https://claude.ai/install.ps1 | iex
```

It updates itself in the background. `winget install Anthropic.ClaudeCode` also works, but doesn't update itself.

**5. (Optional) Install service CLIs** if your project uses Vercel for hosting or Neon for Postgres:

```powershell
npm install -g vercel
npm install -g neonctl

vercel login    # opens a browser to authenticate
neonctl auth    # opens a browser to authenticate
```

**6. Close PowerShell completely and reopen it.** This refreshes the PATH so newly installed commands are found.

**7. Sign in to Claude Code:**

```powershell
claude
```

Follow the prompts to sign in.

**8. Verify:**

```powershell
git --version
gh --version
node --version
pnpm --version
claude --version
typescript-language-server --version
jq --version
python --version
```

All eight should print a version. If any fail, close PowerShell, reopen, and try again — sometimes Windows needs a second refresh. If they still fail after two attempts, sign out of Windows and back in.

**9. Set Git Bash as your VS Code terminal** (required for the orchestrator script):

1. Open VS Code in your project
2. Open the terminal with `` Ctrl+` ``
3. Click the dropdown arrow next to the `+` sign in the terminal panel
4. Select **Git Bash**
5. Optionally, make it the default: `Ctrl+Shift+P` → "Terminal: Select Default Profile" → Git Bash

Git Bash ships with Git for Windows and handles `.sh` scripts natively.

### macOS

Use **Homebrew**. If you don't have Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install everything:

```bash
brew install git
brew install gh
brew install node
brew install --cask visual-studio-code
brew install jq
brew install python@3.12
```

Install pnpm and the TypeScript language server via npm:

```bash
npm install -g pnpm
npm install -g typescript-language-server typescript
```

Install Claude Code with the native installer, the method Anthropic recommends. It updates itself in the background:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

`brew install --cask claude-code` also works, but doesn't update itself. Open a new terminal, then sign in:

```bash
claude  # follow prompts to sign in
```

**(Optional) Install service CLIs** if your project uses Vercel for hosting or Neon for Postgres:

```bash
npm install -g vercel
npm install -g neonctl

vercel login    # opens a browser to authenticate
neonctl auth    # opens a browser to authenticate
```

Verify:

```bash
git --version
gh --version
node --version
pnpm --version
claude --version
typescript-language-server --version
jq --version
python3 --version
```

bash is already installed on macOS — no extra step needed.

### Linux (Debian / Ubuntu)

```bash
sudo apt update
sudo apt install -y git curl jq python3

# GitHub CLI — install from GitHub's own apt repository (see cli.github.com);
# the version in the default repositories is usually older than the 2.94.0 minimum
sudo mkdir -p -m 755 /etc/apt/keyrings
wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh

# Node.js 26.x via NodeSource
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm

# Claude Code, with Anthropic's native installer, which updates itself
curl -fsSL https://claude.ai/install.sh | bash
# open a new terminal, then sign in
claude  # follow prompts to sign in

# TypeScript language server, for the typescript-lsp plugin
npm install -g typescript-language-server typescript
```

**(Optional) Install service CLIs** if your project uses Vercel for hosting or Neon for Postgres:

```bash
npm install -g vercel
npm install -g neonctl

vercel login    # opens a browser to authenticate
neonctl auth    # opens a browser to authenticate
```

VS Code — install from [code.visualstudio.com](https://code.visualstudio.com/) or via snap:

```bash
sudo snap install code --classic
```

Verify:

```bash
git --version
gh --version
node --version
pnpm --version
claude --version
typescript-language-server --version
jq --version
python3 --version
```

bash is already installed — no extra step needed.

---

## GitHub CLI authentication

The task backlog lives in GitHub Issues, so `gh` must be authenticated before onboarding — onboarding verifies the remote and `gh` auth before generating any tasks. On every platform:

```bash
gh auth login
```

Sign in via the browser, then add the `project` scope, which board operations need:

```bash
gh auth refresh -s project
```

If you paste a classic personal access token instead, include the `project` scope alongside `repo` and `read:org` when generating the token — `gh auth refresh` cannot add scopes to a pasted token.

Keep `gh` current — versions older than 2.94.0 error on Projects-related fields.

---

## Claude Code plugins and MCP servers

There is nothing to install here. The repository's `.claude/settings.json` turns on the
default plugins and `.mcp.json` registers the Playwright MCP server.

The first time you run `claude` in the project folder, it asks whether you trust the
folder. Say yes. That one answer lets the plugins load.

To check, run `/plugin` in a session. The default plugins are listed as enabled and the
**Errors** tab is empty. An `Executable not found in $PATH` error means the TypeScript
language server from **Required tools** is missing.

If Claude Code says the `context7` server needs authentication, run `/mcp`, select
`context7` and complete the sign-in. That's once per machine.

What each plugin and server is for, and the ones onboarding can add:
`docs/general_docs/TOOLKIT.md`.

---

## Playwright browsers

Playwright is installed per project, not globally — it arrives with `pnpm install` once the test harness is in place. What it does need is a one-off download of the browser binaries it drives.

Run this once per machine, from the project root, after the project's dependencies are installed:

```bash
pnpm exec playwright install chromium
```

On Linux — and in CI containers — the browsers also need system libraries:

```bash
pnpm exec playwright install --with-deps chromium
```

This downloads roughly 150 MB.

**This is not a pre-onboarding step.** Playwright is not a dependency until the test harness is in place, so there is nothing for `pnpm exec` to resolve yet — run it when the project's test harness is first set up. If `pnpm test:e2e` fails with `Executable doesn't exist`, this step hasn't been run.

The Playwright MCP server registered in `.mcp.json` is separate again. It shells out to `npx` and downloads `@playwright/mcp` on first use, so the first browser tool call of a session takes noticeably longer than the rest.

That server needs one thing from you. `.mcp.json` passes `--browser=chrome`, which drives the Google Chrome already installed on the machine rather than a Playwright-managed download — so on a machine without Chrome, the first browser tool call fails. Either install Google Chrome, or change that flag to `--browser=chromium` and run `pnpm exec playwright install chromium` so Playwright supplies the browser itself.

---

## Verification checklist

Before running `ONBOARDING.md`, confirm every item below succeeds without errors:

```bash
git --version
gh --version
gh auth status
node --version
pnpm --version
claude --version
typescript-language-server --version
jq --version
python --version     # Windows
python3 --version    # Mac/Linux
bash --version
```

All must work (python or python3, per your platform). If any fail, resolve before proceeding — onboarding assumes they're all present.

---

## VS Code extensions (recommended)

These are not required but make the workflow smoother:

| Extension | Why |
|---|---|
| **ESLint** | Lint errors surfaced inline |
| **Prettier — Code formatter** | Auto-format on save |
| **Tailwind CSS IntelliSense** | Class autocomplete if you use Tailwind |
| **Prisma** or **Drizzle** (depending on ORM) | Schema syntax highlighting |
| **GitLens** | Richer git history in the editor |
| **Error Lens** | Inline error display |

Install via the Extensions panel (`Ctrl+Shift+X`) or from the command line:

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension eamodio.gitlens
code --install-extension usernamehw.errorlens
```

---

## Troubleshooting

**`command not found` after installation on Windows.** PATH hasn't refreshed. Close PowerShell and VS Code completely, then reopen. If the command still isn't found, sign out of Windows and back in.

**`python` works but `python3` doesn't (or vice versa).** Windows typically installs Python as `python`; Mac/Linux as `python3`. Use whichever works on your system — the orchestrator script calls `python3` from inside Git Bash, which aliases `python3` to `python` automatically on Windows.

**`claude` not found after installing.** Open a new terminal first. If it still isn't found, the native installer's directory isn't on your PATH: add `~/.local/bin` (Mac/Linux) or `%USERPROFILE%\.local\bin` (Windows) to it. Anthropic's [installation troubleshooting](https://code.claude.com/docs/en/troubleshoot-install) covers the other errors.

**Orchestrator fails with "bash: command not found".** You're running from PowerShell or CMD, not Git Bash. Switch the VS Code terminal to Git Bash (see Windows step 9 above).

**`pnpm` hangs on install.** Some corporate networks block pnpm's default registry. Try `pnpm config set registry https://registry.npmjs.org/` and retry.

**`vercel` or `neonctl` says you're not authenticated even after logging in.** Auth tokens are stored per shell session on first install. Close and reopen your terminal, then run `vercel whoami` or `neonctl me` to confirm. If the issue persists, run `vercel logout` / `neonctl auth --logout` and authenticate again.

---

## What happens if you skip this

Onboarding, or the first tasks after it, will fail partway. Most commonly:

- Onboarding's GitHub verification fails before any tasks are generated — no `gh`, or `gh` not authenticated
- The first Phase A tasks fail: installing dependencies, running database migrations and setting up the test harness all use `pnpm`. Onboarding itself never runs `pnpm`, so you only find out once development starts
- The task-dispatcher orchestrator script exits immediately — no `jq`, no `bash`, or no Python
- `tsc --noEmit` verification checks fail — no TypeScript / Node

Spending ten minutes here saves fighting through the rest of the template.
