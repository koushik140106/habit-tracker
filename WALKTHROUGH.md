# Walkthrough — Habit Tracker with Streaks

This is a written walkthrough covering the same ground a 5-10 minute video
would: what I built, the key decisions, and where the timezone logic lives.
Feel free to convert this to a Loom if you'd rather watch it — the content is
the same.

## 1. The core problem: local-day logic

The hard part of this assignment isn't CRUD, it's this: **a "streak" is
defined in terms of the user's calendar day, not in terms of elapsed time or
UTC**. If a user in `Asia/Kolkata` checks in at 11:58 PM and again the next
day at 12:05 AM, that's two different local days only 7 minutes apart in
elapsed time — and it should count as two consecutive days, not zero.
Conversely, someone in `America/Los_Angeles` and someone in `Asia/Tokyo`
checking in at "the same UTC instant" may be on entirely different local
dates.

**Where this lives:** `backend/src/services/timezone.service.ts`. This is the
only file in the codebase that is allowed to ask "what day is it for this
user." Specifically:

- `todayInTimezone(tz)` — resolves "today" for a given IANA timezone using
  Luxon (`DateTime.now().setZone(tz).toISODate()`).
- `isFutureLocalDate(date, tz)` — used to reject future-dated check-ins.
- `isValidTimezone(tz)` — validates the timezone string at registration time
  by asking Luxon if it can construct a valid `DateTime` in that zone, rather
  than maintaining a hardcoded list of valid IANA zones.
- `addDays` / `diffInDays` — small helpers so calendar-day arithmetic never
  gets done ad hoc elsewhere with raw `Date` math (which is where off-by-one
  DST bugs usually creep in).

Every controller that needs "today" imports from this module. I never call
`new Date()` to derive a user-facing day anywhere else in the backend.

## 2. Why `localDate` is a string, not a timestamp

The `CheckIn.localDate` column is a plain `YYYY-MM-DD` string, not a
`DateTime`/`timestamp` column. This was a deliberate call:

- The local day is resolved **once**, at write time (either "now" via
  `todayInTimezone`, or an explicit backfill date the user picked). Once
  resolved, it's just a fact — "this habit was done on this calendar day" —
  and storing it as a timestamp would reintroduce the exact ambiguity we're
  trying to avoid (a timestamp needs a timezone to be turned back into a
  "day," and now the DB/ORM would be the one doing that conversion instead of
  the isolated service).
- ISO date strings (`YYYY-MM-DD`) sort and compare correctly with plain
  string operators (`<`, `>`, `===`), which is what both the future-date
  check and the streak calculation rely on. No need to parse back into `Date`
  objects for the common paths.
- It maps cleanly onto the uniqueness constraint I actually want: "one
  check-in per habit per local day," expressed directly as
  `@@unique([habitId, localDate])` in `prisma/schema.prisma`. The database
  enforces this, not just app code — so even a race condition or a bug
  upstream can't create a duplicate.

## 3. Streak calculation

`backend/src/services/streak.service.ts` takes a list of `localDate` strings
for a habit plus "today" (already resolved via the timezone service) and
returns `{ currentStreak, longestStreak }`. It knows nothing about timezones
— it's pure date-string arithmetic, which makes it trivial to unit test in
isolation (see `backend/scripts/test-core-logic.ts`, runnable via
`npm run test:core`, no DB required).

Two decisions worth flagging:

- **Longest streak** = the longest run of consecutive calendar days ever
  logged, full stop.
- **Current streak** has a one-day grace period: if the most recent check-in
  was *yesterday* (not today), the streak is still reported as alive rather
  than reset to zero. Rationale: a user who checked in yesterday and simply
  hasn't checked in yet today (because it's, say, 9 AM) shouldn't watch their
  streak visually "die" before they've had a chance to act today. The streak
  only actually breaks once a full local day has been skipped with no
  check-in.

I tested this with cases covering: empty history, a clean run ending today, a
run ending yesterday (still alive), a stale run broken 2+ days ago (current
resets to 0, longest is preserved), a gap in the middle of the history
(longest picks the bigger run, current reflects only the trailing run), and
defensive handling of duplicate/unsorted input even though the DB constraint
should make duplicates impossible in practice.

## 4. Validation & error handling

- Request bodies are validated with `zod` schemas
  (`backend/src/validators/schemas.ts`) — invalid email, short passwords,
  invalid IANA timezone strings, and malformed dates are all rejected before
  they reach a controller.
- A centralized error handler (`middleware/errorHandler.ts`) maps: `zod`
  validation errors → 400 with per-field details; a custom `AppError` →
  whatever status/code it was thrown with (401 for bad credentials, 404 for
  a habit that isn't yours, 409 for duplicate check-ins/emails); Prisma's
  `P2002` unique-violation code → 409 as a fallback safety net even if
  app-level validation somehow missed a duplicate; everything else → 500,
  logged server-side, generic message to the client.
- Ownership checks: every habit/check-in route verifies the resource belongs
  to the authenticated user (`assertOwnedHabit`) before reading or mutating
  it, so one user can't view or delete another user's habits by guessing IDs.

## 5. Auth

Email + password + IANA timezone at registration. Passwords are hashed with
bcrypt (12 rounds). Login returns a JWT containing `userId` and `timezone` —
embedding the timezone in the token means every authenticated request already
knows which zone to resolve "today" against without an extra DB round-trip.
For a take-home of this scope I used `localStorage` for the token on the
frontend; in a production system I'd move to an httpOnly cookie to reduce XSS
exposure, but that adds CSRF-protection surface area that felt out of scope
here.

## 6. What I deliberately left out

Per the assignment's "don't over-engineer" note, I skipped: refresh tokens,
email verification, habit editing (only create/delete), a full calendar-grid
visualization (the detail page uses a simple list of date chips instead —
enough to see the history and delete a mistaken entry, without building a
calendar component), and pagination (reasonable for a habit-tracker's check-in
volumes at this stage).

## 7. Verifying it works

- `cd backend && npm run test:core` — runs the dependency-free tests for the
  timezone/streak logic described above (no DB needed).
- `npx tsc --noEmit` passes clean on both `backend` and `frontend`.
- `cd frontend && npm run build` produces a clean production bundle.
- **Before submitting:** run `npx prisma migrate dev` against a real Postgres
  instance and do one full manual pass through the UI (register → add habit
  → check in → backfill a past date → try a duplicate/future date → confirm
  the error messages → view streaks) to confirm the wiring end-to-end.
