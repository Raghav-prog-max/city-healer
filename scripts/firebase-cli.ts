/**
 * Shared set-up for the account CLIs (set-role, set-password, migrate-users).
 *
 * With --emulators the scripts talk to the local Firebase emulators started by `npm run dev`
 * (which must be running). Without it they use the real project from FIREBASE_PROJECT_ID and
 * Application Default Credentials, exactly like the server. See FIREBASE_SETUP.md.
 */
import "../env";

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

/** Point the Admin SDK at the emulators when asked, then load it. */
export async function loadFirebase(args: Record<string, string | boolean>) {
  if (args.emulators) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";
    process.env.GCLOUD_PROJECT ||= "demo-city-healer";
  }
  const admin = await import("../server/firebase/admin");
  const problem = admin.firebaseConfigProblem();
  if (problem) {
    console.error(problem);
    console.error("Add --emulators to use the local emulators (with `npm run dev` running).");
    process.exit(1);
  }
  console.log(admin.usingEmulators ? `Firebase emulators (project ${admin.firebaseProjectId})` : `Firebase project ${admin.firebaseProjectId}`);
  return admin;
}
