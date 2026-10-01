import type { DayForecast, ForecastHour } from "./api.ts";

export function windowOf(all: ForecastHour[], elapsed: number, size: number): ForecastHour[] {
  return all.slice(elapsed, elapsed + size);
}

export function hoursPassed(before: ForecastHour | undefined, after: ForecastHour | undefined): number {
  if (!before || !after) return 0;
  return (after.hour - before.hour + 24) % 24;
}

/** The window moved left under the marker, so it keeps its hour until that hour falls off the edge. */
export function shiftedSelection(index: number, by: number): number {
  return Math.max(0, index - by);
}

export function isoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Lets the day screen follow the date without waiting for a new forecast. */
export function dropPastDays(days: DayForecast[], today: string): { days: DayForecast[]; dropped: number } {
  let dropped = 0;
  while (dropped < days.length && days[dropped]!.date < today) dropped++;

  return dropped === 0 ? { days, dropped } : { days: days.slice(dropped), dropped };
}
