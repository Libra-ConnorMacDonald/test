#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Task Dispatcher — Skill-specific orchestrator for the AI-Assisted Project Template
#
# Accepts either a GitHub issue number (backlog path) or a free-text description
# (ad-hoc path). The backlog lives in GitHub Issues — see the TASK TRACKER section
# of AGENTS.md.
# Refuses to run if onboarding has not been completed.
# Injects template conventions into every worker prompt.
# Runs the Agent Session Protocol close-out on completion.
# Commits on the contributor branch at close-out, then stops at a proposed
# merge-back sequence. It never pushes, rebases, merges or opens a pull request.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(pwd)"
TASKS_DIR="${PROJECT_DIR}/.tasks"
# Overridable so a sibling skill can reuse this orchestrator without overwriting
# the task-dispatcher's own plan and summary, or driving workers from the wrong
# planner prompt. Defaults are unchanged — override via the environment or via
# --plan-file, --summary-file and --planner-prompt.
PLAN_FILE="${PLAN_FILE:-${TASKS_DIR}/plan.json}"
SUMMARY_FILE="${SUMMARY_FILE:-${TASKS_DIR}/summary.md}"
PLANNER_PROMPT="${PLANNER_PROMPT:-${SCRIPT_DIR}/planner-prompt.md}"
# Derived from PLAN_FILE's directory unless set explicitly, so a sibling skill
# that overrides the three documented paths gets isolated logs and a private
# status map for free — no collisions when agent ids repeat across two plans.
LOGS_DIR="${LOGS_DIR:-$(dirname "${PLAN_FILE}")/logs}"
STATUS_FILE="${STATUS_FILE:-$(dirname "${PLAN_FILE}")/status.json}"
AGENT_TIMEOUT="${AGENT_TIMEOUT:-600}"
MAX_AGENTS="${MAX_AGENTS:-5}"

# Model and effort per role, from the routing table in
# docs/general_docs/TOOLKIT.md. Aliases only, never versioned IDs or `best`.
# Change a role here and in that table together.
PLANNER_MODEL="opus"
PLANNER_EFFORT="high"
WORKER_MODEL="opus"        # effort is chosen per worker in launch_agent
SYNTHESIS_MODEL="opus"
SYNTHESIS_EFFORT="high"

CURRENT_STATE_FILE="${PROJECT_DIR}/docs/agent_context/CURRENT_STATE.md"
COLLAB_FILE="${PROJECT_DIR}/.claude/collab.json"

# Resolved by check_dependencies. Windows installs Python as `python` with no
# `python3` alias, so the interpreter is looked up rather than hardcoded.
PYTHON=""

# Collaboration defaults — overridden by .claude/collab.json when it exists.
# See docs/general_docs/COLLABORATION.md.
COLLAB_ENABLED="true"
INTEGRATION_BRANCH="main"
BRANCH_PATTERN="{user}/{task}-{slug}"
ADHOC_PREFIX="fix"
MERGE_STRATEGY="github-pr"
PROTECTED_BRANCHES="main"
WORK_BRANCH=""

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================================
# Helpers
# ============================================================================

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }
log_header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}\n"; }

check_dependencies() {
    local missing=()
    command -v claude >/dev/null 2>&1 || missing+=("claude")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    # The backlog lives in GitHub Issues — gh is required for every backlog read.
    command -v gh >/dev/null 2>&1 || missing+=("gh")

    # `python3` on Windows resolves to the Microsoft Store stub, which exits
    # non-zero — probe the interpreter rather than trusting the name to exist.
    local candidate
    for candidate in python3 python; do
        if command -v "${candidate}" >/dev/null 2>&1 \
            && "${candidate}" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
            PYTHON="${candidate}"
            break
        fi
    done
    [[ -n "${PYTHON}" ]] || missing+=("python3")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing[*]}"
        log_error "See PREREQUISITES.md for installation instructions."
        exit 1
    fi
}

usage() {
    cat <<EOF
${BOLD}Task Dispatcher${NC}

Usage:
  $(basename "$0") [OPTIONS] "<task-id-or-description>"

Examples:
  $(basename "$0") 123
      # Runs the backlog task in GitHub issue #123

  $(basename "$0") "Fix the race condition in session refresh logic"
      # Treats input as an ad-hoc bug fix — logs to EXECUTION_LOG_BUGFIX.md

Options:
  --plan-only                  Generate the plan but don't execute
  --dispatch-only              Execute workers from an existing plan file
  --synthesis-only             Re-run the close-out synthesis phase only
  --skip-onboarding-check      Bypass the onboarding gate (use with care)
  --no-branch                  Skip the branch pre-flight and work on the current branch
  --max-agents N               Maximum parallel agents (default: 5)
  --timeout N                  Per-agent timeout in seconds (default: 600)
  --plan-file PATH             Plan file to write and read (default: .tasks/plan.json)
  --summary-file PATH          Summary the synthesis phase writes (default: .tasks/summary.md)
  --planner-prompt PATH        Planner prompt template (default: this skill's scripts/planner-prompt.md)
  -h, --help                   Show this help message

Environment variables:
  AGENT_TIMEOUT                Per-agent timeout in seconds (default: 600)
  MAX_AGENTS                   Maximum parallel agents (default: 5)
  PLAN_FILE                    Same as --plan-file
  SUMMARY_FILE                 Same as --summary-file
  PLANNER_PROMPT               Same as --planner-prompt
  LOGS_DIR                     Worker and phase logs (default: .tasks/logs)
  STATUS_FILE                  Per-worker status map (default: .tasks/status.json)

A sibling skill reusing this orchestrator overrides PLAN_FILE, SUMMARY_FILE and
PLANNER_PROMPT. LOGS_DIR and STATUS_FILE follow PLAN_FILE's directory unless set
explicitly, so those three overrides fully isolate a sibling's run.

The close-out commits on the contributor branch, never on a protected one. It
never pushes, rebases, merges or opens a pull request: review the summary, then
run the merge-back sequence it proposes, or ask the session to.
EOF
    exit 0
}

# ============================================================================
# Onboarding gate
# ============================================================================

check_onboarding_complete() {
    if [[ ! -f "${CURRENT_STATE_FILE}" ]]; then
        log_error "Cannot find ${CURRENT_STATE_FILE}."
        log_error "Is this a project built from the AI-assisted project template?"
        exit 1
    fi

    # Robust onboarding detection — inspect CURRENT_STATE.md and verify:
    #   1. "Active phase:" has a non-placeholder value (does not start with "[")
    #   2. "Active execution log:" points at a file path that exists on disk
    # This is more reliable than string-matching scaffold placeholders, which
    # can false-positive on legitimate content that happens to contain similar text.
    # rc is captured with || so the heredoc's non-zero exits survive set -e —
    # otherwise the case statement below is dead code and the gate dies silently.
    local rc=0
    "${PYTHON}" - "${CURRENT_STATE_FILE}" "${PROJECT_DIR}" <<'PYEOF' || rc=$?
import os, re, sys

current_state_path, project_dir = sys.argv[1], sys.argv[2]

with open(current_state_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The queries block below the divider quotes placeholder-like text — only the
# state fields above the first divider count.
current_state = content.split('\n---', 1)[0]

# Look for Active phase line
phase_match = re.search(r'\*\*Active phase:\*\*\s*(.+?)(?:\n|$)', current_state)
if not phase_match:
    sys.stderr.write("CURRENT_STATE.md is missing the Active phase line\n")
    sys.exit(2)
phase_value = phase_match.group(1).strip()

# Placeholder detection: starts with "[" or contains "e.g." → scaffold
if phase_value.startswith('[') or 'e.g.' in phase_value.lower():
    sys.exit(3)

# Look for Active execution log line
log_match = re.search(r'\*\*Active execution log:\*\*\s*(.+?)(?:\n|$)', current_state)
if not log_match:
    sys.stderr.write("CURRENT_STATE.md is missing the Active execution log line\n")
    sys.exit(2)
log_value = log_match.group(1).strip()

# Placeholder detection for log line
if log_value.startswith('[') or 'e.g.' in log_value.lower():
    sys.exit(3)

# Extract the path from backticks if present
path_match = re.search(r'`([^`]+)`', log_value)
log_path = path_match.group(1) if path_match else log_value

# Verify the log file actually exists
full_log_path = os.path.join(project_dir, log_path)
if not os.path.isfile(full_log_path):
    sys.stderr.write(f"Active execution log points at {log_path} but that file does not exist\n")
    sys.exit(4)

sys.exit(0)
PYEOF

    case ${rc} in
        0)
            log_info "Onboarding check passed."
            ;;
        2)
            log_error "CURRENT_STATE.md is malformed."
            log_error "Run docs/agent_context/ONBOARDING.md to regenerate it, or fix the format manually."
            exit 1
            ;;
        3)
            log_error "Onboarding has not been run."
            log_error ""
            log_error "docs/agent_context/CURRENT_STATE.md still contains scaffold"
            log_error "placeholders. The task-dispatcher skill requires populated"
            log_error "context documents."
            log_error ""
            log_error "Run docs/agent_context/ONBOARDING.md first, then return."
            exit 1
            ;;
        4)
            log_error "Onboarding appears incomplete."
            log_error "The Active execution log referenced in CURRENT_STATE.md does not exist on disk."
            log_error "Either onboarding did not finish, or the log file has been moved/deleted."
            exit 1
            ;;
        *)
            log_error "Onboarding check failed unexpectedly (exit code ${rc})."
            exit 1
            ;;
    esac

    # The backlog lives in GitHub Issues — an unauthenticated gh cannot read it.
    if ! gh auth status >/dev/null 2>&1; then
        log_error "gh CLI is not authenticated. Run 'gh auth login' first —"
        log_error "the task backlog lives in GitHub Issues."
        exit 1
    fi
}

# ============================================================================
# Branch pre-flight
#
# Work never lands on a protected branch. Runs after the onboarding gate and
# before planning, so a failure costs nothing. See docs/general_docs/COLLABORATION.md.
# ============================================================================

load_collab_config() {
    if [[ ! -f "${COLLAB_FILE}" ]]; then
        log_warn "No .claude/collab.json found — branch pre-flight will protect '${INTEGRATION_BRANCH}' only."
        return
    fi

    COLLAB_ENABLED=$(jq -r '.enabled // true' "${COLLAB_FILE}")
    INTEGRATION_BRANCH=$(jq -r '.integrationBranch // "main"' "${COLLAB_FILE}")
    BRANCH_PATTERN=$(jq -r '.branchPattern // "{user}/{task}-{slug}"' "${COLLAB_FILE}")
    ADHOC_PREFIX=$(jq -r '.adhocPrefix // "fix"' "${COLLAB_FILE}")
    MERGE_STRATEGY=$(jq -r '.mergeStrategy // "github-pr"' "${COLLAB_FILE}")
    PROTECTED_BRANCHES=$(jq -r '((.protectedBranches // ["main"]) + [.integrationBranch, .releaseBranch] | map(select(. != null)) | unique | join(" "))' "${COLLAB_FILE}")
}

is_protected_branch() {
    local candidate="$1"
    local b
    for b in ${PROTECTED_BRANCHES}; do
        [[ "${candidate}" == "${b}" ]] && return 0
    done
    return 1
}

# Prefers the Branch section already recorded in the issue body by intake, so the
# branch, the issue and the pull request all carry the same number. Falls back
# to the configured pattern when there is no issue (ad-hoc path) or no section.
derive_branch_name() {
    local task_input="$1"

    "${PYTHON}" - "${task_input}" "${BRANCH_PATTERN}" "${ADHOC_PREFIX}" <<'PYEOF'
import json, re, subprocess, sys

task_input, pattern, adhoc_prefix = sys.argv[1:4]

FILLER = {'the', 'a', 'an', 'in', 'on', 'of', 'to', 'and', 'for', 'with', 'that'}

def slugify(text, words=5, drop=None):
    parts = re.sub(r'[^a-z0-9]+', ' ', text.lower()).split()
    # A description that opens with the prefix word ("Fix the race condition")
    # would otherwise produce `fix-fix-the-race-condition`.
    if drop and parts and parts[0] == drop:
        parts = parts[1:]
    parts = parts[:words]
    while parts and parts[-1] in FILLER:
        parts.pop()
    return '-'.join(parts)

issue_match = re.fullmatch(r'#?(\d+)', task_input.strip())
issue_num = issue_match.group(1) if issue_match else None

# An intake-assigned Branch section in the issue body wins outright.
if issue_num:
    try:
        out = subprocess.run(
            ['gh', 'issue', 'view', issue_num, '--json', 'title,body'],
            capture_output=True, text=True, check=True).stdout
        data = json.loads(out)
        body = data.get('body') or ''
        section = re.search(r'^##\s*Branch\s*\n(.*?)(?=^##\s|\Z)',
                            body, re.MULTILINE | re.DOTALL)
        if section:
            sec_text = section.group(1).strip()
            # An unfilled Branch section is the template's bracketed placeholder,
            # which contains backticked spans of its own — reject the whole
            # section, not just a bracketed name.
            if not sec_text.startswith('['):
                field = re.search(r'`([^`\n]+)`', sec_text)
                if field:
                    name = field.group(1).strip()
                    if name:
                        print(name)
                        sys.exit(0)
        slug = slugify(data.get('title') or '')
    except Exception:
        # Unreadable issue — the number alone names the branch.
        slug = ''
else:
    slug = slugify(task_input, drop=adhoc_prefix)

try:
    user = subprocess.run(['git', 'config', 'user.name'], capture_output=True,
                          text=True, check=True).stdout.strip()
except Exception:
    user = ''
user = re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', user.lower())) or 'work'

name = (pattern.replace('{user}', user)
               .replace('{task}', issue_num if issue_num else adhoc_prefix)
               .replace('{slug}', slug or 'change'))
# An empty slug leaves a trailing separator behind — git accepts it, humans notice.
print(re.sub(r'-+$', '', name) if slug else re.sub(r'-change$', '', name))
PYEOF
}

# The assignee is the claim — checked and then set before any work, so
# concurrent sessions skip a claimed issue. Also refuses closed, blocked and
# unworkable issues: an epic is never dispatched, and a ticket with open
# sub-issues is worked through its subtasks (docs/general_docs/TASK_HIERARCHY.md).
# Runs before the branch pre-flight, so a refusal here costs nothing — no branch
# has been cut yet. See the TASK TRACKER section of AGENTS.md.
claim_issue() {
    local issue_num="$1"
    local info state assignees me open_blockers type_name has_epic_label open_subs

    info=$(gh issue view "${issue_num}" --json state,assignees,blockedBy,issueType,labels,subIssuesSummary 2>/dev/null) || {
        log_error "Cannot read issue #${issue_num} — check the number and 'gh auth status'."
        exit 1
    }

    state=$(echo "${info}" | jq -r '.state')
    if [[ "${state}" != "OPEN" ]]; then
        log_error "Issue #${issue_num} is ${state} — dispatch requires an open issue."
        exit 1
    fi

    # The label is the fallback where org issue types are not configured.
    type_name=$(echo "${info}" | jq -r '.issueType.name // ""')
    has_epic_label=$(echo "${info}" | jq -r '[.labels[]?.name] | index("epic") != null')
    if [[ "${type_name}" == "Epic" || "${has_epic_label}" == "true" ]]; then
        log_error "Issue #${issue_num} is an epic — epics are never dispatched."
        log_error "Work its tickets instead: gh issue view ${issue_num} --json subIssues --jq '.subIssues[] | \"#\\(.number) \\(.title) (\\(.state))\"'"
        log_error "or run the frontier query in docs/agent_context/CURRENT_STATE.md."
        exit 1
    fi

    open_subs=$(echo "${info}" | jq -r '(.subIssuesSummary.total // 0) - (.subIssuesSummary.completed // 0)')
    if [[ "${open_subs}" != "0" ]]; then
        log_error "Issue #${issue_num} has ${open_subs} open sub-issue(s) — the subtasks are the work."
        log_error "Dispatch a subtask instead: gh issue view ${issue_num} --json subIssues --jq '.subIssues[] | \"#\\(.number) \\(.title) (\\(.state))\"'"
        exit 1
    fi

    # blockedBy is an object carrying .nodes and .totalCount, not a bare array —
    # an array-shaped filter silently matches nothing and blocked issues dispatch.
    open_blockers=$(echo "${info}" | jq -r '[.blockedBy.nodes[]? | select(.state == "OPEN") | "#\(.number)"] | join(", ")' 2>/dev/null || echo "")
    if [[ -n "${open_blockers}" ]]; then
        log_error "Issue #${issue_num} is blocked by open issue(s): ${open_blockers}."
        log_error "Work the frontier — dispatch a blocker first, or remove the dependency."
        exit 1
    fi

    assignees=$(echo "${info}" | jq -r '.assignees[]?.login')
    me=$(gh api user --jq .login 2>/dev/null || echo "")
    if [[ -n "${assignees}" ]] && ! grep -qxF "${me}" <<<"${assignees}"; then
        log_error "Issue #${issue_num} is already claimed by: ${assignees//$'\n'/, }."
        log_error "The assignee is the claim — another session may be working on it. If the"
        log_error "claim is stale: gh issue edit ${issue_num} --remove-assignee <login>, then re-run."
        exit 1
    fi

    if gh issue edit "${issue_num}" --add-assignee "@me" >/dev/null 2>&1; then
        log_success "Claimed issue #${issue_num} (assignee is the claim)."
    else
        log_warn "Could not assign @me on issue #${issue_num} — continuing, but another session may pick it up."
    fi
}

branch_preflight() {
    local task_input="$1"

    load_collab_config

    if [[ "${COLLAB_ENABLED}" != "true" ]]; then
        log_warn "Collaboration guard disabled in .claude/collab.json — skipping branch pre-flight."
        return
    fi

    if ! git -C "${PROJECT_DIR}" rev-parse --git-dir >/dev/null 2>&1; then
        log_warn "Not a git repository — skipping branch pre-flight."
        return
    fi

    local current
    current=$(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    if [[ -n "${current}" && "${current}" != "HEAD" ]] && ! is_protected_branch "${current}"; then
        WORK_BRANCH="${current}"
        log_success "Working on branch '${WORK_BRANCH}'."
        return
    fi

    # On a protected branch — the work needs a branch of its own before anything
    # is written. Uncommitted changes would be carried across, so stop instead.
    if [[ -n "$(git -C "${PROJECT_DIR}" status --porcelain)" ]]; then
        log_error "HEAD is '${current}', which is protected, and the working tree is dirty."
        log_error "Commit or stash the current changes, then re-run — the pre-flight will"
        log_error "not move uncommitted work onto a new branch on your behalf."
        exit 1
    fi

    WORK_BRANCH=$(derive_branch_name "${task_input}")
    if [[ -z "${WORK_BRANCH}" ]]; then
        log_error "Could not derive a branch name for '${task_input}'."
        exit 1
    fi

    log_info "HEAD is '${current}' (protected). Cutting '${WORK_BRANCH}' from '${INTEGRATION_BRANCH}'."

    if git -C "${PROJECT_DIR}" remote get-url origin >/dev/null 2>&1; then
        git -C "${PROJECT_DIR}" fetch origin --prune --quiet || log_warn "git fetch failed — continuing with the local ref."
    fi

    git -C "${PROJECT_DIR}" checkout --quiet "${INTEGRATION_BRANCH}" || {
        log_error "Cannot check out '${INTEGRATION_BRANCH}'."
        exit 1
    }

    if git -C "${PROJECT_DIR}" rev-parse --verify --quiet "origin/${INTEGRATION_BRANCH}" >/dev/null 2>&1; then
        git -C "${PROJECT_DIR}" merge --ff-only --quiet "origin/${INTEGRATION_BRANCH}" || {
            log_error "'${INTEGRATION_BRANCH}' has diverged from origin and cannot fast-forward."
            log_error "Reconcile it manually, then re-run."
            exit 1
        }
    fi

    if git -C "${PROJECT_DIR}" rev-parse --verify --quiet "${WORK_BRANCH}" >/dev/null 2>&1; then
        git -C "${PROJECT_DIR}" checkout --quiet "${WORK_BRANCH}"
        log_success "Resumed existing branch '${WORK_BRANCH}'."
    else
        git -C "${PROJECT_DIR}" checkout --quiet -b "${WORK_BRANCH}"
        log_success "Created branch '${WORK_BRANCH}' from '${INTEGRATION_BRANCH}'."
    fi
}

# ============================================================================
# Phase 1 — Plan
# ============================================================================

generate_plan() {
    local task_input="$1"

    log_header "PHASE 1: PLANNING"
    log_info "Input: ${task_input}"

    mkdir -p "${TASKS_DIR}" "${LOGS_DIR}"

    # Get project tree (limited depth to keep context manageable)
    # head's early exit sends find SIGPIPE under pipefail — guard it so the
    # fallback text never gets appended after real entries.
    local project_tree
    project_tree=$({ find . -maxdepth 3 \
        -not -path './.git/*' \
        -not -path './node_modules/*' \
        -not -path './.tasks/*' \
        -not -path './__pycache__/*' \
        -not -path './venv/*' \
        -not -path './.venv/*' \
        -not -path './.next/*' \
        2>/dev/null || true; } | head -100)
    [[ -n "${project_tree}" ]] || project_tree="(empty project)"

    # The planner runs with Read/Glob/Grep only — it cannot call gh itself, so
    # the issue is fetched here and injected into the prompt. "null" on the
    # ad-hoc path.
    local task_issue_json="null"
    if [[ "${task_input}" =~ ^#?[0-9]+$ ]]; then
        local issue_num="${task_input#\#}"
        task_issue_json=$(gh issue view "${issue_num}" \
            --json number,title,body,labels,milestone,assignees,state,blockedBy 2>/dev/null) || {
            log_error "Cannot read issue #${issue_num} — check the number and 'gh auth status'."
            exit 1
        }
    fi

    # Build the planner prompt from template using Python for safe substitution
    # (bash string substitution breaks on special characters in the input).
    # The values go in on stdin, NUL-separated, never as arguments: Windows caps
    # a command line at 32,767 characters, and the project tree or the issue
    # JSON alone can pass that. Bytes are UTF-8 both ways so non-Latin text in
    # an issue survives Python's Windows defaults.
    local planner_prompt
    planner_prompt=$(printf '%s\0' "${task_input}" "${PROJECT_DIR}" "${MAX_AGENTS}" "${project_tree}" "${task_issue_json}" \
        | "${PYTHON}" -c "
import sys
fields = sys.stdin.buffer.read().decode('utf-8').split('\0')
task_input, project_dir, max_agents, project_tree, task_issue_json = fields[:5]
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    tmpl = f.read()
tmpl = tmpl.replace('{{TASK_INPUT}}', task_input)
tmpl = tmpl.replace('{{PROJECT_DIR}}', project_dir)
tmpl = tmpl.replace('{{MAX_AGENTS}}', max_agents)
tmpl = tmpl.replace('{{PROJECT_TREE}}', project_tree)
tmpl = tmpl.replace('{{TASK_ISSUE_JSON}}', task_issue_json)
sys.stdout.buffer.write(tmpl.encode('utf-8'))
" "${PLANNER_PROMPT}")

    log_info "Calling planner agent..."

    # Every prompt reaches claude on stdin for the same 32,767-character reason.
    local planner_output
    if ! planner_output=$(printf '%s' "${planner_prompt}" | claude -p \
        --model "${PLANNER_MODEL}" --effort "${PLANNER_EFFORT}" \
        --allowedTools "Read,Glob,Grep" \
        --output-format json \
        2>"${LOGS_DIR}/planner-stderr.log"); then
        log_error "Planner agent failed. Check ${LOGS_DIR}/planner-stderr.log"
        exit 1
    fi

    # Extract the text result from Claude's JSON output
    local plan_json
    plan_json=$(echo "${planner_output}" | jq -r '.result // empty' 2>/dev/null || echo "${planner_output}")

    # Strip any markdown code fences that might have slipped through
    plan_json=$(echo "${plan_json}" | sed 's/^```json//; s/^```//; s/```$//' | sed '/^$/d')

    # Validate JSON
    if ! echo "${plan_json}" | jq . >/dev/null 2>&1; then
        log_error "Planner did not produce valid JSON."
        log_error "Raw output saved to ${LOGS_DIR}/planner-raw.log"
        echo "${planner_output}" > "${LOGS_DIR}/planner-raw.log"
        exit 1
    fi

    # Validate structure
    local agent_count
    agent_count=$(echo "${plan_json}" | jq '.agents | length')
    if [[ "${agent_count}" -lt 1 ]]; then
        log_error "Plan contains no agents."
        exit 1
    fi

    # Validate close_out block
    if ! echo "${plan_json}" | jq -e '.close_out.log_file' >/dev/null 2>&1; then
        log_error "Plan is missing close_out.log_file."
        exit 1
    fi

    validate_plan_deps "${plan_json}"

    echo "${plan_json}" | jq . > "${PLAN_FILE}"

    local summary path task_id
    summary=$(echo "${plan_json}" | jq -r '.task_summary')
    path=$(echo "${plan_json}" | jq -r '.path')
    task_id=$(echo "${plan_json}" | jq -r '.task_id // "none"')

    log_success "Plan generated."
    log_info "Summary: ${summary}"
    log_info "Path: ${path} (task ID: ${task_id})"
    log_info "Agents: ${agent_count}"
    echo ""
    echo "${plan_json}" | jq -r '.agents[] | "  Agent \(.id): \(.name) [complexity: \(.estimated_complexity)] [depends_on: \(.depends_on | if length == 0 then "none" else map(tostring) | join(", ") end)]"'
    echo ""
}

# Stops the run before any worker starts if the plan's dependencies cannot be
# satisfied. An unknown id would otherwise crash the dispatch loop on an
# unbound variable, after the workers it could start were already running.
validate_plan_deps() {
    local plan_json="$1"
    local unknown
    unknown=$(check_unknown_deps "${plan_json}") || {
        log_error "Plan depends on agents it does not define:"
        printf '%s\n' "${unknown}" | sed 's/^/    /'
        log_error "Fix the plan's depends_on lists, then rerun. No worker has started."
        exit 1
    }
    if ! check_circular_deps "${plan_json}"; then
        log_error "Circular dependency detected in plan. Aborting."
        exit 1
    fi
}

# Prints one line per depends_on id that matches no agent, and fails if any do.
# Ids are compared as strings, the way dispatch_agents reads them.
check_unknown_deps() {
    local plan_json="$1"
    printf '%s' "${plan_json}" | "${PYTHON}" -c "
import json, sys
plan = json.load(sys.stdin)
ids = {str(a['id']) for a in plan['agents']}
bad = [
    'Agent %s (%s) depends on %s, which is not in the plan (agents: %s)'
    % (a['id'], a.get('name', '?'), dep, ', '.join(sorted(ids)))
    for a in plan['agents'] for dep in a.get('depends_on', [])
    if str(dep) not in ids
]
print('\n'.join(bad))
sys.exit(1 if bad else 0)
"
}

check_circular_deps() {
    local plan_json="$1"
    # The plan goes in via stdin — interpolating it into Python source corrupts
    # the escape sequences inside worker prompts and fails every parse.
    printf '%s' "${plan_json}" | "${PYTHON}" -c "
import json, sys
plan = json.load(sys.stdin)
agents = {a['id']: a.get('depends_on', []) for a in plan['agents']}
visited = set()
in_stack = set()
def has_cycle(node):
    if node in in_stack: return True
    if node in visited: return False
    visited.add(node); in_stack.add(node)
    for dep in agents.get(node, []):
        if has_cycle(dep): return True
    in_stack.remove(node)
    return False
for agent_id in agents:
    if has_cycle(agent_id): sys.exit(1)
sys.exit(0)
"
}

# ============================================================================
# Phase 2 — Dispatch
# ============================================================================

dispatch_agents() {
    log_header "PHASE 2: DISPATCHING WORKERS"

    if [[ ! -f "${PLAN_FILE}" ]]; then
        log_error "No plan found at ${PLAN_FILE}. Run planning first."
        exit 1
    fi

    local plan_json
    plan_json=$(cat "${PLAN_FILE}")

    # --dispatch-only reads a plan that may have been edited since planning.
    validate_plan_deps "${plan_json}"

    local agent_count
    agent_count=$(echo "${plan_json}" | jq '.agents | length')

    declare -A agent_status
    declare -A agent_pids
    declare -A agent_names

    for i in $(seq 0 $((agent_count - 1))); do
        local agent_id agent_name
        agent_id=$(echo "${plan_json}" | jq -r ".agents[${i}].id")
        agent_name=$(echo "${plan_json}" | jq -r ".agents[${i}].name")
        agent_status[${agent_id}]="pending"
        agent_names[${agent_id}]="${agent_name}"
    done

    local completed=0

    while [[ ${completed} -lt ${agent_count} ]]; do
        for i in $(seq 0 $((agent_count - 1))); do
            local agent_id
            agent_id=$(echo "${plan_json}" | jq -r ".agents[${i}].id")

            if [[ "${agent_status[${agent_id}]}" != "pending" ]]; then
                continue
            fi

            local deps_met=true
            local deps
            deps=$(echo "${plan_json}" | jq -r ".agents[${i}].depends_on[]" 2>/dev/null || true)

            for dep in ${deps}; do
                if [[ "${agent_status[${dep}]}" == "failed" ]]; then
                    log_error "Agent ${agent_id} (${agent_names[${agent_id}]}) cannot run: dependency ${dep} failed."
                    agent_status[${agent_id}]="failed"
                    # ((completed++)) returns 1 when completed is 0 and set -e
                    # kills the run — use plain arithmetic assignment.
                    completed=$((completed + 1))
                    deps_met=false
                    break
                elif [[ "${agent_status[${dep}]}" != "done" ]]; then
                    deps_met=false
                    break
                fi
            done

            if [[ "${deps_met}" == true && "${agent_status[${agent_id}]}" == "pending" ]]; then
                launch_agent "${plan_json}" "${i}" "${agent_id}"
                agent_status[${agent_id}]="running"
            fi
        done

        for agent_id in "${!agent_pids[@]}"; do
            local pid="${agent_pids[${agent_id}]}"

            if ! kill -0 "${pid}" 2>/dev/null; then
                # Capture without tripping set -e — a failed worker is recorded
                # and reported, never allowed to kill the orchestrator.
                local exit_code=0
                wait "${pid}" 2>/dev/null || exit_code=$?

                if [[ ${exit_code} -eq 0 ]]; then
                    agent_status[${agent_id}]="done"
                    log_success "Worker ${agent_id} (${agent_names[${agent_id}]}) completed."
                else
                    agent_status[${agent_id}]="failed"
                    log_error "Worker ${agent_id} (${agent_names[${agent_id}]}) failed with exit code ${exit_code}."
                fi

                unset "agent_pids[${agent_id}]"
                completed=$((completed + 1))
            fi
        done

        if [[ ${completed} -lt ${agent_count} ]]; then
            sleep 2
        fi
    done

    # Persist status for the synthesis phase
    echo "{" > "${STATUS_FILE}"
    local first=true
    for agent_id in $(echo "${plan_json}" | jq -r '.agents[].id'); do
        if [[ "${first}" == true ]]; then
            first=false
        else
            echo "," >> "${STATUS_FILE}"
        fi
        echo "  \"${agent_id}\": \"${agent_status[${agent_id}]}\"" >> "${STATUS_FILE}"
    done
    echo "}" >> "${STATUS_FILE}"

    log_info "All workers finished."
}

launch_agent() {
    local plan_json="$1"
    local index="$2"
    local agent_id="$3"

    local agent_name agent_prompt allowed_tools
    agent_name=$(echo "${plan_json}" | jq -r ".agents[${index}].name")
    agent_prompt=$(echo "${plan_json}" | jq -r ".agents[${index}].prompt")
    allowed_tools=$(echo "${plan_json}" | jq -r ".agents[${index}].allowedTools // \"Read,Edit,Write,Bash\"")

    # Bug fixes (the ad-hoc path) and work the planner rates high complexity
    # run at high effort. Well-scoped work runs at medium.
    local worker_effort="medium"
    if [[ "$(echo "${plan_json}" | jq -r '.path')" == "adhoc" ]] \
        || [[ "$(echo "${plan_json}" | jq -r ".agents[${index}].estimated_complexity")" == "high" ]]; then
        worker_effort="high"
    fi

    local log_file="${LOGS_DIR}/agent-${agent_id}-${agent_name}.log"

    log_info "Launching Worker ${agent_id}: ${agent_name} (${WORKER_MODEL}, ${worker_effort} effort)"

    (
        printf '%s' "${agent_prompt}" | timeout "${AGENT_TIMEOUT}" claude -p \
            --model "${WORKER_MODEL}" --effort "${worker_effort}" \
            --allowedTools "${allowed_tools}" \
            2>&1
    ) > "${log_file}" 2>&1 &

    agent_pids[${agent_id}]=$!
}

# ============================================================================
# Phase 3 — Synthesis & close-out
# ============================================================================

run_synthesis() {
    log_header "PHASE 3: SYNTHESIS & CLOSE-OUT"

    if [[ ! -f "${PLAN_FILE}" ]]; then
        log_error "No plan found at ${PLAN_FILE}."
        exit 1
    fi

    local plan_json
    plan_json=$(cat "${PLAN_FILE}")

    local path task_summary task_id log_file update_tracker commit_prefix commit_subject
    path=$(echo "${plan_json}" | jq -r '.path')
    task_summary=$(echo "${plan_json}" | jq -r '.task_summary')
    # task_id and commit_subject tolerate both documented plan shapes — the
    # planner duplicates task_id at top level and inside close_out.
    task_id=$(echo "${plan_json}" | jq -r '.close_out.task_id // .task_id // "null"')
    log_file=$(echo "${plan_json}" | jq -r '.close_out.log_file')
    update_tracker=$(echo "${plan_json}" | jq -r '.close_out.update_tracker')
    commit_prefix=$(echo "${plan_json}" | jq -r '.close_out.commit_prefix')
    commit_subject=$(echo "${plan_json}" | jq -r '.close_out.commit_subject // .task_summary')

    # The commit rule in AGENTS.md: commit on a contributor branch, never on a
    # protected one. --no-branch can leave HEAD on a protected branch.
    local head_branch may_commit="no"
    head_branch=$(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ -n "${head_branch}" && "${head_branch}" != "HEAD" ]] && ! is_protected_branch "${head_branch}"; then
        may_commit="yes"
    fi

    # Build status table for summary
    local status_rows=""
    local all_passed=true
    local agent_count
    agent_count=$(echo "${plan_json}" | jq '.agents | length')

    for i in $(seq 0 $((agent_count - 1))); do
        local agent_id agent_name status
        agent_id=$(echo "${plan_json}" | jq -r ".agents[${i}].id")
        agent_name=$(echo "${plan_json}" | jq -r ".agents[${i}].name")
        status=$(jq -r ".\"${agent_id}\"" "${STATUS_FILE}" 2>/dev/null || echo "unknown")

        local icon="✅"
        if [[ "${status}" != "done" ]]; then
            icon="❌"
            all_passed=false
        fi
        status_rows="${status_rows}- ${icon} Worker ${agent_id} (${agent_name}): ${status}\n"
    done

    # Compose the synthesis prompt — this agent does the Agent Session Protocol close-out
    local synthesis_prompt="You are the synthesis agent for the task-dispatcher skill. All worker agents have finished. Your job is to run the close-out checklist in docs/general_docs/CLOSE_OUT.md.

Context:
- Path: ${path}
- Task summary: ${task_summary}
- Issue number: ${task_id}
- Target log file: ${log_file}
- Update tracker: ${update_tracker}
- Proposed commit prefix: ${commit_prefix}
- Proposed commit subject: ${commit_subject}
- Working branch: ${WORK_BRANCH:-unknown}
- Integration branch: ${INTEGRATION_BRANCH}
- Merge strategy: ${MERGE_STRATEGY}
- May commit on this branch: ${may_commit}

Worker statuses:
${status_rows}

Worker logs are in ${LOGS_DIR}/ — read them if you need to understand what was done.

Your tasks:

1. Read the relevant worker logs to understand what files were created, modified, or deleted.

2. Run verification checks from the project root:
   - pnpm tsc --noEmit (or the project's equivalent type check)
   - pnpm lint (or the project's equivalent linter)
   Record whether each passed or failed.

3. Read docs/general_docs/CLOSE_OUT.md and work through its 'After every task' steps 1 to 9
   for this run. Steps 10 and 11 (commit and report) are steps 4 and 5 below. For this run:
   - Execution log: write the entry to ${log_file}. Phase comes from the log file name, or
     'Bugfix' for adhoc. Its Git commit field is the proposed commit subject below if 'May
     commit on this branch' is yes (the entry is part of that commit), otherwise 'Not yet
     committed'.
   - The issue steps run only if update_tracker is true. Post the comment with
       gh issue comment ${task_id} --body-file <a temp file you write>
     Do NOT close the issue, and do NOT edit its assignees or labels.
   - Never edit AGENTS.md or CLAUDE.md. Note any change they need in the summary for the developer to approve.
   - Estimate calibration: skip it. The developer's session holds the estimate.
   - If unsure whether scope changed, flag it in the summary instead of guessing.

4. Commit, per the commit rule in AGENTS.md (Collaborative working). If 'May commit on
   this branch' is yes: stage only the files the workers and you changed in this run, by
   path, never with git add -A or git add . (anything else in the tree is not this task's
   work, so list it in the summary instead). Check the staged diff for real data, .env*
   files and secrets; if you find any, unstage it, do not commit, and flag it. Then commit
   with the proposed commit message below, written to a temp file and passed with
   git commit -F. Prefix the subject with 'wip: ' if any worker failed or a check in
   step 2 failed. If 'May commit on this branch' is no, do not commit, and say why in the
   summary.
   Never push, rebase, merge, or open a pull request: those wait for the developer's yes.
   You propose them in the summary. Read-only git commands are fine.

4a. Report how the working branch stands against the integration branch. Run:
      git fetch origin --prune
      git rev-list --left-right --count origin/${INTEGRATION_BRANCH}...HEAD
   The first number is how many commits the branch is behind. If it is non-zero, say
   so prominently in the summary — the branch needs rebasing before the pull request,
   and that is where conflicts will surface. If there is no origin remote, say that
   instead and skip this step.

5. Write a summary to ${SUMMARY_FILE} with:
   - What was done (one short paragraph)
   - Worker status table
   - Files changed (created / modified / deleted, grouped)
   - Verification results (type check, lint, any task-specific checks)
   - Any decisions appended to DECISIONS.md
   - Any SCOPE.md updates made, or scope questions flagged for the developer
   - Any USER_JOURNEYS.md updates made
   - Any AGENTS.md change the work needs, proposed for the developer to approve
   - A 'Proposed commit message' section with exactly this format:
       \`\`\`
       ${commit_prefix}: ${commit_subject}

       [optional body — brief bullet list of key changes]

       [blank line]

       [if task_id is not null:] Refs #${task_id}
       \`\`\`
   - A 'Merge back' section giving the exact sequence for the developer to run, in
     this order, on branch ${WORK_BRANCH:-the current branch}:
       1. The commit from step 4, by hash, or the commit still to make if step 4 could not
       2. git fetch origin && git rebase origin/${INTEGRATION_BRANCH}
       3. pnpm test   — and pnpm test:e2e if a user-facing flow changed
       4. If the commits touch code: security gate G2 (docs/general_docs/SECURITY.md §4) —
          run /security-review in Claude Code on the unpushed commits, before pushing
       5. git push -u origin ${WORK_BRANCH:-<branch>}
       6. If the merge strategy is 'github-pr':
            gh pr create --base ${INTEGRATION_BRANCH} --head ${WORK_BRANCH:-<branch>} --title \"<commit subject>\" --body \"<what changed, verification results>[if task_id is not null, the body MUST contain: Closes #${task_id}]\"
          If the merge strategy is 'local-merge':
            git checkout ${INTEGRATION_BRANCH} && git merge --no-ff ${WORK_BRANCH:-<branch>}
            [if task_id is not null:] gh issue close ${task_id} --comment \"Merged on ${INTEGRATION_BRANCH}.\"
       7. Delete the branch once merged.
     Include the rebase step even when the branch is up to date — the point is that
     step 3 runs against integrated code, not against the branch in isolation.
   - A final instruction: 'Review the commit above. The merge-back sequence from step 2 on needs your yes: this skill does not push, rebase, merge or open a pull request.'

Begin."

    log_info "Running synthesis agent..."

    if ! printf '%s' "${synthesis_prompt}" | claude -p \
        --model "${SYNTHESIS_MODEL}" --effort "${SYNTHESIS_EFFORT}" \
        --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
        2>"${LOGS_DIR}/synthesis-stderr.log" > "${LOGS_DIR}/synthesis-stdout.log"; then
        log_error "Synthesis agent failed. Check ${LOGS_DIR}/synthesis-stderr.log"
        log_warn "The worker output is still intact — you may need to finalise the close-out manually."
        exit 1
    fi

    log_success "Synthesis complete."

    if [[ "${all_passed}" == true ]]; then
        log_success "All workers completed successfully."
    else
        log_warn "Some workers failed. Check ${SUMMARY_FILE} for details."
    fi

    log_info ""
    log_info "Summary: ${SUMMARY_FILE}"
    log_info "Branch:  ${WORK_BRANCH:-unknown} → ${INTEGRATION_BRANCH} (${MERGE_STRATEGY})"
    log_info ""
    log_info "Review the summary, then run the merge-back sequence it proposes."
    log_info "This skill commits on the contributor branch only. It does not push, rebase or merge."
}

# ============================================================================
# Main
# ============================================================================

main() {
    local plan_only=false
    local dispatch_only=false
    local synthesis_only=false
    local skip_onboarding=false
    local skip_branch=false
    local task_input=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --plan-only)             plan_only=true; shift ;;
            --dispatch-only)         dispatch_only=true; shift ;;
            --synthesis-only)        synthesis_only=true; shift ;;
            --skip-onboarding-check) skip_onboarding=true; shift ;;
            --no-branch)             skip_branch=true; shift ;;
            --max-agents)            MAX_AGENTS="$2"; shift 2 ;;
            --timeout)               AGENT_TIMEOUT="$2"; shift 2 ;;
            --plan-file)             PLAN_FILE="$2"; shift 2 ;;
            --summary-file)          SUMMARY_FILE="$2"; shift 2 ;;
            --planner-prompt)        PLANNER_PROMPT="$2"; shift 2 ;;
            -h|--help)               usage ;;
            *)                       task_input="$1"; shift ;;
        esac
    done

    check_dependencies

    log_header "TASK DISPATCHER"
    log_info "Project: ${PROJECT_DIR}"

    if [[ "${skip_onboarding}" != true ]]; then
        check_onboarding_complete
    else
        log_warn "Skipping onboarding check (--skip-onboarding-check)"
    fi

    # Resuming a run mid-way: adopt whatever branch the earlier phases left us on,
    # rather than cutting a second branch for the same piece of work. Workers
    # still run headless, so the guard must block rather than ask here too.
    if [[ "${synthesis_only}" == true || "${dispatch_only}" == true ]]; then
        load_collab_config
        WORK_BRANCH=$(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
        export COLLAB_GUARD_MODE="block"
    fi

    if [[ "${synthesis_only}" == true ]]; then
        run_synthesis
        return
    fi

    if [[ "${dispatch_only}" == true ]]; then
        dispatch_agents
        run_synthesis
        return
    fi

    if [[ -z "${task_input}" ]]; then
        log_error "No issue number or description provided."
        usage
    fi

    # Backlog path — validate and claim the issue before the branch pre-flight
    # cuts anything, so a closed, blocked or already-claimed issue costs
    # nothing. --plan-only is an inspection run and must not mutate tracker
    # state, so it never claims.
    if [[ "${task_input}" =~ ^#?[0-9]+$ ]]; then
        if [[ "${plan_only}" == true ]]; then
            log_info "Plan-only run — issue #${task_input#\#} is not claimed."
        else
            claim_issue "${task_input#\#}"
        fi
    fi

    if [[ "${skip_branch}" != true ]]; then
        branch_preflight "${task_input}"
        # Workers and the synthesis agent run headless, where the guard's "ask"
        # cannot be answered. The pre-flight has already put them on a contributor
        # branch, so a hard block is the right failure mode if anything slips.
        export COLLAB_GUARD_MODE="block"
    else
        load_collab_config
        log_warn "Skipping branch pre-flight (--no-branch)"
        # An explicit opt-out is an explicit opt-out — do not have the guard
        # deny the workers the developer just told the pre-flight to skip.
        export COLLAB_GUARD="off"
        WORK_BRANCH=$(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    fi

    generate_plan "${task_input}"

    if [[ "${plan_only}" == true ]]; then
        log_info "Plan saved to ${PLAN_FILE}"
        log_info "Run with --dispatch-only to execute."
        return
    fi

    dispatch_agents
    run_synthesis
}

main "$@"
