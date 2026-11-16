import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {BUILD_INFO_FILE, buildInfoFrom, releaseBuildProblems} from './shared/buildEnv';

/**
 * Guards what Firebase the frontend is compiled for (shared/buildEnv.ts). A release build
 * (CITY_HEALER_RELEASE_BUILD=true, set by the Dockerfile) fails if it is in emulator mode or
 * lacks the web config; every build records what it was compiled for in dist/build-info.json,
 * which the production server checks before serving it.
 */
function firebaseBuildGuard(env: Record<string, string>): Plugin {
  return {
    name: 'city-healer-firebase-build-guard',
    apply: 'build',
    buildStart() {
      const problems = releaseBuildProblems(env);
      if (process.env.CITY_HEALER_RELEASE_BUILD === 'true') {
        if (problems.length) this.error(`This build must not be released:\n- ${problems.join('\n- ')}`);
      } else if (env.VITE_FIREBASE_EMULATORS === 'true') {
        this.warn('Building for the local Firebase emulators (VITE_FIREBASE_EMULATORS=true). This build is for local use only; a production server will refuse to serve it.');
      }
    },
    generateBundle() {
      this.emitFile({type: 'asset', fileName: BUILD_INFO_FILE, source: JSON.stringify(buildInfoFrom(env), null, 2) + '\n'});
    },
  };
}

export default defineConfig(({mode}) => {
  // The same VITE_* values Vite compiles into the bundle: .env files, then the real environment.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), firebaseBuildGuard(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
