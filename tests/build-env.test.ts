/**
 * Which Firebase a frontend build is compiled for (shared/buildEnv.ts; P0.4, BUG-007): a
 * release build in emulator mode or without the web config is refused, and a production
 * server refuses to serve a frontend built for emulators or for another project.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInfoFrom, releaseBuildProblems, frontendBuildProblem } from "../shared/buildEnv";

const webConfig = {
  VITE_FIREBASE_API_KEY: "key", VITE_FIREBASE_AUTH_DOMAIN: "city-healer-prod.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "city-healer-prod", VITE_FIREBASE_APP_ID: "1:2:web:3",
};

describe("release builds", () => {
  test("a full web config with emulators off may be released", () => {
    assert.deepEqual(releaseBuildProblems({ ...webConfig, VITE_FIREBASE_EMULATORS: "false" }), []);
    assert.deepEqual(releaseBuildProblems(webConfig), []);
  });

  test("emulator mode is refused, as a local .env.local would cause", () => {
    const problems = releaseBuildProblems({ ...webConfig, VITE_FIREBASE_EMULATORS: "true" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /VITE_FIREBASE_EMULATORS/);
  });

  test("missing or blank web config is refused, naming each missing value", () => {
    const problems = releaseBuildProblems({ VITE_FIREBASE_API_KEY: "key", VITE_FIREBASE_PROJECT_ID: "  " });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID/);
    assert.ok(!problems[0].includes("VITE_FIREBASE_API_KEY"));
  });

  test("the local default (.env.local: emulators on, no web config) fails on both counts", () => {
    assert.equal(releaseBuildProblems({ VITE_FIREBASE_EMULATORS: "true" }).length, 2);
  });
});

describe("the record of what a build was compiled for", () => {
  test("build info", () => {
    assert.deepEqual(buildInfoFrom({ ...webConfig, VITE_FIREBASE_EMULATORS: "false" }), { firebaseEmulators: false, firebaseProjectId: "city-healer-prod" });
    assert.deepEqual(buildInfoFrom({ VITE_FIREBASE_EMULATORS: "true" }), { firebaseEmulators: true, firebaseProjectId: "" });
  });
});

describe("a production server checks the frontend it is about to serve", () => {
  const real = { usingEmulators: false, projectId: "city-healer-prod" };

  test("a frontend built for the same project is served", () => {
    assert.equal(frontendBuildProblem({ firebaseEmulators: false, firebaseProjectId: "city-healer-prod" }, real), null);
  });

  test("a frontend built for emulators is refused by a server on a real project", () => {
    assert.match(frontendBuildProblem({ firebaseEmulators: true, firebaseProjectId: "" }, real)!, /VITE_FIREBASE_EMULATORS=true/);
  });

  test("a frontend built for another project is refused", () => {
    assert.match(frontendBuildProblem({ firebaseEmulators: false, firebaseProjectId: "city-healer-dev" }, real)!, /city-healer-dev.*city-healer-prod/s);
  });

  test("a local production run against the emulators is allowed", () => {
    const local = { usingEmulators: true, projectId: "demo-city-healer" };
    assert.equal(frontendBuildProblem({ firebaseEmulators: true, firebaseProjectId: "" }, local), null);
  });

  test("an older build with no record is not blocked", () => {
    assert.equal(frontendBuildProblem(null, real), null);
  });
});

describe("the image build", () => {
  const dockerignore = readFileSync(".dockerignore", "utf8").split(/\r?\n/).map((l) => l.trim());
  const dockerfile = readFileSync("Dockerfile", "utf8");

  test(".dockerignore keeps every local env file out and the example in", () => {
    assert.ok(dockerignore.includes(".env"));
    assert.ok(dockerignore.includes(".env.*"));
    assert.ok(dockerignore.includes("!.env.example"));
    assert.ok(dockerignore.indexOf("!.env.example") > dockerignore.indexOf(".env.*"), "the exception must come after the rule it overrides");
  });

  test("the Dockerfile builds as a release with emulator mode off and the web config from build arguments", () => {
    assert.match(dockerfile, /VITE_FIREBASE_EMULATORS=false/);
    assert.match(dockerfile, /CITY_HEALER_RELEASE_BUILD=true/);
    for (const name of Object.keys(webConfig)) assert.match(dockerfile, new RegExp(`ARG ${name}\\b`), name);
    const build = dockerfile.indexOf("RUN npm run build");
    assert.ok(build > dockerfile.indexOf("CITY_HEALER_RELEASE_BUILD=true"), "the guard must be set before the build runs");
  });
});
