/**
 * Which Firebase a frontend build was compiled for, and whether that is fit to ship (P0.4).
 *
 * Vite bakes the VITE_FIREBASE_* values into the frontend at build time. A build that picked
 * up a developer's .env.local (VITE_FIREBASE_EMULATORS=true) produces a site that tries to
 * sign in against emulators on the visitor's own machine: nobody can sign in. Three guards
 * share the rules here:
 *
 *   build    vite.config.ts refuses a release build (CITY_HEALER_RELEASE_BUILD=true, set by the
 *            Dockerfile) that is in emulator mode or lacks the web config;
 *   record   every build writes dist/build-info.json saying what it was compiled for;
 *   start    the production server reads that file and refuses to serve a frontend built for
 *            emulators, or for a different Firebase project than the server verifies tokens for.
 */
export const BUILD_INFO_FILE = "build-info.json";

export interface BuildInfo {
  firebaseEmulators: boolean;
  firebaseProjectId: string;
}

const REQUIRED_WEB_CONFIG = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"] as const;

export function buildInfoFrom(env: Record<string, string | undefined>): BuildInfo {
  return { firebaseEmulators: env.VITE_FIREBASE_EMULATORS === "true", firebaseProjectId: env.VITE_FIREBASE_PROJECT_ID || "" };
}

/** Why this environment must not be built into a release, or [] if it may. */
export function releaseBuildProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  if (env.VITE_FIREBASE_EMULATORS === "true") {
    problems.push("VITE_FIREBASE_EMULATORS is \"true\": the frontend would sign in against local emulators. A local .env file is probably being read by the build.");
  }
  const missing = REQUIRED_WEB_CONFIG.filter((k) => !String(env[k] || "").trim());
  if (missing.length) {
    problems.push(`Missing Firebase web config: ${missing.join(", ")}. Pass them as build arguments (docker build --build-arg ..., or service variables on Railway).`);
  }
  return problems;
}

/**
 * Why a production server must not serve this frontend build, or null if it may.
 * `info` is the parsed dist/build-info.json, or null when the build did not write one.
 */
export function frontendBuildProblem(info: Partial<BuildInfo> | null, server: { usingEmulators: boolean; projectId: string }): string | null {
  if (!info) return null; // a build from before build-info.json existed: nothing to compare
  if (info.firebaseEmulators && !server.usingEmulators) {
    return "The frontend in dist/ was built with VITE_FIREBASE_EMULATORS=true, so its sign-in talks to local emulators, but this server uses a real Firebase project. Rebuild without local .env files (the Dockerfile does this) and with the VITE_FIREBASE_* web config.";
  }
  if (!info.firebaseEmulators && !server.usingEmulators && info.firebaseProjectId && server.projectId && info.firebaseProjectId !== server.projectId) {
    return `The frontend in dist/ was built for Firebase project "${info.firebaseProjectId}" but this server verifies sign-ins for "${server.projectId}". Every sign-in would be rejected. Rebuild with VITE_FIREBASE_PROJECT_ID (and the rest of the web config) for "${server.projectId}".`;
  }
  return null;
}
