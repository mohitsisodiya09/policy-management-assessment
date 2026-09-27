# Policy Management API

Node.js project for ingesting denormalized insurance policy sheets (CSV/XLSX), persisting normalized MongoDB collections, searching and aggregating policies, monitoring host CPU for supervised restarts, and delivering day/time-scheduled messages into the database.

---

## Features

| Area             | Capability                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Ingest**       | Multipart CSV/XLSX upload; parse/normalize in a `worker_threads` worker; upsert into 6 domain collections          |
| **Search**       | Policy lookup by `username` (`User.firstName`) and optional `email`                                                |
| **Aggregate**    | Policy counts and summaries grouped by user                                                                        |
| **CPU monitor**  | System-wide CPU sampling; graceful shutdown (exit `0`) after sustained threshold for PM2 relaunch                  |
| **Scheduler**    | Cron-driven delivery of pending messages at a future day/time into MongoDB                                         |
| **API contract** | Uniform JSON envelope via `res.success` / `res.error`                                                              |
| **Ops**          | Health check, request IDs, structured logs, rate limiting, Helmet, compression, CORS, graceful shutdown            |
| **DX / quality** | ESLint, Prettier, Husky (lint-staged + Commitlint), Node engine gate, shared VS Code workspace, Postman collection |

---

## Tech stack

| Layer           | Choice                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| Runtime         | Node.js **24+** (ESM, `"type": "module"`)                                        |
| HTTP            | Express 4 on `http.Server`                                                       |
| Database        | MongoDB + Mongoose 8                                                             |
| Validation      | Zod (per-route validators)                                                       |
| Upload          | Multer + `csv-parse` + `xlsx`                                                    |
| Workers         | `node:worker_threads`                                                            |
| Logging         | Pino + `pino-http` (`x-request-id`)                                              |
| Scheduling      | `node-cron`                                                                      |
| Process manager | PM2 (`ecosystem.config.cjs`)                                                     |
| Quality         | ESLint 9 (flat), Prettier, Husky, lint-staged, Commitlint (Conventional Commits) |
| Engine gate     | `prestart` → `scripts/check-node-version.js` (`chalk` + `semver`)                |
| API testing     | Postman collection + local environment                                           |

---

## Architecture

```text
Client / Postman
  │
  ▼
Express (Helmet, CORS, compression, pino-http, attachResponse)
  │
  ├─ GET  /health                         (no rate limit)
  └─ /api/v1/*                            (rate limited)
        ├─ POST /upload                   → Multer → worker parse → Mongo upserts
        ├─ GET  /policies/search
        ├─ GET  /policies/aggregate/by-user
        ├─ POST /schedule
        └─ GET  /schedule
```

**Background (same process):**

- **CPU monitor** — samples `os.cpus()` on an interval; sustained ≥ threshold → graceful shutdown
- **Schedule worker** — cron every minute; atomically claims due `pending` messages and marks `delivered`

**Shutdown path:** stop monitors → close HTTP server → disconnect MongoDB → exit (`0` for intentional/CPU restart, `1` for fatal)

---

## Data model

| Collection          | Role              | Key fields                                                             |
| ------------------- | ----------------- | ---------------------------------------------------------------------- |
| `agents`            | Producing agent   | `agentName` (unique)                                                   |
| `users`             | Policy holder     | `firstName`, `email` (partial unique), contact/profile fields          |
| `accounts`          | Account grouping  | `accountName` (unique), optional `userId`                              |
| `lobs`              | Line of business  | `categoryName` (unique)                                                |
| `carriers`          | Insurance company | `companyName` (unique)                                                 |
| `policies`          | Policy record     | `policyNumber` (unique), dates, refs to user/LOB/carrier/agent/account |
| `scheduledmessages` | Deferred delivery | `message`, `day`, `time`, `scheduledFor`, `status`, `deliveredPayload` |

Re-uploads are idempotent on natural keys (agent/company/category/policy number/user email).

---

## Prerequisites

- Node.js **24+** (see `.nvmrc` and `package.json` → `engines.node`)
- MongoDB reachable at `MONGODB_URI`
- (Production) PM2 for supervised restart after CPU-triggered exit

---

## Quick start

```bash
nvm use                              # Node 24+
cp .env.example .env                 # edit MONGODB_URI if needed
npm install                          # installs deps + Husky hooks via prepare
npm run dev                          # nodemon → src/server.js
```

Verify:

```bash
curl -s http://localhost:3000/health
npm run lint
```

Then import the Postman assets (see [API testing](#api-testing-postman)).

---

## Environment

Copy `.env.example` → `.env`. Values are validated at boot via Zod (`src/config/env.js`).

| Variable                  | Default       | Purpose                                       |
| ------------------------- | ------------- | --------------------------------------------- |
| `NODE_ENV`                | `development` | `development` \| `production` \| `test`       |
| `PORT`                    | `3000`        | HTTP listen port                              |
| `MONGODB_URI`             | —             | Mongo connection string (required)            |
| `CPU_THRESHOLD_PERCENT`   | `70`          | System CPU % that starts the sustained window |
| `CPU_SUSTAINED_SECONDS`   | `5`           | Seconds above threshold before restart        |
| `CPU_CHECK_INTERVAL_MS`   | `1000`        | Sample interval                               |
| `LOG_LEVEL`               | `info`        | Pino level                                    |
| `UPLOAD_MAX_FILE_SIZE_MB` | `25`          | Multer file size cap                          |
| `CORS_ORIGIN`             | `*`           | `*` or comma-separated origins                |
| `RATE_LIMIT_WINDOW_MS`    | `900000`      | API rate-limit window (15m)                   |
| `RATE_LIMIT_MAX`          | `300`         | Max requests per window for `/api/v1`         |

Never commit `.env`. Only `.env.example` is tracked.

---

## Scripts

| Command             | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `npm start`         | Runs `prestart` (Node engine check), then `node src/server.js` |
| `npm run dev`       | Nodemon watch on `src/`                                        |
| `npm run lint`      | Prettier `--check` + ESLint                                    |
| `npm run lint:fix`  | Prettier `--write` + ESLint `--fix`                            |
| `npm run pm2:start` | `pm2 start ecosystem.config.cjs`                               |
| `npm run pm2:stop`  | Stop `policy-management-api`                                   |

`prepare` → `husky` (installs git hooks on `npm install`).

---

## API overview

Base URL (local): `http://localhost:3000`  
Versioned routes live under `/api/v1` (rate limited). Request examples and bodies are in Postman.

### Response envelope

```json
{
  "status": true,
  "statusCode": 200,
  "message": "…",
  "data": {},
  "error": null
}
```

Errors set `status: false`, populate `error`, and use the appropriate HTTP status (`400`, `404`, `413`, `500`, …). Oversized uploads return **413**. Clients may send `x-request-id`; otherwise one is generated and returned.

### Endpoints

| Method | Path                                 | Summary                                         |
| ------ | ------------------------------------ | ----------------------------------------------- |
| `GET`  | `/health`                            | Liveness probe (excluded from access-log noise) |
| `POST` | `/api/v1/upload`                     | Multipart CSV/XLSX ingest (`file` field)        |
| `GET`  | `/api/v1/policies/search`            | Search by `username` and/or `email`             |
| `GET`  | `/api/v1/policies/aggregate/by-user` | Aggregate policies per user                     |
| `POST` | `/api/v1/schedule`                   | Schedule a message (`message`, `day`, `time`)   |
| `GET`  | `/api/v1/schedule`                   | List schedules (optional `status`)              |

---

## API testing (Postman)

| File                                                                                                         | Purpose                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [`Policy Management API.postman_collection.json`](./Policy%20Management%20API.postman_collection.json)       | Collection — Health, Upload, Policies, Schedule         |
| [`Policy Management Local.postman_environment.json`](./Policy%20Management%20Local.postman_environment.json) | Local env — `baseUrl` (default `http://localhost:3000`) |

1. Import collection + environment into Postman.
2. Select environment **Policy Management Local**.
3. Start the API (`npm run dev`).
4. Suggested order: **Health check** → **Upload Policy file** (attach `sample-policy-data.csv`) → **Search by username** → **Aggregate policies by user** → **Create scheduled message** → **List all scheduled messages**.

---

## Production deployment (PM2)

CPU threshold handling exits with code **0** so a process manager can restart cleanly.

```bash
npm install -g pm2
npm run pm2:start
pm2 status
pm2 logs policy-management-api
```

`ecosystem.config.cjs` highlights:

- `kill_timeout: 12000` — longer than the app’s 10s shutdown window (avoids early SIGKILL)
- `autorestart: true`, `max_memory_restart: 512M`
- `instances: 1`, `exec_mode: fork` (single process; CPU monitor + cron are in-process)

Ensure production env sets `NODE_ENV=production` and a durable `MONGODB_URI`.

---

## Project structure

```text
├── src/
│   ├── app.js                 # Express app, middleware stack, /health, /api/v1
│   ├── server.js              # HTTP server, boot, graceful shutdown hooks
│   ├── config/                # env (Zod), Mongo connection
│   ├── constants/             # enums, centralized messages
│   ├── controllers/           # thin HTTP adapters
│   ├── middleware/            # attachResponse, validate, upload, errors
│   ├── models/                # Mongoose schemas + indexes
│   ├── routes/                # versioned routers
│   ├── services/              # upload, policy, schedule, CPU monitor
│   ├── validators/            # Zod schemas (route-bound)
│   ├── workers/               # fileParser.worker.js
│   └── utils/                 # ApiError, logger, helpers
├── scripts/
│   └── check-node-version.js  # engines.node gate (prestart)
├── .husky/
│   ├── pre-commit             # lint-staged
│   └── commit-msg             # commitlint (Conventional Commits)
├── .vscode/                   # shared settings, launch, tasks, extensions
├── commitlint.config.js
├── ecosystem.config.cjs
├── eslint.config.js
├── sample-policy-data.csv
├── Policy Management API.postman_collection.json
├── Policy Management Local.postman_environment.json
└── package.json
```

---

## Quality & developer experience

| Tool                   | Role                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **ESLint**             | Flat config + `eslint-config-prettier`                                                                            |
| **Prettier**           | Default formatter; format-on-save in shared VS Code settings                                                      |
| **Husky `pre-commit`** | `lint-staged` — ESLint + Prettier on staged files                                                                 |
| **Husky `commit-msg`** | Commitlint — [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, …) |
| **Commitlint**         | `commitlint.config.js` extends `@commitlint/config-conventional` (body max line length 1000)                      |
| **EditorConfig**       | Baseline indentation / EOL                                                                                        |
| **VS Code / Cursor**   | Recommended extensions, debug launch configs, npm tasks                                                           |
| **Node engine check**  | `prestart` fails fast if `process.version` does not satisfy `engines.node`                                        |

Example valid commit messages:

```text
feat: add policy search by username
fix: return 413 for oversized uploads
chore: add Prettier and Husky hooks
docs: document Postman collection usage
```

---

## Design notes

1. **Username** maps to `User.firstName`; optional `email` narrows identity.
2. **LOB** = Line of Business (`categoryName`).
3. **Validation** lives in validators only; services assume sanitized input.
4. **Upload** cleans temp files in `finally` after ingest; Agent/LOB/Carrier/User upserts run in parallel with duplicate-key retry.
5. **Schedule delivery** uses an atomic `findOneAndUpdate` claim so overlapping cron ticks do not double-deliver.
6. **Trust proxy** enabled for accurate client IP behind reverse proxies (rate limit / logs).

---

## License

ISC
