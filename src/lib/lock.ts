import type { MatchDay } from "./types";

/** Today's date in the UK (the server runs in UTC), as YYYY-MM-DD. */
export function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Previous Sundays are locked automatically so their history can't be changed by accident.
 * The admin can unlock a day for corrections (locked = false) or lock one early (locked = true).
 */
export function isDayLocked(day: Pick<MatchDay, "date" | "locked">) {
  if (day.locked === true) return true;
  if (day.locked === false) return false;
  return day.date < londonToday();
}

export const LOCKED_MESSAGE =
  "This Sunday is locked to protect its history. Unlock it on the day page if you really need to correct something.";

export const STAFF_PAST_MESSAGE =
  "Previous Sundays can only be changed by the super admin.";

/**
 * Can this role change scores/teams/matches of this day?
 *  - super admin: yes, unless the day is locked (previous Sundays lock automatically; they can unlock).
 *  - admin: only today's (or a future) Sunday, and never one that has been locked.
 */
export function canEditDay(day: Pick<MatchDay, "date" | "locked">, role: "super" | "staff" | null) {
  if (!role) return false;
  if (role === "super") return !isDayLocked(day);
  return day.date >= londonToday() && day.locked !== true;
}

/** Previous Sunday as seen by the admin (not super admin) role. */
export function isPastForStaff(day: Pick<MatchDay, "date">) {
  return day.date < londonToday();
}
