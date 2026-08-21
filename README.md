# Aspire Event Dashboard

Live TV leaderboard for in-person events, styled as a bar-chart race. One admin
drives all trend values by hand; a public TV display shows the live standings
with no login required. Self-hosted single Node process, SQLite for storage,
Server-Sent Events for realtime push.

## Stack

- Next.js 16 (App Router), React 19, Tailwind v4
- SQLite via `better-sqlite3` + Drizzle ORM (`lib/db/`)
- SSE realtime (`lib/sse.ts`), driven by a 1s server tick loop (`lib/ticker.ts`)
- shadcn/ui components (`components/ui/`)

## Running locally

```bash
bun install
bun run dev
```

Seed the admin account. Two ways, pick one:

- **Local/dev** — unauthenticated, no-op if an admin already exists, uses
  `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (defaults to `admin` /
  `admin123`):
  ```bash
  curl http://localhost:3000/api/admin/init
  ```
- **Production** — secret-gated, also doubles as password rotation on
  redeploy. Requires `ADMIN_SEED_SECRET` set (see `docker-compose.yml`):
  ```bash
  curl -X POST http://localhost:3000/api/seed \
    -H "Authorization: Bearer $ADMIN_SEED_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"your-real-password"}'
  ```
  Omit `username`/`password` in the body to fall back to `ADMIN_USERNAME`
  / `ADMIN_PASSWORD`.

Then:
- `/admin` — login, create/manage sessions
- `/admin/[sessionId]` — control panel for one session
- `/tv/[sessionId]` — public leaderboard display, no login

## Running with Docker

```bash
docker compose up --build
```

Set real credentials before going live — either export them before starting,
or drop them in a `.env` file next to `docker-compose.yml`:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-real-password
SESSION_SECRET=<random-string>
ADMIN_SEED_SECRET=<random-string>
```

`./data` on the host is mounted to `/app/data` in the container, so the
SQLite db and uploaded images survive rebuilds. After the container is up,
seed the admin account with the production `/api/seed` flow above (the
container doesn't auto-seed on boot).

To rebuild after a code change: `docker compose up --build`. To stop:
`docker compose down` — `./data` is a bind mount, not a Docker volume, so
your db and uploads live on the host regardless and survive either way.

### CI image builds

`.github/workflows/docker-build.yml` builds the image on every push/PR to
`main` and pushes it to GHCR (`ghcr.io/<owner>/<repo>`) on pushes and tags
(PR builds verify the Dockerfile but never push). Tags produced: branch
name, PR number, semver from `v*` git tags, short commit SHA, and `latest`
on `main`. Pull a built image directly instead of building locally:

```bash
docker pull ghcr.io/sarojshrestha-commits/aspier-event-dashboard:latest
```

## Features

**Sessions** — each event is a session with its own unique ID/URL for admin
and TV. Configurable duration, visible-trend count, and takeover window.
Start/Stop controls the session clock; Reset zeroes trend values and restarts
the clock; sessions auto-stop the instant their configured duration elapses.

**Trends** — each trend has a name, optional image, and a value that moves
either by:
- a flat rate (units/min), or
- a custom ramp curve — arbitrary `{% of session, rate}` stages, piecewise-
  linearly interpolated over the session's elapsed time (ramp-up / steady /
  ramp-down, or any shape you define)

Per-trend controls: pause/play, stop (zero the rate), hide/reveal, delete,
and a per-trend bar color on the TV display. Session-wide Start All / Stop
All toggles every trend's ticking at once.

**Takeover** — mark one trend as the takeover trend: it's auto-hidden from
the public feed and gets an aggressive ramp preset. Trigger the takeover
manually (button) or let it fire automatically once the configured window
before session end arrives. The surging trend's data is pushed directly in
the trigger broadcast — the TV never queries the hidden trend through the
normal endpoint, so its value can't be inspected via devtools before the
reveal. After a takeover, the trend stays surfaced until the admin explicitly
reveals or re-hides it — never automatic.

**TV display** — minimal white leaderboard, bar-chart-race style, optional
full-bleed background image, live session clock + wall clock, values
formatted like a sub-count race (999 → 1.2K → 1.2M).

## Data & uploads

- `data/app.db` — SQLite database (WAL mode). Schema migrations run
  automatically on boot via `ALTER TABLE ... ADD COLUMN`, safe to re-run.
- `data/uploads/` — trend images and TV background images, served via
  `/api/uploads/[filename]`. Upload endpoints require the admin session
  cookie.

Don't delete `data/app.db` to "reset" — use the app's Reset Session action,
or move the file aside if you truly need a clean slate.
