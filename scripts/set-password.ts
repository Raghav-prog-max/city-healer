/**
 * Set a new password on an email account (Firebase Authentication), for example when someone
 * is locked out and cannot use "forgot password".
 *
 *   npm run set-password -- --email <address> --password <new password>
 *   add --emulators to work on the local emulators (npm run dev must be running)
 *
 * Phone-only accounts have no password; they sign in with a code.
 */
import { parseArgs, loadFirebase } from "./firebase-cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email || "").trim().toLowerCase();
  const password = String(args.password || "");
  if (!email || password.length < 8) {
    console.error("Usage: npm run set-password -- --email <address> --password <at least 8 characters>");
    process.exit(1);
  }
  if (password.toLowerCase() === email) {
    console.error("Choose a password that is not the email address.");
    process.exit(1);
  }
  const { adminAuth } = await loadFirebase(args);
  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.updateUser(user.uid, { password });
  await adminAuth.revokeRefreshTokens(user.uid);
  console.log(`Password set for ${email}. Existing sessions were signed out.`);
}

main().catch((err) => { console.error(err?.message || err); process.exitCode = 1; });
