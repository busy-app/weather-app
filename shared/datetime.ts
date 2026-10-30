const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");

export function wallClock(now: number, utcOffsetMs: number): Date {
  return new Date(now + utcOffsetMs);
}

/** Time as "HH:MM". */
export function formatHM(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Three-letter month, e.g. "Jul". */
export function formatMonth(d: Date): string {
  return MONTHS[d.getUTCMonth()];
}

/** Three-letter weekday, e.g. "Sat". */
export function formatWeekday(d: Date): string {
  return DAYS[d.getUTCDay()];
}

/** Day of the month, e.g. "8". */
export function formatDay(d: Date): string {
  return String(d.getUTCDate());
}
