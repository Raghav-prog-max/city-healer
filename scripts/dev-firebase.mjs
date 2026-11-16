#!/usr/bin/env node
/**
 * Run a command with the Firebase Auth and Firestore emulators alongside it.
 *
 *   node scripts/dev-firebase.mjs                 -> the dev server (tsx server.ts)
 *   node scripts/dev-firebase.mjs "npm run x"     -> any other command
 *   node scripts/dev-firebase.mjs --no-persist .. -> fresh, throwaway emulators on separate ports
 *                                                   (the server tests use this)
 *
 * The emulators are Google's local copies of Firebase sign-in and Firestore. They need no
 * Firebase project, account or billing; the project id "demo-city-healer" tells Firebase
 * this is an offline demo project. Phone sign-in codes are not sent by SMS: they appear in
 * the emulator UI (http://127.0.0.1:4000/auth) and the emulator log.
 *
 * firebase-tools sets FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST and GCLOUD_PROJECT
 * for the child command, which is how server/firebase/admin.ts knows to use the emulators.
 *
 * The Firestore emulator needs Java 11+. Set FIREBASE_JAVA_HOME (in .env.local) to a JDK if
 * the default `java` on PATH is older.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const env = { ...process.env };
if (env.FIREBASE_JAVA_HOME) {
  env.JAVA_HOME = env.FIREBASE_JAVA_HOME;
  env.PATH = `${path.join(env.FIREBASE_JAVA_HOME, "bin")}${path.delimiter}${env.PATH || env.Path || ""}`;
  env.Path = env.PATH; // Windows reads "Path"
}

const DATA_DIR = ".firebase-emulator-data";
const persist = !process.argv.includes("--no-persist");
const command = process.argv.slice(2).filter((a) => a !== "--no-persist").join(" ") || "tsx server.ts";

const args = [
  "firebase", "emulators:exec",
  "--project", "demo-city-healer",
  "--only", "auth,firestore",
];
// Throwaway runs (the server tests) use their own ports (firebase.test.json), so they can
// run while `npm run dev` is up.
if (!persist) args.push("--config", "firebase.test.json");
if (persist) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);
  // Import only if a previous run exported something.
  if (existsSync(path.join(DATA_DIR, "firebase-export-metadata.json"))) args.push("--import", DATA_DIR);
  args.push("--export-on-exit", DATA_DIR);
  // The Emulator UI (http://127.0.0.1:4000) shows accounts, profiles and phone sign-in codes.
  args.push("--ui");
}
args.push(JSON.stringify(command));

const child = spawn("npx", args, { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
