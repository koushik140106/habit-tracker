# Habit Tracker with Streaks

A fullstack habit tracker where check-ins and streaks are computed against the
**user's local calendar day**, not UTC timestamps or elapsed hours.

Stack: **React (Vite) + TypeScript** frontend, **Node/Express + TypeScript**
backend, **PostgreSQL** via **Prisma**.

## Where the local-day logic lives

Everything timezone-related is isolated in one file:
[`backend/src/services/timezone.service.ts`](backend/src/services/timezone.service.ts).
No other part of the codebase calls `new Date()` to derive "today" for a user —
every local-day decision (what is today, is a date in the future, adding/diffing
days) routes through that module. This makes it the single place to audit or
unit-test for correctness, and it means swapping the underlying date library
later only touches one file.

Streak math itself lives in
[`backend/src/services/streak.service.ts`](backend/src/services/streak.service.ts)
and operates purely on an array of `YYYY-MM-DD` strings — it has no knowledge
of timezones at all, which keeps it trivially testable.

See `WALKTHROUGH.md` for the full design write-up.

## Project structure

```
habit-tracker/
├── backend/
│   ├── prisma/schema.prisma       # User, Habit, CheckIn models + migrations
│   └── src/
│       ├── services/
│       │   ├── timezone.service.ts   # ← all local-day logic
│       │   └── streak.service.ts     # ← streak calculation
│       ├── controllers/              # auth, habit, check-in handlers
│       ├── middleware/               # JWT auth, centralized error handler
│       ├── validators/               # zod request schemas
│       ├── routes/
│       ├── app.ts
│       └── server.ts
└── frontend/
    └── src/
        ├── pages/         # Login, Register, Dashboard, HabitDetail
        ├── context/       # AuthContext (JWT + user in localStorage)
        ├── api/           # axios client
        └── types.ts
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a connection string to a hosted instance)

## 1. Backend setup

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/habit_tracker?schema=public"
JWT_SECRET="some-long-random-string"
JWT_EXPIRES_IN="7d"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
```

If you don't already have a database, create one:

```bash
createdb habit_tracker
# or, from psql:
# CREATE DATABASE habit_tracker;
```

Install dependencies, run the migration, and start the API:

```bash
npm install
npx prisma migrate dev --name init   # creates tables from prisma/schema.prisma
npm run dev                          # http://localhost:4000
```

`npm run dev` uses `tsx watch`. For a production-style run: `npm run build && npm start`.

## 2. Frontend setup

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev             # http://localhost:5173
```

## 3. Using it

1. Register with an email, password, and IANA timezone (defaults to your
   browser's detected timezone, e.g. `Asia/Kolkata`).
2. Add a habit from the dashboard.
3. "Check in today" logs today's local date. On the habit detail page you can
   also backfill any past date — the date picker's `max` is capped at today
   and the backend independently rejects any future date server-side.
4. Current and longest streaks recompute on every load from the raw list of
   check-in dates (see `streak.service.ts`).

## API overview

All `/api/habits*` routes require `Authorization: Bearer <token>`.

| Method | Path                              | Description                          |
|--------|------------------------------------|---------------------------------------|
| POST   | `/api/auth/register`              | Create account (email, password, timezone) |
| POST   | `/api/auth/login`                 | Log in, returns JWT                   |
| GET    | `/api/habits`                     | List habits with computed streaks     |
| POST   | `/api/habits`                     | Create a habit                        |
| GET    | `/api/habits/:id`                 | Habit detail + full check-in history  |
| DELETE | `/api/habits/:id`                 | Delete a habit (cascades check-ins)   |
| POST   | `/api/habits/:id/checkins`        | Log a check-in (`{ date? }`, defaults to today) |
| DELETE | `/api/habits/:id/checkins/:checkInId` | Remove a check-in                 |

Errors are returned as `{ error: { code, message, details? } }` with an
appropriate HTTP status (400 validation, 401 auth, 404 not found, 409 conflict).

## Design decisions worth calling out

- **`localDate` is stored as a `YYYY-MM-DD` string**, not a `DateTime`/timestamp
  column. The whole point of the assignment is that streaks depend on the
  user's *local calendar day*, so the check-in's local day is resolved once
  (at write time, in `timezone.service.ts`) and persisted as-is. This avoids
  the DB or ORM ever re-deriving a "day" from a UTC instant, which is exactly
  where timezone bugs creep in. ISO date strings also sort and compare
  correctly with plain `<` / `>` / equality, so there's no need to parse them
  back into `Date` objects for most operations.
- **Duplicate local-day check-ins are rejected at the database level** via a
  `@@unique([habitId, localDate])` constraint, not just app-level validation —
  belt and suspenders.
- **Future dates are rejected server-side** regardless of what the frontend
  sends, by comparing against `todayInTimezone(user.timezone)`.
- **Current streak "grace period"**: if a user's most recent check-in was
  *yesterday* (in their timezone) and they haven't checked in yet today, the
  streak is still reported as alive rather than reset to 0 — they still have
  the rest of today to act. It only breaks once a full local day is skipped.
- **Passwords** are hashed with bcrypt (12 rounds); the JWT carries `userId`
  and `timezone` so the timezone doesn't need a DB lookup on every check-in.
- Kept intentionally out of scope per the assignment's "don't over-engineer"
  note: refresh tokens, email verification, habit editing/archiving, and a
  calendar-grid UI (the detail page uses a simple chip list of dates instead).

## Testing

The core logic (timezone resolution + streak calculation) has a standalone
test script exercised during development — see `WALKTHROUGH.md` for the cases
covered (streak continuing across a "yesterday" gap, streaks broken by a
missed day, unsorted/duplicate input defensiveness, future-date rejection,
etc.). Wire these into a proper test runner (Vitest/Jest) if the team wants
CI coverage; they were intentionally written dependency-free so they run with
just `npx tsx` while iterating.
