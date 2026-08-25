import { DateTime } from 'luxon';

/**
 * All "what day is it for this user" logic lives here, and ONLY here.
 * Nothing else in the codebase should call `new Date()` and derive a
 * calendar day from it directly - every local-day decision routes through
 * this module so there is exactly one place to audit/test.
 */

/** Returns true if `tz` is a valid IANA timezone identifier Luxon recognizes. */
export function isValidTimezone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.trim() === '') return false;
  return DateTime.local().setZone(tz).isValid;
}

/** Returns today's date, as YYYY-MM-DD, in the given IANA timezone. */
export function todayInTimezone(timezone: string): string {
  const dt = DateTime.now().setZone(timezone);
  const iso = dt.toISODate();
  if (!iso) throw new Error(`Could not resolve current date for timezone "${timezone}"`);
  return iso;
}

/** Strict YYYY-MM-DD format check (does not validate calendar correctness). */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/** Returns true if `date` (YYYY-MM-DD) is a real calendar date. */
export function isValidCalendarDate(date: string): boolean {
  if (!isValidDateFormat(date)) return false;
  const dt = DateTime.fromISO(date);
  return dt.isValid && dt.toISODate() === date;
}

/**
 * Returns true if `date` (YYYY-MM-DD) is strictly after "today" as observed
 * in the user's timezone. ISO date strings compare lexicographically in
 * exactly the same order as chronologically, so plain string comparison is
 * correct and avoids re-parsing into Date objects (a common source of
 * off-by-one-day bugs when timezones get involved).
 */
export function isFutureLocalDate(date: string, timezone: string): boolean {
  const today = todayInTimezone(timezone);
  return date > today;
}

/** Adds `days` calendar days to a YYYY-MM-DD string and returns YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const result = DateTime.fromISO(date).plus({ days }).toISODate();
  if (!result) throw new Error(`Could not add days to date "${date}"`);
  return result;
}

/** Whole-day difference between two YYYY-MM-DD strings (b - a). */
export function diffInDays(a: string, b: string): number {
  return DateTime.fromISO(b).diff(DateTime.fromISO(a), 'days').days;
}
