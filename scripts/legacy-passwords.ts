/**
 * bcrypt check used by scripts/migrate-users.ts (Milestone 4: A13).
 *
 * The retired sign-in stored bcrypt hashes in SQLite. Some accounts had a password derived
 * from their email ("google-sso-<email>") or a shared default; those must not be carried
 * into Firebase. bcrypt.compare re-hashes each candidate with the salt and cost stored in the
 * hash, so this costs about 2^cost hash rounds per candidate - slow on purpose.
 */
import bcrypt from "bcryptjs";

export const legacyPasswordCandidates = (email: string) => ["google-pass-123", `google-sso-${String(email || "").toLowerCase().trim()}`];

/** True when the stored bcrypt hash is of a password derived from the email (or the shared default). */
export async function hasLegacyDerivedPassword(email: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  for (const p of legacyPasswordCandidates(email)) {
    if (await bcrypt.compare(p, hash)) return true;
  }
  return false;
}
