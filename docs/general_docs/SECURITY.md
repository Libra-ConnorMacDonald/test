# Security Standard

> **Portable.** This file is the same in every project built from the template. Project-specific
> security rules live in `AGENTS.md` Critical Patterns and `DECISIONS.md`; §11 points to them.
> Read the section the task touches (§0). Never read the whole file for a task that touches one area.
>
> Every rule below traces to a defect a real audit found.

---

## 0. When to read what

| The task touches | Read |
|---|---|
| An API route or server action (new or changed) | §2, §3.1, §5.4 |
| Auth, sessions, sign-out, roles, middleware | §2, §3.2, §5.3 |
| Database reads or writes of user data | §2 rules 2–4, §3.3 |
| File upload, object storage, media URLs | §3.4, §5.7 |
| An AI model call | §3.5, §5.10 |
| A public (unauthenticated) route, share link, feed, webhook, cron | §3.6 |
| Client storage, service worker, PWA, push | §3.7, §5.8 |
| Security headers, CSP, `next.config`, middleware matcher | §3.8, §5.1, §5.2 |
| Adding or upgrading a dependency; CI; GitHub settings | §6 |
| Error handling or logging anywhere | §5.6 |
| Secrets, tokens, encryption, signing | §5.9 |
| **About to push, open or merge a PR, or release** | **§4 (gates)** |
| Preparing for a pen test or a full audit | §8, §9 |

---

## 1. The standard

- **OWASP ASVS 5.0** is the checklist. **Level 1** for every app; **Level 2** for any app that holds
  accounts plus personal, health, financial or location data. The level is recorded in §11.
- Cross-check against the **OWASP Top 10 (2025)**, the **API Security Top 10 (2023)** and the
  **Top 10 for LLM Applications (2025)**. Broken object-level authorisation is #1 on the API list.
- **UK GDPR:** health data is special-category data. It needs explicit consent, a DPIA, and erasure that
  reaches every copy (rule 11).

---

## 2. The rules

Each one is a "never". If a task needs to break one, stop and ask.

1. **The server decides who the user is.** Take identity from the session alone, never from a body,
   query, param or header the client controls.
2. **Every object is authorised in the query that touches it.** `user_id = <session user>` goes in the
   WHERE of every SELECT, UPDATE and DELETE, even after a separate ownership check. A check followed by
   `where(eq(table.id, id))` is one refactor away from an IDOR.
3. **Validate at the boundary.** Body, query and path params go through a strict schema (Zod, unknown
   keys stripped). Ids are validated as UUIDs, so a bad id is a 404 and not a 500. Never spread a request
   body into an insert or update.
4. **Parameterised queries only.** Never build SQL from input (`sql.raw`, string concatenation,
   identifiers from input).
5. **Deny by default.** A new route is authenticated unless it is listed as public. Every public route
   authenticates itself: a signed token, a webhook signature, or a secret compared in constant time.
6. **State never changes on GET.** Mutating routes check `Origin` / `Sec-Fetch-Site` (§5.4). A GET that
   writes, or spends money on a model call, can be triggered by a link.
7. **Per-user responses are never cached:** `Cache-Control: private, no-store`. Nothing per-user goes
   through a CDN, a service worker cache, or a public `immutable` default (Next's `ImageResponse` is one).
8. **Errors tell the client nothing and the logs no data.** The client gets a generic message and a code.
   Logs get the error's name and code, never its message. ORM errors embed the query's bound values (§5.6).
9. **Secrets are server-only and fail closed.** Validate presence AND shape (length, encoding) at boot.
   Never fall back to plaintext. Use one key per purpose. Never put a secret in a `NEXT_PUBLIC_` variable
   or in git.
10. **Uploads are bound and verified.** The server generates the key. The content type is in the
    signature and is checked again by magic bytes after upload. User files are served from a separate
    registrable domain, never a subdomain of the app's.
11. **Retraction reaches every copy.** Revoke, delete and erasure cover the database, object storage, CDN
    caches, the device (IndexedDB, Cache Storage, push subscriptions), and third-party tokens (revoke
    OAuth at the provider). Never report "deleted" while a copy is still served.
12. **Model output is untrusted input.** It is schema-validated before any write, never placed in HTML,
    a URL or SQL, and its tools act only for the session user. Every model route is under a per-user
    spend cap.
13. **The server fetches only fixed hosts.** Any URL or endpoint a user supplies (a webhook, a push
    endpoint, an image URL) goes through a host allowlist, or it is a server-side request forgery.
14. **Send the least data.** The client, the model, the logs and the URL get only the fields they need.
    Health data never goes in a query string.
15. **Patch fast.** A critical or high advisory reachable in the app is fixed within a week. Automated
    dependency updates are on.

---

## 3. Per-task checklist (the Self-Verify step)

Run the block for each area the task touched. Each item is a yes/no question.

### 3.1 API route
- [ ] The handler gets the user itself (no reliance on middleware alone), and returns 401 when there is none.
- [ ] Every id is validated, and every query and mutation carries `user_id` (rule 2). A child row is
      reached through its parent's ownership.
- [ ] The body is parsed by a strict schema, with lengths and numeric ranges bounded.
- [ ] GET reads only. A mutating method is rate-limited, and AI routes are spend-capped.
- [ ] Per-user responses send `private, no-store`.
- [ ] Error paths return a generic message and log `safeErr(e)` only.
- [ ] The response returns only the fields the client uses: no internal ids of other users, and no tokens.

### 3.2 Auth, session, roles
- [ ] Roles come from server-only metadata (Clerk `publicMetadata`, mapped in the session-token template),
      never from anything the user can write (`unsafeMetadata`).
- [ ] Every way a session ends runs the same device wipe (§5.8): the sign-out button, a provider
      component, "sign in again", expiry, and remote revoke detected on the next load.
- [ ] Forbidden routes return 403, never a redirect. Where the gate sits: Where Role Gates Sit in
      `docs/agent_context/ROUTING.md`.

### 3.3 Data
- [ ] A new user-scoped table is added to the erasure routine AND the export, in foreign-key order.
- [ ] Shared tables (library rows, generated content) never reference another user's private rows.
      Pools that feed shared rows filter to global and verified rows.
- [ ] Derived values are not stored. Immutable records have no update path.

### 3.4 Files and storage
- [ ] The key is server-generated: `<prefix>/<userId>/<uuid>.<ext>`. A key the client sends back is
      checked as one segment under the caller's own prefix, with no `..`.
- [ ] The presigned PUT signs `content-type` (§5.7). After upload, the type and size are checked (HEAD),
      and anything going public is checked by magic bytes, with its type set from an allowlist.
- [ ] Reads are presigned only for keys from rows the caller owns. Expiry is minutes, not days.
- [ ] Delete removes every copy (private, public, cache) before reporting success. A failed delete is a 502.

### 3.5 AI call
- [ ] It runs server-side only, and the SDK is never imported into a client component.
- [ ] It is under the per-user spend cap, including routes that run before the user's database row exists.
- [ ] The output is schema-validated before any write, with a retry once and then a user-facing error.
- [ ] Usage is recorded the moment the call returns. The prompt and the reply are never logged.
- [ ] Text one user generates that other users will see (shared rows) stays private to its author until
      reviewed.

### 3.6 Public surface
- [ ] The route is listed as public deliberately, and authenticates itself (rule 5).
- [ ] Tokens are HMAC-signed with a per-purpose key, compared in constant time, and carry an expiry and a
      type the verifier pins. They carry only whitelisted display fields, never a private key or a
      client-supplied identity.
- [ ] Its caching matches its revocation: anything revocable is `no-store`, or tagged and purged on revoke.
- [ ] Cron and webhook secrets are required at boot and compared in constant time. A webhook signature is
      verified on the raw body before the body is used.

### 3.7 Client storage, PWA, push
- [ ] The service worker caches no per-user response. Only the static precache and the offline page.
- [ ] Anything stored on the device carries its owner's id and an expiry, and renders only for that owner.
- [ ] Sign-out unsubscribes push, and deletes the server row, before the session ends.
- [ ] `notificationclick` opens same-origin paths only.

### 3.8 Headers, CSP, middleware
- [ ] Baseline headers present (§5.1). The CSP has no `'unsafe-eval'` and no wildcard host.
- [ ] Middleware matcher exclusions are anchored (`$`) and add nothing beyond the auth provider's default.
- [ ] Verified on a preview deploy with the browser console open: zero CSP violations.

---

## 4. Security gates

| Gate | When | What runs | Who |
|---|---|---|---|
| **G1 — Task** | Every task, in Self-Verify | §3 for the areas touched | Claude |
| **G2 — Pre-push / pre-merge** | Before pushing commits that touch code, before opening a PR, before merging any branch | `/security-review` on the unpushed commits; `pnpm audit --prod --audit-level=high`; every Medium+ finding fixed, or filed with its reason and named in the push request | Claude; the developer says push |
| **G3 — Pre-release** | Before the first production deploy and before each release | A full-repo audit (§8); the dependency audit; a header scan of the preview (securityheaders.com, the [MDN HTTP Observatory](https://developer.mozilla.org/en-US/observatory)); an OWASP ZAP baseline scan of the preview; the §5.1 baseline re-checked; a secrets scan | Claude runs and fixes; the developer says release |
| **G4 — Pre-pen-test** | Before a pen test is booked | G3 plus the §9 pack | Both |

**Who decides.** Security work runs end to end without stopping for the developer. Claude:
- takes the roadmap's recommendation, or its own, at every choice inside a step, records the choice and the
  option it passed over in `DECISIONS.md`, and carries on;
- fixes every finding it can within the step, and files the rest with its reason and score;
- runs every gate, test, mutation test, review and passive scan (header scans, a ZAP baseline against a
  preview) without asking;
- runs a one-off script on the development database after a dry run and with a backup, never on production;
- changes a preview environment's setting when a check needs it, and tells any peer sessions; never
  production's;
- writes the Critical Pattern lines a step needs into `AGENTS.md`, as part of the step. This is one of
  the two exceptions to the rule that `AGENTS.md` changes wait for the developer's
  approval (`CLOSE_OUT.md`, "Changing AGENTS.md").

It asks the developer only two things:
1. **To push or merge.** The request is one message: what changed, every gate and its result, each choice
   Claude made on its own with the option it passed over, anything filed, and any `AGENTS.md` lines it wrote.
2. **A decision that changes the whole app:**
   - it changes what users can do or see beyond the step's own screens, or removes a feature or data;
   - it breaks a §2 rule;
   - it adds a new dependency or a paid service (bumping an existing one for an advisory is not new);
   - it needs a dashboard or an account only the developer holds (the auth provider, production hosting,
     GitHub settings, a domain). Where the step can go on without it, the dashboard task goes on the launch
     checklist rather than stopping the step.

**G2 scope:** anything under `app/`, `lib/`, `components/`, `db/`, `worker/`, `scripts/`, `.github/` or
`.claude/` (hooks, permissions and skills steer what runs on every developer's machine), plus `.mcp.json`,
`middleware.ts` (`proxy.ts` from Next.js 16), `next.config.*`, `package.json`, the lockfile, `vercel.json`
and `public/sw*`. A project
with other code folders (a native app, `packages/`) adds them here. Docs-only and test-only commits are exempt.
The hook below holds the same list: keep the two in step.

**How `/security-review` sees the change.** It reviews the branch's commits that are not yet on its
upstream. Run it **after committing and before pushing**: once the commits are pushed, it sees nothing.
Arguments widen its scope, which is how a full audit is run (§8).

**Enforcing G2.** Use three layers:
1. **The rule:** `AGENTS.md` points here (§10).
2. **A hook:** `.claude/hooks/security-gate.mjs`, a `PreToolUse` hook on git and gh commands run through
   Bash or PowerShell. It keeps code in G2's scope from leaving the machine, or being merged, before a
   recorded review covers it:
   - When `/security-review` leaves nothing unresolved, Claude records it with
     `node .claude/hooks/security-gate.mjs reviewed` (HEAD, or a branch or commit named after it). The record
     lives in the repository's git directory, is shared by all its worktrees and never reaches a commit. A
     review covers its commit and everything before it.
   - A push or merge must be a command on its own, in a plain form the gate reads in full:
     `git push [-u] [<remote> [<branch>...]]` (also with `--force-with-lease`, `--follow-tags`,
     `--dry-run` or `--delete`), `git merge [--no-ff|--ff-only|--squash|--no-edit] <ref>...` (or
     `--abort`, `--continue`) and
     `gh pr merge [<number>] [--merge|--squash|--rebase|--delete-branch]`, each optionally with
     `git -C <path>`. One chained to other commands, wrapped in another, or with other options or refspecs
     is **denied** with these forms, so shell syntax cannot hide what is sent, and so is a git or gh
     subcommand built at run time (`git $SUB`). Text that only mentions a push or merge passes; a commit
     message that does goes in a file or, in Bash, a quoted heredoc run as a command on its own.
   - A push is judged on what it names, or HEAD, against what the destination already has of its default
     branch, the integration branch (`.claude/collab.json`) and the branch itself. The gate asks the URL
     the push goes to (`git ls-remote`) rather than trusting `refs/remotes`, which anything on the machine
     can rewrite; if the destination has commits not fetched here, it says to fetch first. A merge is
     judged on what it brings in that HEAD and the shared branches lack, and a pull-request merge on the
     pull request's own commits against the base commit GitHub reports, both fetched locally. Code someone
     else pushed to another branch still counts. If any of those commits touch G2's scope (renames count
     by their old path, merge resolutions are included) and no recorded review covers them, the command
     is **denied** and the reason tells Claude what to run. The developer is never asked. Docs-only and
     test-only work passes.
   - `gh api` may read anything, and write only to issues, labels and milestones. A git alias, included
     config or gh alias set on the command line is refused, since it could push or merge unseen.
   - If the gate itself fails, it shows a hook error and lets the command run. So does a hook that runs
     out of time, so the gate denies once it has used 25 seconds, inside the hook's 30 second
     timeout. A slow machine needs that room: one `git ls-remote` can take several seconds. From
     Claude Code 2.1.295 the gate's entries in `.claude/settings.json` can add `"onFailure": "block"`.

   The record is Claude's own attestation: it replaces a click, not the review. The gate guards against
   mistakes, not a determined attempt to get round it: aliases already in a git or gh config, scripts and
   pushes made by hand are not seen, and the CI action below stays the independent check. The command is
   judged in the session's current folder or its `git -C <path>`, so a push from a worktree is judged on
   that worktree. `.claude/hooks/test/security-gate.test.mjs` covers these cases against a scratch
   repository with a bare remote.
3. **CI:** the `anthropics/claude-code-security-review` GitHub Action on every PR. It needs an
   `ANTHROPIC_API_KEY` repository secret.

```json
"PreToolUse": [{ "matcher": "Bash|PowerShell", "hooks": [
  { "type": "command", "if": "Bash(*git*)", "command": "node",
    "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/security-gate.mjs"], "timeout": 30 },
  { "type": "command", "if": "Bash(*gh*)", "command": "node",
    "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/security-gate.mjs"], "timeout": 30 },
  { "type": "command", "if": "PowerShell(*git*)", "command": "node",
    "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/security-gate.mjs"], "timeout": 30 },
  { "type": "command", "if": "PowerShell(*gh*)", "command": "node",
    "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/security-gate.mjs"], "timeout": 30 }
] }]
```

`command` plus `args` runs Node with no shell, so the hook starts from any subfolder and on Windows
without Git Bash. Each `if` holds one rule, hence four handlers. The filters match `git` or `gh` anywhere
in the command, so they are never narrower than what the gate looks for: wrapped forms (`bash -c 'git
push'`, `env git push`, `cmd /c git push`), `git.exe`, `$(which git) push` and a quoted full path all reach
it. Unrelated commands that contain `git` or `gh` (a path, `github`, `high`) also start the gate, and so
does a PowerShell command Claude Code cannot parse; the gate exits straight away unless the command runs
a push, a merge or a `gh api` write, or sets an alias.

---

## 5. Baselines (Next.js App Router)

### 5.1 Headers (`next.config.ts`)
```ts
poweredByHeader: false,
async headers() {
  return [
    { source: '/:path*', headers: [
      { key: 'Content-Security-Policy', value: csp },          // §5.2
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }, // add `preload` only after auditing every subdomain
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' }, // grant (self) only to what the app uses
    ] },
    { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
  ]
}
```
Routes that are deliberately cacheable (non-revocable public images) set their own `Cache-Control`.
**Check the precedence on a preview:** whether a route's own header wins over the config's.

### 5.2 CSP
- Use a **nonce with `'strict-dynamic'`**, set per request in middleware. Never `'unsafe-eval'`; use
  `'wasm-unsafe-eval'` if WebAssembly needs it. `'unsafe-inline'` on `style-src` only.
- No wildcard hosts (e.g. `https://*.r2.cloudflarestorage.com` matches every Cloudflare customer's bucket):
  pin the account.
- `object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`.
- A `report-to` / `report-uri` endpoint, so violations are seen.
- Keep a static fallback CSP for any path the middleware matcher skips.
- Roll out on a **preview** first: auth sign-in end to end, the main pages, and every special path
  (wasm, workers, third-party frames), with zero console violations.

### 5.3 Middleware and auth (Clerk)
- `clerkMiddleware(handler, { authorizedParties: [APP_URL] })`.
- Keep the public route list short and commented. Each entry names how that route authenticates itself.
- Use Clerk's default matcher. Don't add extensions to its exclusions; if you must, anchor them with `$`.
- **CSRF backstop** for cookie-authenticated mutations:
```ts
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
if (req.nextUrl.pathname.startsWith('/api/') && UNSAFE.has(req.method) && !isMachineRoute(req)) { // webhooks, cron, other machine callers
  const site = req.headers.get('sec-fetch-site')
  const origin = req.headers.get('origin')
  if ((site && site !== 'same-origin' && site !== 'none') || (origin && origin !== APP_ORIGIN)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

### 5.4 Route skeleton
```ts
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const limited = await checkRateLimit(user.id, 'mutation')
  if (limited) return limited
  const parsed = Schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', fields: parsed.error.issues.map((i) => i.path.join('.')) }, { status: 400 })
  }
  try {
    const [row] = await db.update(things).set(parsed.data)
      .where(and(eq(things.id, id), eq(things.user_id, user.id)))   // rule 2: in the mutation itself
      .returning({ id: things.id })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error('[things.patch]', safeErr(e))                      // §5.6: never String(e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

### 5.5 Cookies
Let the auth provider own the session cookie. Any cookie of your own (an OAuth `state` nonce, for
example) is `HttpOnly; Secure; SameSite=Lax` (or `Strict`), scoped to its path, and short-lived.

### 5.6 Logging
```ts
// One helper, used at every catch. Drizzle's DrizzleQueryError message is
// "Failed query: …\nparams: <every bound value>", and Next logs an uncaught route error whole,
// so String(e), e.message, e.stack and console.error(e) all leak the row being written.
export function safeErr(e: unknown): { name: string; code?: string } {
  const err = e as { name?: unknown; code?: unknown; cause?: { code?: unknown } } | null
  const code = typeof err?.cause?.code === 'string' ? err.cause.code : typeof err?.code === 'string' ? err.code : undefined
  return { name: typeof err?.name === 'string' ? err.name : 'Error', ...(code ? { code } : {}) }
}
```
- Every route that writes personal data catches its own errors. Never let the framework log them.
- Log events, counts, ids and status codes. Never bodies, prompts, model replies, tokens or field values.
- `JSON.parse` errors quote the input: log the name only.
- A structural test that fails on `String(e)` / `console.error(e)` near a database call keeps the rule held.

### 5.7 Object storage (S3-compatible, e.g. Cloudflare R2)
```ts
const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: type }), {
  expiresIn: 300,
  signableHeaders: new Set(['content-type']),   // the AWS presigner leaves content-type unsigned by default
})
```
- After upload: HEAD it and check `ContentType` and `ContentLength`. Anything copied to a public bucket
  is checked by magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF…WEBP`), and its
  `ContentType` is set from the allowlist, never copied from the source.
- The public bucket lives on its own registrable domain. Add response headers there:
  `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox; default-src 'none'`.
- The private bucket is never public. Reads are presigned for minutes.

### 5.8 PWA and the device
- The service worker has no storing `runtimeCaching` rule over per-user pages or APIs. With a
  `next-pwa`-style plugin, set `cacheStartUrl: false`.
- **One device-wipe function** (Cache Storage, app localStorage keys, IndexedDB, the push subscription
  plus its server row). It runs before every sign-out path, and on load when the stored owner doesn't
  match the session.
- Offline snapshots store the owner's id and a hard maximum age, no longer than the session lifetime.

### 5.9 Secrets, tokens, crypto
- An env schema with shapes: `z.string().min(32)` for signing and cron secrets, and a 32-byte decoded
  check for encryption keys. Required in production; never a fallback.
- Per-purpose keys: derive with HMAC or HKDF (`HMAC(master, 'share-card')`, `HMAC(master, 'ics')`), so
  one verifier can never accept another's token.
- AES-256-GCM with a random 96-bit IV per write, and **AAD binding the row and field**
  (`cipher.setAAD(Buffer.from(\`${userId}:${field}\`))`).
- Device and API tokens: 256-bit random values, stored as SHA-256 only, revocable, never returned after
  creation.
- Format changes (AAD, key derivation) are free before launch or before a fresh-start migration. After
  launch they need a dual-read migration.

### 5.10 LLM features
- Tools return data, or actions the user taps. A tool never writes on the model's say-so.
- Hrefs built from model output are relative and match `/^\/(?!\/)/`. React blocks `javascript:` URLs;
  don't rely on it.
- Content that crosses users (shared generated rows) is a cross-tenant prompt-injection channel: keep it
  out of other users' prompts until reviewed.

---

## 6. Dependencies, CI and supply chain

- `pnpm audit --prod --audit-level=high` in CI, on the working branch as well as on PRs.
- **Dependabot** (`.github/dependabot.yml`) for `npm` and `github-actions`, weekly.
- Build-only tools (`shadcn`, PWA plugins, devtools) go in `devDependencies`, so the production audit
  shows only what runs.
- **Install scripts:** pnpm 10 blocks them by default. On pnpm 9, set an `onlyBuiltDependencies`
  allowlist (`sharp`, `esbuild`, `@tailwindcss/oxide`, …).
- A committed lockfile; `--frozen-lockfile` in CI.
- **Workflows:** pin actions to a commit SHA, give each workflow `permissions: contents: read` (or `{}`),
  never use `pull_request_target` with a checkout of the PR, and print only HTTP codes from
  scheduled jobs.
- **GitHub settings:** secret scanning and push protection on. A `gitleaks` step in CI.
- `.gitignore`: `.env*` with `!.env.example`, Playwright auth state, reports, agent working files
  (`.tasks/`, `/.claude/prompts`).
- **Dev servers bind to localhost:** `next dev -H localhost`, never `-H 127.0.0.1`. Next's server hands
  each request on to `localhost`, which on Windows resolves to `::1`. A server bound to `127.0.0.1` then
  answers every page with a 500. Advisories have shipped that are reachable only through an exposed dev
  server. Open it to the LAN only for a device check, and close it after.

---

## 7. Tools — what to use when

| Tool | Kind | Use it for |
|---|---|---|
| `/security-review` | Built into Claude Code | **G2** on every push or PR. With arguments, a full audit (§8) |
| **Security Guidance** (Anthropic) | Plugin: hooks | Install at **user** scope so every project gets warnings as code is written, plus a review on Stop |
| **claude-security** (Anthropic) | Plugin | **G3** deep scan before a release, with verified findings and proposed patches |
| **securitymaxxing**, **OWASP Security Audit** | Community plugins | Focused passes (`/threat-model`, `/api`, `/llm`, OWASP Top 10). Read their hooks and permissions before installing |
| `anthropics/claude-code-security-review` | GitHub Action | Every PR, inline comments |
| `/code-review ultra` | Claude Code (cloud) | A deep multi-agent branch review. Started by the developer, billed |
| `vercel:vercel-firewall` skill | Skill | WAF rules, bot protection, rate limits at the edge (the DoS layer code review skips) |
| `pnpm audit`, Dependabot, `gitleaks` | CLI / GitHub | Dependencies and secrets, in CI |
| Semgrep or CodeQL | SAST | CI, a second opinion to the LLM review |
| OWASP ZAP baseline | DAST | **G3**, against a preview, passive. The active scan belongs to the pen test (G4) |
| securityheaders.com, MDN HTTP Observatory | Header scan | **G3**, against a preview |

Plugin names are as of 2026-10; check the directory for current ones.

---

## 8. Running a full audit

The method:

1. **Run in parallel, read-only, one agent per slice:**
   - the HTTP edge (headers, CSP, middleware, service worker, CI);
   - the API routes, in halves (authentication, IDOR, mass assignment, validation);
   - public token surfaces and integrations (signing, webhooks, cron, OAuth, SSRF);
   - storage, uploads and erasure;
   - AI, logging and client-side sinks;
   - dependencies, secrets and git history.
2. **Each agent returns three sections:** vulnerabilities; hardening gaps; what it checked and found sound.
3. **An independent agent re-checks every candidate vulnerability** against the false-positive rules and
   scores it 1–10. **Only scores of 8 or more are reported as vulnerabilities.** The rest are listed with
   their scores, so nothing is lost.
4. **Save it** in `docs/agent_context/` as a dated audit file, with finding ids, and point §11 at it. The
   fixes become task issues that cite those ids.

---

## 9. Pen-test readiness (G4)

- **Done first:**
  - G3 passed;
  - every Medium+ finding closed;
  - CSP nonce live;
  - `no-store` on the API;
  - Origin checks;
  - upload types bound;
  - no `X-Powered-By`;
  - dependencies current.
- **Give the testers:**
  - a staging environment that matches production;
  - two test accounts per role (for IDOR testing);
  - the public route list (§11);
  - the object-storage public domain in scope;
  - the rate limits, so they don't mistake them for outages.
- **Expect them to test:**
  - IDOR across the two accounts;
  - auth and session handling (fixation, logout, expiry);
  - headers and CSP;
  - CSRF;
  - file upload (type, size, served content type);
  - caching of authenticated responses;
  - error leakage;
  - rate limits;
  - SSRF through any URL field;
  - dependency versions;
  - TLS;
  - subdomain takeover;
  - cloud storage settings.
- **Paperwork:** the DPIA (health data), the processor list, data-flow notes, the incident contact, and a
  `/.well-known/security.txt`.

---

## 10. Adopting this file in a project

A project built from the template already has steps 2–5 and 7, and the parts of step 6 the template ships
(Dependabot, the `.gitignore` lines, and the CI workflow's `permissions:` and audit step). It fills in §11
during onboarding. The full list is for a project that predates this file.

1. Copy this file to `docs/general_docs/SECURITY.md`. Fill in §11.
2. Add to `AGENTS.md` (or, where the project has no `AGENTS.md`, its `CLAUDE.md`), in five places:
   - **The header**, the rule for changing the file, copied from the template's `AGENTS.md`. It names the
     security exception.
   - **AGENT SESSION PROTOCOL → 6. Task-specific standards**, a new bullet:
     `- docs/general_docs/SECURITY.md — any task touching auth, API routes, user data, uploads, AI calls, public routes, client storage, headers/config, dependencies or CI; and §4 before every push, PR or merge`
   - **TASK EXECUTION PROTOCOL → 3. Self-Verify**, a new block:
     `*Security:* run SECURITY.md §3 for each area the task touched (G1). Before pushing commits that touch code, run /security-review on them (G2, SECURITY.md §4).`
   - **SECURITY** (the section), one line under the heading:
     `Full standard, checklists and gates: docs/general_docs/SECURITY.md. Read the section §0 names for the task.`
     and under it:
     `Security work runs end to end without asking: the developer is asked only to push or merge, or for a decision that changes the whole app (SECURITY.md §4, "Who decides").`
   - **Critical Patterns:** project rules that refine this file (e.g. a "sensitive data never logged" pattern) point back to its section.
   `docs/general_docs/CLOSE_OUT.md` carries the rest: G2 in "Before the session ends", and the security
   exception in "Changing AGENTS.md". Copy it from the template if the project has none.
3. **`docs/general_docs/ENGINEERING_STANDARDS.md` → Documentation Hierarchy**, a new row:
   `| docs/general_docs/SECURITY.md | Security standard, per-task checklists, push/merge/release gates | Reference: read the section the task touches; §4 before every push |`
4. **`docs/agent_context/ONBOARDING.md` → Section 7, Part B (Critical Patterns)**, a new question: *"What
   data does the app hold (personal, health, financial, location)? → the ASVS level, the public routes and
   how each authenticates itself, recorded in SECURITY.md §11."* Add §11 to its post-generation checklist.
5. **`docs/general_docs/COLLABORATION.md` → Lifecycle, 5. Propose**, a new line: *"If the commits touch
   code, run G2 (SECURITY.md §4) before pushing."*
6. **Repo files:**
   - `.github/dependabot.yml`
   - in `ci.yml`: an audit step, the working branch on `push`, `permissions:`, and actions pinned to SHAs
   - a gitleaks step
   - the security-review action
   - `.gitignore` `.env*` / `!.env.example`
   - in `package.json`: `onlyBuiltDependencies`, and `dev` bound to localhost (`next dev -H localhost`,
     keeping any port flag; never `-H 127.0.0.1`, see §6)
   - `next.config.ts` with the §5.1 baseline
7. **The G2 hook (§4):** copy `.claude/hooks/security-gate.mjs`, and merge its `PreToolUse` entry into
   `.claude/settings.json` without replacing the hooks already there. Adjust its `IN_SCOPE` list to the
   project's folders.
8. **Once per developer machine:** install the Security Guidance plugin at **user** scope (§7).

> Copying this file to another project: keep §0–§10 as they are, blank §11, and fill it in during onboarding.

---

## 11. This project

> Project-specific. Blank in the template. Filled during onboarding (`ONBOARDING.md` Section 7, Part B).

- **App:** [name and one line on what it does]. **ASVS Level [1 or 2]:** [why: the data it holds, e.g.
  accounts only, or accounts plus personal, health, financial or location data]
- **Project rules that refine this file** (`AGENTS.md` Critical Patterns, by number):
  - [pattern number] ([what it covers], [the rule or § it refines])
- **Public routes** (the middleware's public route list), and how each authenticates itself:

  | Route | Authenticates by |
  |---|---|
  | [route] | [signed token, webhook signature, secret compared in constant time, or static] |
- **Last audit:** [file, or "none yet"]
- **Open security work:** [file, or the epic holding the fixes]
