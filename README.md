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

Seed the admin account (defaults to `admin` / `admin123`, override with
`ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars):

```bash
curl http://localhost:3000/api/admin/init
```

Then:
- `/admin` — login, create/manage sessions
- `/admin/[sessionId]` — control panel for one session
- `/tv/[sessionId]` — public leaderboard display, no login

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
