# Toolkit

> The plugins and MCP servers a new project starts with, the ones onboarding can add,
> the model and effort each role runs on, and the rules for bringing in anything else
> from a third party.
>
> **Keep this file in step with `.claude/settings.json`, `.mcp.json` and the vendored
> skills in `.claude/skills/`.** Everything there from a third party is listed here
> with its source and the reason it is in. **Keep the routing table in step with
> `.claude/agents/`, saved workflows and the skill scripts that start `claude`.**

---

## How it loads

Both files are checked in, so every developer gets the same set. Claude Code asks
whether to trust the folder the first time it opens the repository. Say yes once.

After that, nothing needs installing by hand:

- **Plugins from `claude-plugins-official`** load straight from Anthropic's marketplace,
  which Claude Code adds for you in an interactive session.
- **Vendored skills** in `.claude/skills/` are part of the repository, so they load like
  the template's own skills.
- **Path-scoped rules** in `.claude/rules/` load when Claude reads or edits a file in
  their folder. `AGENTS.md` lists them.
- **The Playwright MCP server** starts from `.mcp.json`. `enabledMcpjsonServers` in
  `settings.json` approves it, so it does not ask.

`/plugin` → **Errors** should be empty. The one machine-level dependency is the
TypeScript language server: if `typescript-lsp` reports
`Executable not found in $PATH`, install it as `PREREQUISITES.md` describes.

`context7` may also need authorising once per machine. If Claude Code says its server
needs authentication, run `/mcp`, select `context7` and complete the sign-in. Until then
its tools are unavailable, and the rest of the toolkit works as normal.

Cloud sessions do not load the plugins `settings.json` turns on. In `claude -p` runs
plugins install in the background, so set `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` when a
headless run needs them from its first turn.

---

## Defaults

### Plugins

| Plugin | Source | Why it is on | Notes |
|---|---|---|---|
| `frontend-design` | `claude-plugins-official`, by Anthropic | Gives new UI a deliberate visual direction instead of stock defaults | Skills only |
| `context7` | `claude-plugins-official`, maintained by Upstash | Current, version-specific library documentation, so agents do not code against stale APIs | Points at Upstash's hosted MCP server, `mcp.context7.com`. Library names and queries are sent there. May need authorising once in `/mcp` (see How it loads); `CONTEXT7_API_KEY` raises the rate limit |
| `security-guidance` | `claude-plugins-official`, by Anthropic | Warns on risky patterns as code is written and reviews the diff when Claude stops | Its model-backed reviews add usage. It adds to gate G2 in `SECURITY.md`; it does not replace it |
| `typescript-lsp` | `claude-plugins-official`, by Anthropic | Type errors, definitions and references from the TypeScript language server | Needs `typescript-language-server` on `PATH` |

### Vendored skills

Copied into `.claude/skills/` byte for byte, with the upstream licence beside each one.
Nothing is fetched at run time, and an upstream change only arrives as a diff someone
has read.

| Skills | Source | Commit | Licence | Why they are in |
|---|---|---|---|---|
| `gsap-core`, `gsap-frameworks`, `gsap-performance`, `gsap-plugins`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-utils` | `greensock/gsap-skills`, `skills/` | `aed9cfd3277740755f6bfc1155c7aa645403b760` | MIT, GreenSock | GSAP timeline, ScrollTrigger and React guidance. They recommend GSAP for any animation, so the **Library** rule in `docs/agent_context/UI_PATTERNS.md` decides which library to use |

### MCP servers

| Server | Source | Why it is on | Notes |
|---|---|---|---|
| `playwright` | `@playwright/mcp` 0.0.83 on npm, by Microsoft | The browser `test-author` and `test-runner` drive | Pinned version. `--no-webmcp` stops pages it visits registering their own tools. `--isolated` and `--caps=testing` are explained in the `test-author` skill. `browser_run_code_unsafe` is denied in `settings.json` |

---

## Opt-ins

Onboarding offers these when the project needs them. None is on by default.

| Name | Kind | Source | Add it when |
|---|---|---|---|
| `vercel` | Plugin | `claude-plugins-official`, entry points at `vercel/vercel-plugin` | The project deploys to Vercel |
| `neon` | Plugin | `claude-plugins-official`, entry points at `neondatabase/agent-skills` | The project uses Neon Postgres |
| Clerk | MCP server | `https://mcp.clerk.com/mcp`, Clerk's hosted server (beta) | The project uses Clerk. It serves SDK snippets only, not user data |
| `chrome-devtools-mcp` | Plugin | `claude-plugins-official`, entry points at `ChromeDevTools/chrome-devtools-mcp` | Performance traces or live debugging in Chrome |
| `sentry` | Plugin | `claude-plugins-official`, entry points at `getsentry/plugin-claude` | The project reports errors to Sentry |
| `figma` | Plugin | `claude-plugins-official`, entry points at `figma/mcp-server-guide` | Designs are handed over in Figma |
| `stripe` | Plugin | `claude-plugins-official`, entry points at `stripe/ai` | The project takes payments with Stripe |
| `ui-ux-pro-max` | Plugin | `nextlevelbuilder/ui-ux-pro-max-skill`, a community marketplace | A broader design reference is wanted. It ships Python scripts, so the community rule below applies |

An opt-in plugin whose catalogue entry points at another repository does not install
from project settings alone. Each developer installs it once with the command the
`/plugin` Errors tab gives, `claude plugin install <name>@claude-plugins-official --scope project`.

---

## Not used

| Name | Why not |
|---|---|
| GitHub MCP server | The `gh` CLI already covers issues, milestones and pull requests |
| Community GSAP MCP servers | The vendored GSAP skills cover the same ground without running anything |
| GreenSock's `gsap-skills` marketplace | Its plugin is the whole repository and cannot be pinned to a commit, so a new install would take whatever is on `main`. The skills are vendored instead |

---

## Model and effort routing

Each role runs on the model and effort level below. The lead session is the
conversation the developer drives; set it once with `/model opus` and `/effort high`,
pressing Enter to save each as your default.

| Role | Model | Effort | Where it is set |
|---|---|---|---|
| Lead session | `opus` | `high` | `/model` and `/effort`, saved per machine |
| Well-scoped implementation | `opus` | `medium` | `task-dispatcher` workers the planner rates `low` or `medium` complexity |
| Bug fixes and risky changes | `opus` | `high` | `task-dispatcher` workers on the ad-hoc path or rated `high` complexity |
| Explore | `sonnet` | `medium` | A project agent named `Explore` in `.claude/agents/`. None ships, see below |
| Mechanical helpers: log and output summaries, doc lookups | `haiku` | `low` | The helper's agent file |
| Test triage | `sonnet` | `medium` | The triage agent's file |
| Planner and reviewer | `opus` | `high` | `task-dispatcher` planner and synthesis agent; review agents' files |
| Security reviewer | `opus` | `high`, or `xhigh` when the change touches auth, payments or personal data | The reviewer's agent file, or `/effort` before `/security-review` |
| Pre-release audit, architecture decisions, a problem Opus has failed twice | `fable` | `high` | Opt-in only: `/model fable` in the lead session, under the Fable rule below |

Why these levels. The current Opus, Sonnet and Haiku default to `medium` effort in
Claude Code, and the Claude Code docs recommend `high` for work where verification
matters or edge cases are likely, such as fixing a bug in existing code. `max` tends
to overthink, so no role uses it.

**Explore.** The built-in Explore subagent runs on the lead session's model, so
without an override it stays on Opus. `CLAUDE_CODE_SUBAGENT_MODEL` does not change it.
The Sonnet row takes effect only when a project agent named `Explore` is added to
`.claude/agents/` with `model: sonnet` and `effort: medium` in its frontmatter.

### Naming models

Agent files, skills, scripts and workflows name a model by its alias: `opus`,
`sonnet`, `haiku` or `fable`. An alias moves to the newest version when Claude Code
does, so nothing needs editing on a release. Never write a full versioned model ID,
and never use `best`: it resolves to Fable wherever Fable is available, which would
skip the Fable rule.

Subagent frontmatter takes `model:` and `effort:`. Scripts pass `--model` and
`--effort` to `claude -p`. Give both every time: a run without them takes whatever the
developer last saved.

### The Fable rule

Fable is for the hardest problems only, and is never a default.

1. **Only on request or after two failures.** Use it when the developer asks for it
   by name, or after two Opus attempts at the same problem have failed. Say which
   applies when you switch.
2. **Only where the client's data agreements allow 30-day retention.** Fable is a
   Covered Model that requires data retention, so it is unavailable under zero data
   retention. Check the client's agreement before the first Fable request on their
   project, and ask the developer if it is unclear.
3. **Switch back afterwards.** It costs more per token than Opus and can bill to usage
   credits. In `claude -p` runs it bills credits without asking, so no shipped agent
   file, skill or script names `fable`.

### Settings the template never sets

Neither of these goes in `.claude/settings.json`, an agent file, a skill or a script,
because each overrides the per-role settings above:

- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` puts every subagent on one model, ignoring the
  `model:` in each agent file.
- `CLAUDE_CODE_EFFORT_LEVEL` sits above `effort:` frontmatter and `--effort` in the
  resolution order, so every role runs at the same level.

Do not set them in your own environment while working on a project made from the
template either.

### Changing a role's model or effort

- **Lower effort before changing model.** Prompt caches are per model, so mixing
  models loses cache reuse. A lower effort on the same model is often the cheaper fix.
- **Move a role to a cheaper model only on evidence.** The calibration log in
  `ESTIMATING.md` must show that ticket type passing review at the same rate on the
  cheaper model as on the current one. `opusplan` (Opus plans, Sonnet builds) is not
  the default for the same reason.
- **Raising a level needs no evidence.** If a role keeps failing review, move it up.
- **Change the table and every file that sets the role in the same commit.**

---

## Third-party policy

1. **Anthropic plugins** from `claude-plugins-official` may auto-update. That is the
   default for that marketplace.
2. **Vendor skills that are plain Markdown** are copied into the repository and pinned,
   with the source repository, commit and licence recorded in this file. Copy them
   unedited, so a later update is a clean diff against upstream. To update, read what
   changed upstream, copy the new files over, and update the commit above.
3. **Community plugins, and any third-party plugin with scripts or hooks**, are opt-in
   only. Pin it to a commit, read what it runs, then enable it.

Adding anything to this file means stating its source and why it is in. Removing
something means deleting its row and its entry in `settings.json` or `.mcp.json`.
