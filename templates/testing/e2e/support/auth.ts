// e2e/support/auth.ts
// Role registry, test users, and storage-state locations.
// Copied from `templates/testing/` in the project template — edit freely once copied.
//
// One file owns three answers: which roles the suite signs in as, which user
// signs in as each, and where that role's saved session lives. The setup
// project writes those sessions; a spec opts into one with `test.use()`.

/**
 * Every role the E2E suite signs in as. Keep this in step with the role list in
 * `docs/agent_context/PERMISSIONS_REFERENCE.md` — adding a role here adds a
 * storage-state file, a test user, and a permission-matrix column.
 *
 * Role names are upper case to match `PERMISSIONS_REFERENCE.md` and the
 * `E2E_[ROLE]_EMAIL` environment variables.
 */
export const ROLES = ['ADMIN', 'MANAGER', 'MEMBER'] as const;

export type Role = (typeof ROLES)[number];

export type TestUserSpec = {
  role: Role;
  /**
   * Clerk suppresses all email delivery for addresses containing the
   * `+clerk_test` subaddress, so a test user never sends real mail.
   */
  email: string;
  password: string;
};

/**
 * Test users are FIXED — one per role, created by hand in the auth provider
 * before the suite is first run, each carrying its role in the provider's user
 * metadata. There is no per-run suffix: nothing in this scaffolding creates
 * users, so a generated address would name an account that has never existed
 * and every CI run would fail in the setup project.
 *
 * The consequence is that concurrent CI jobs SHARE these users. A test must
 * therefore scope its own data with a unique per-test identifier — a generated
 * reference, a timestamped name — and must never assume it is the only session
 * signed in as that account, or that a list starts empty.
 *
 * A team that needs full isolation should seed and tear down a user per run
 * through the auth provider's backend API (Clerk exposes `createUser`,
 * `replaceUserMetadata` and `deleteUser` for exactly this). That is deliberately
 * not implemented here — it adds a teardown project, a user-id ledger, and a
 * rate-limit budget that most projects do not need.
 *
 * Set `E2E_[ROLE]_EMAIL` in `.env.local` — for example `E2E_ADMIN_EMAIL`.
 *
 * This is read at MODULE scope, before any test body runs. What makes the value
 * present is the `dotenv.config()` call at the top of `playwright.config.ts`,
 * which Playwright evaluates first in every worker process. Do not move that
 * call, and do not rely on `clerkSetup({ dotenv })` to cover it — that runs far
 * too late.
 */
/**
 * Read an environment variable, treating an empty or whitespace-only value as unset.
 *
 * This is not defensive padding. `.env.example` ships every `E2E_*` key with an
 * empty value and the documented first step is `cp .env.example .env.local`, so
 * an unfilled key arrives here as `''`, not `undefined` — and `??` does not fall
 * back on an empty string. Without this, an unconfigured project signs in with an
 * empty address and Clerk fails with `No user found with email: `, which names
 * neither the variable nor the file that should have set it.
 */
function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function testEmail(role: Role): string {
  return readEnv(`E2E_${role}_EMAIL`) ?? `e2e-${role.toLowerCase()}+clerk_test@example.com`;
}

/**
 * One shared password for every test user, read from `E2E_USER_PASSWORD`.
 *
 * The Clerk path in `auth.setup.ts` signs in by email address and never uses it;
 * the commented generic fallback beside that function does.
 */
function testPassword(): string {
  return readEnv('E2E_USER_PASSWORD') ?? '';
}

export const TEST_USERS: Record<Role, TestUserSpec> = {
  ADMIN: { role: 'ADMIN', email: testEmail('ADMIN'), password: testPassword() },
  MANAGER: { role: 'MANAGER', email: testEmail('MANAGER'), password: testPassword() },
  MEMBER: { role: 'MEMBER', email: testEmail('MEMBER'), password: testPassword() },
};

/** Storage-state files live here. This directory is gitignored — it holds live sessions. */
export const AUTH_DIR = 'e2e/.auth';

/**
 * The storage-state file for a role.
 *
 * A spec opts into that role's session at file level:
 *
 *   test.use({ storageState: storageStateFor('ADMIN') });
 *
 * No Playwright project sets a default `storageState`, so a spec that does not
 * call this runs SIGNED OUT. That is deliberate — a spec which forgets to
 * declare its role fails closed rather than silently inheriting a privileged
 * session and proving nothing.
 */
export function storageStateFor(role: Role): string {
  return `${AUTH_DIR}/${role.toLowerCase()}.json`;
}
