import { diffInDays } from './timezone.service';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Computes current + longest streak from a list of local check-in dates
 * (YYYY-MM-DD, in the user's timezone) and "today" (also in the user's
 * timezone).
 *
 * Assumptions / rules encoded here:
 * - `localDates` must be de-duplicated and sorted ascending (the DB unique
 *   constraint on (habitId, localDate) guarantees no duplicates; we sort
 *   here defensively rather than trusting caller order).
 * - "Longest streak" = the longest run of consecutive calendar days ever.
 * - "Current streak" is 0 if the most recent check-in is older than
 *   yesterday (the streak is broken). If the most recent check-in is today
 *   OR yesterday, the streak is still "alive" (a user who checked in
 *   yesterday but hasn't checked in yet today shouldn't see their streak
 *   reset to 0 the moment midnight passes in their timezone - they still
 *   have the rest of today to keep it going).
 */
export function calculateStreaks(localDates: string[], todayLocal: string): StreakResult {
  const dates = Array.from(new Set(localDates)).sort();

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let run = 1;

  for (let i = 1; i < dates.length; i++) {
    const gap = diffInDays(dates[i - 1], dates[i]);
    run = gap === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const mostRecent = dates[dates.length - 1];
  const gapFromToday = diffInDays(mostRecent, todayLocal);

  let currentStreak = 0;
  if (gapFromToday === 0 || gapFromToday === 1) {
    currentStreak = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      const gap = diffInDays(dates[i - 1], dates[i]);
      if (gap === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}
