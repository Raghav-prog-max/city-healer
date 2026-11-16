# Tailwind v4 ships its compiler as a per-platform native binary. npm's
# optional-dependency resolution (npm/cli#4828) fails to fetch the Linux binary
# when a lockfile generated on another platform is present, and every Nixpacks
# build died on "Cannot find native binding" while loading vite.config.ts.
#
# The documented workaround is to install without that lockfile. Nixpacks always
# copies it before installing, so it cannot be applied there — here it can:
# package.json is copied on its own, dependencies are resolved fresh for linux,
# and the rest of the source arrives afterwards.

FROM node:22-trixie-slim AS build
WORKDIR /app

# Resolve dependencies for this platform, with no lockfile in the way.
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Vite compiles the Firebase web config into the frontend, so it must be known at build time.
# It comes from build arguments only (they are not secrets): .dockerignore keeps every local
# .env file out of the image, and emulator mode is fixed off here. On Railway, service
# variables with these names are passed as build arguments automatically.
#   docker build --build-arg VITE_FIREBASE_API_KEY=... --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
#                --build-arg VITE_FIREBASE_PROJECT_ID=... --build-arg VITE_FIREBASE_APP_ID=... .
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_EMULATORS=false
# A release build fails rather than produce an image nobody can sign in to (emulator mode,
# or web config missing): vite.config.ts, shared/buildEnv.ts.
ENV CITY_HEALER_RELEASE_BUILD=true
RUN npm run build

# Trixie, not bookworm: sqlite3's prebuilt binding is linked against GLIBC_2.38
# and Debian 12 ships 2.36, so the container started and then died on dlopen.
FROM node:22-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime needs the built server, the built frontend, and node_modules —
# server.ts is bundled with --packages=external so its imports resolve at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# The database lives on a mounted volume; see DB_PATH.
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
