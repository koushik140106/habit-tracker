/**
 * Dependency-free sanity tests for the two modules that matter most for this
 * assignment: local-day resolution and streak calculation. Deliberately
 * written without a test runner so they can run with just `npx tsx`, no DB
 * or server required. Run with: `npm run test:core`
 *
 * If this were going further, these cases would move into Vitest/Jest with
 * proper `describe`/`it` blocks and CI wiring - kept minimal here per the
 * assignment's "don't over-engineer" guidance.
 */
import { calculateStreaks } from '../src/services/streak.service';
import { addDays, isFutureLocalDate, isValidTimezone, todayInTimezone } from '../src/services/timezone.service';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('PASS:', msg);
  }
}

// --- timezone service ---
assert(isValidTimezone('Asia/Kolkata'), 'Asia/Kolkata is a valid IANA tz');
assert(isValidTimezone('America/New_York'), 'America/New_York is a valid IANA tz');
assert(!isValidTimezone('Not/ARealZone'), 'garbage tz string is rejected');
assert(!isValidTimezone(''), 'empty tz string is rejected');

const todayIST = todayInTimezone('Asia/Kolkata');
assert(isFutureLocalDate(addDays(todayIST, 1), 'Asia/Kolkata'), 'tomorrow is flagged as future');
assert(!isFutureLocalDate(todayIST, 'Asia/Kolkata'), "today is not flagged as future");
assert(!isFutureLocalDate(addDays(todayIST, -1), 'Asia/Kolkata'), 'yesterday is not flagged as future');

// --- streak service ---
const today = '2026-08-24';

assert(
  JSON.stringify(calculateStreaks([], today)) === JSON.stringify({ currentStreak: 0, longestStreak: 0 }),
  'no check-ins -> 0/0'
);

let r = calculateStreaks(['2026-08-22', '2026-08-23', '2026-08-24'], today);
assert(r.currentStreak === 3 && r.longestStreak === 3, `3-day streak ending today: ${JSON.stringify(r)}`);

r = calculateStreaks(['2026-08-21', '2026-08-22', '2026-08-23'], today);
assert(r.currentStreak === 3 && r.longestStreak === 3, `streak ending yesterday still alive: ${JSON.stringify(r)}`);

r = calculateStreaks(['2026-08-18', '2026-08-19', '2026-08-20'], today);
assert(r.currentStreak === 0 && r.longestStreak === 3, `stale streak -> current 0, longest kept: ${JSON.stringify(r)}`);

r = calculateStreaks(
  ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-22', '2026-08-23', '2026-08-24'],
  today
);
assert(r.currentStreak === 3 && r.longestStreak === 4, `gap in middle: ${JSON.stringify(r)}`);

r = calculateStreaks(['2026-08-24', '2026-08-24', '2026-08-23'], today);
assert(r.currentStreak === 2 && r.longestStreak === 2, `de-duped input: ${JSON.stringify(r)}`);

r = calculateStreaks(['2026-08-24', '2026-08-22', '2026-08-23'], today);
assert(r.currentStreak === 3 && r.longestStreak === 3, `unsorted input handled: ${JSON.stringify(r)}`);

r = calculateStreaks(['2026-08-24'], today);
assert(r.currentStreak === 1 && r.longestStreak === 1, `single check-in today: ${JSON.stringify(r)}`);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
