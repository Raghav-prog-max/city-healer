# City Healer

An integrated emergency and care platform for Delhi NCR: AI symptom triage, live
hospital bed and ICU census, doctor consultation with digital prescriptions,
e-pharmacy, health records, and ambulance SOS dispatch — across four enforced
roles (patient, doctor, hospital, admin).

React 19 + Vite + Tailwind v4 on the front, Express + SQLite on the back, Google
Gemini for the AI paths. One process serves both the API and the frontend.

## Run it locally

**Prerequisites:** Node.js 20+

```bash
npm install
```

Create `.env.local` (gitignored) with at least a signing secret:

```bash
node -e "console.log('JWT_SECRET=\"' + require('crypto').randomBytes(48).toString('base64url') + '\"')" >> .env.local
```

Then add `DEMO_MODE="true"` to that file so the **Demo / Sandbox Mode** button on
the sign-in screen works without an account. See [.env.example](.env.example) for
every supported variable.

```bash
npm run dev
```

The app is on http://localhost:3000. First boot creates the SQLite schema and
seeds 52 hospitals, 80 doctors and 31 medicines; the port does not open until
that finishes.

`GEMINI_API_KEY` is optional. Without it the AI routes return their canned
clinical fallbacks rather than failing, so every screen stays usable.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Server + Vite middleware with HMR |
| `npm run build` | Builds the client to `dist/` and bundles the server to `dist/server.cjs` |
| `npm start` | Runs the production build (set `NODE_ENV=production`) |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Access-control matrix — 66 cases against a throwaway database |
| `npm run link-doctor` | Links a DOCTOR login to its clinician row (see below) |
| `npm run set-role` | Grants a role — the only way to make the first ADMIN (see below) |

## Accounts and roles

Sign-up creates a `PATIENT` by default; the role selector on the sign-in screen
sets the role at registration. Roles are enforced server-side on every request —
the token's role claim is re-checked against the database each time, so a role
change or a deleted account takes effect immediately.

**In production, `ADMIN` and `HOSPITAL` cannot be self-assigned at registration**,
and only an existing `ADMIN` may promote an account through the API. A fresh
deployment therefore has no way in until someone with access to the database
makes the first one:

```bash
npm run set-role -- --email you@example.com --role ADMIN
```

```bash
npm run set-role -- --list
```

Register the account through the app first, then promote it. It refuses to demote
the last remaining `ADMIN`.

On a deployed host the database lives inside the container, on the mounted volume,
so the command has to run **there** — `railway run` would execute on your machine
with the remote variables and write to a local path that is not the volume. The
build bundles the CLI to `dist/set-role.cjs` for exactly this:

```bash
railway ssh
```

```bash
node dist/set-role.cjs --email you@example.com --role ADMIN
```

A `DOCTOR` account sees patients only through its link to a `doctors` row. That
link is provisioning, not something a request may set, so it lives in a CLI:

```bash
npm run link-doctor -- --list
```

```bash
npm run link-doctor -- --uid <user-uid> --doctorId <doc-id>
```

An unlinked doctor account is linked to no patients and correctly sees none. The
server prints a warning at boot listing any it finds.

## Security

`JWT_SECRET` has no hardcoded fallback. In production the server refuses to boot
without it; outside production it generates a random per-process secret, so
sessions do not survive a restart unless you set one.

`DEMO_MODE=true` binds anonymous callers to a synthetic sandbox identity whose
uid matches no real patient, so ownership-scoped queries return nothing belonging
to a real person. It is for public demos only — never enable it on a deployment
holding real data.

[security_spec.md](security_spec.md) documents the data invariants and twelve
named attack payloads. `npm test` asserts them.

## Deploying

`Dockerfile` and `railway.json` build and run the production bundle. Point
`DB_PATH` at a mounted volume — on ephemeral disk every deploy silently resets
the database. Set `JWT_SECRET` and leave `DEMO_MODE` unset.

## Scope

Hospital, doctor, AQI and outbreak data is seeded, not live. Ambulance dispatch,
ABHA/NDHM registry sync and insurance claims are simulated pending institutional
access. The stack, the role and ownership enforcement, the test suite and the AI
triage are real and running.
