# Lab 5 Deployment — YourMoneyOurMoney

Status as of `main` @ `c096e72128e83055a4790dfab3786b358fb6d33f`. Written for CPE 334 Lab 5
(Cloud Deployment and CI/CD Pipeline on GCP), against the Lab 5 handout and the Student Guide
(GCP Deployment and CI/CD, V1.1).

## 1. Stack and changes from the reference

The reference stack (Episode 0.2) is Docker, Artifact Registry, Cloud Run, Cloud SQL for
PostgreSQL, Secret Manager and GitHub Actions. We use all of it, on the same application and
stack as Sprint 1: Express + TypeScript API, Prisma + PostgreSQL, a React + Vite client, and
`express-session` with `connect-pg-simple` for sessions in the database.

Recorded changes from the Lab 5 Starter Kit (not required, documented per handout §5):

- **Three Docker files instead of seven.** We keep the root `Dockerfile`, `.dockerignore` and
  `docker-compose.yml`. The kit's `server/Dockerfile`, `client/Dockerfile`, `client/nginx.conf`
  and `server/docker-entrypoint.sh` are not used: Express already serves the built client
  (`CLIENT_DIST_DIR`, see §3), so one container does both the UI and the API in development and
  in production, and `docker-compose.yml`'s `app` profile runs the same image CI builds and
  Cloud Run deploys, instead of a separate nginx-fronted client container.
- **`docker-compose.yml` has two layers.** Plain `docker compose up -d` starts only `db`, for
  `npm run dev`, `npm test` and Playwright E2E (unchanged from Sprint 1). `docker compose
  --profile app up --build -d` adds `migrate` (runs once, applies migrations + seed, exits) and
  `app` (the production image on port 3000), both built from the same root `Dockerfile`.
  Locally these run with `NODE_ENV=development`, because the production session cookie is
  `Secure`-only and would not stick over plain `http://localhost`.
- **An extra secret.** The kit only stores `DATABASE_URL`. Our server refuses to start without
  `SESSION_SECRET` (`server/src/session.ts`), so `deploy/deploy.sh` also creates
  `ymom-session-secret` and grants `ymom-runner` access to it, and `deploy/teardown.sh` deletes
  it too.
- **Smoke test has no `/api/categories` check** (the kit's TokTickIT-specific endpoint); it
  checks `/api/health`, `/api/ready`, `/` and, optionally, a login/me/logout cycle guarded by
  `SMOKE_EMAIL` + `SMOKE_PASSWORD`. Not set here — see §6.

## 2. Build, test, run, migrate and seed

Local development (unchanged from Sprint 1):

```bash
docker compose up -d                 # starts only PostgreSQL (dev + test databases)
npm test                             # server (Vitest) + client (Vitest) tests
npm --prefix server run dev          # API on :3000
npm --prefix client run dev          # client on :5173, proxies /api
```

Run the production image locally (added in Lab 5, same image CI and Cloud Run use):

```bash
docker compose --profile app up --build -d   # builds root Dockerfile, runs db + migrate + app
docker compose --profile app ps -a           # migrate must show Exited (0)
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
docker compose --profile app down            # keeps data (named volume db-data)
docker compose --profile app down -v         # deletes it
```

Migrate and seed (what `migrate` and the Cloud Run job both run):

```bash
npx prisma migrate deploy
npm run prisma:seed
```

The seed (`server/prisma/seedData.ts`) is idempotent and production-safe: outside production it
defaults to the Sprint 1 demo password and seeds `alice`/`bob`/`admin`; with
`NODE_ENV=production` it requires `ADMIN_PASSWORD` from the environment and only seeds
`alice`/`bob` when `SEED_DEMO_DATA=true` and `DEMO_USER_PASSWORD` is set.

## 3. Environment variables

See `docs/system-sds.md` §8.1 for the full table (purpose, dev/test value, production source).
Summary:

| Variable | Secret? | Production source |
|---|---|---|
| `DATABASE_URL` | yes | Secret Manager (`ymom-database-url`) |
| `SESSION_SECRET` | yes | Secret Manager (`ymom-session-secret`) |
| `ADMIN_PASSWORD` | yes (migration-job only) | Secret Manager (`ymom-admin-password`), read once by the seed |
| `DEMO_USER_PASSWORD` | yes (migration-job only) | Secret Manager (`ymom-demo-password`), read once by the seed |
| `PORT` | no | set by Cloud Run |
| `NODE_ENV` | no | `production`, plain Cloud Run env var |
| `TZ` | no | `Asia/Bangkok`, plain Cloud Run env var |
| `SEED_DEMO_DATA` | no | `true` (migration job only — see §6) |
| `CLIENT_DIST_DIR` | no | defaults to `/app/client/dist` in the image |

No real value for any of these is committed; `.env` is git-ignored and `server/.env.example` /
`client/.env.example` list every variable with a placeholder.

## 4. GCP project, region and resource names

| Item | Value |
|---|---|
| Project ID | `cpe334-yourmoneymymoney` |
| Region | `asia-southeast1` |
| Artifact Registry repository | `ymom` |
| Cloud Run service | `ymom` |
| Cloud Run migration job | `ymom-migrate` |
| Cloud SQL instance | `ymom-pg` (PostgreSQL 16, `db-f1-micro`, `--edition=enterprise`, storage auto-increase off) |
| Database / DB user | `ymom` |
| Runtime service account | `ymom-runner` (`roles/cloudsql.client` on the project; `secretAccessor` on its own 4 secrets only) |
| Deployer service account | `ymom-deployer` (`roles/run.developer`; `roles/artifactregistry.writer` on `ymom` only; `roles/iam.serviceAccountUser` on `ymom-runner` only; no keys) |
| Secrets | `ymom-database-url`, `ymom-session-secret`, `ymom-admin-password`, `ymom-demo-password` |
| Workload Identity pool / provider | `github-actions` / `github-main` |
| GitHub environment | `demo` (deploys allowed only from `main`; variables `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`) |
| Public URL | `https://ymom-98465542651.asia-southeast1.run.app` |

## 5. Release procedure

Every Issue has its own feature branch into `Sprint-2/staging` (reviewed by the other member,
author never self-approves). `main` is reached only through a release Pull Request
`Sprint-2/staging → main`, reviewed, with `test-and-docker` as a required status check
(ruleset `protect-main`: active, no bypass, 1 required approval, branches must be up to date).

Merging into `main` runs `.github/workflows/deploy.yml` (`Deploy demo`) automatically:

1. **test** — reuses `ci-docker.yml`'s `test-and-docker` job.
2. **authenticate** — Workload Identity Federation (no key file), as `ymom-deployer`.
3. **build & push** — root `Dockerfile`, tagged with the full commit SHA, pushed to `ymom`.
4. **release** (`deploy/release.sh`) — resolves the pushed tag to its image digest, runs
   `ymom-migrate` with that digest (`--wait`), then points the `ymom` service at the same
   digest with 100% traffic.
5. **smoke test** (`deploy/smoke_test.py`) — `/api/health`, `/api/ready`, `/`, logs `SKIP
   login` (no `SMOKE_EMAIL`/`SMOKE_PASSWORD` set).
6. **summary** — the run's Summary tab records the commit image tag, the digest and the URL.

To repeat a release: open an Issue, branch from `Sprint-2/staging`, PR into staging (reviewed),
release PR into `main` (reviewed, green `test-and-docker`), merge — `Deploy demo` does the rest.

## 6. Rollback / roll-forward

```text
Actions → Deploy demo → Run workflow → branch: main → image_tag: <full 40-char commit SHA>
```

With `image_tag` set, `test` and the build step are skipped (`ROLLBACK=true` in
`deploy/release.sh`): the named image is resolved by digest, `ymom-migrate` runs again
(migrations are additive, so this is safe against an older image), and the service is pointed
at that digest. Leaving `image_tag` empty tests, rebuilds and deploys current `main`.

Known-good releases on this branch's history:

| Release | Commit SHA | What it put live |
|---|---|---|
| A | `43dccbddcf55430244898ec116e00f92a7cec9d9` | first automatic deploy (`deploy.yml` added) |
| B | `c096e72128e83055a4790dfab3786b358fb6d33f` | visible login-page change, proving a repeat release |

Rolling A → B and back (L5-08) showed a transaction recorded before the rollback, and the
signed-in session, both survived the rollback and the roll-forward — data lives in Cloud SQL,
not in the container.

## 7. How to find the commit that is running

- **GitHub:** Actions → Deploy demo → latest successful run → Summary tab shows the commit
  image tag and digest.
- **GCP Console:** Cloud Run → `ymom` → Revisions tab → the revision at 100% traffic → compare
  its container image digest with the one in the run summary.
- **CLI:**
  ```bash
  gcloud run services describe ymom --region asia-southeast1 --format='value(status.traffic)'
  ```

## 8. Not required / out of scope

A separate cloud staging environment, Kubernetes, infrastructure-as-code, a custom domain, a
load balancer, multi-region deployment, canary/blue-green releases, monitoring dashboards and
load testing are all out of scope for Lab 5 (handout §4.2) and are not part of this setup.
