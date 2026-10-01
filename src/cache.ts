import type { CurrentWeather, DayForecast, ForecastHour } from "./api.ts";
import type { Units } from "./settings.ts";

const KEY = "weather.forecast.v1";

/** Past this the hours it holds have all gone by, so there is nothing left to show. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface CachedForecast {
  fetchedAt: number;
  current: CurrentWeather;
  /** Celsius, as the backend sent them. */
  hours: ForecastHour[];
  days: DayForecast[];
  /** What the screen looked like, so the first frame can go up before the settings are read. */
  view: { units: Units; showTime: boolean; showDate: boolean };
}

export function saveForecast(entry: CachedForecast) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // No storage, or no room in it: the app just starts on the spinner next time.
  }
}

export function loadForecast(now: number): CachedForecast | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;

    const entry = JSON.parse(raw) as CachedForecast;
    const fresh = typeof entry.fetchedAt === "number" && now >= entry.fetchedAt && now - entry.fetchedAt <= MAX_AGE_MS;

    if (!fresh || !entry.current || !entry.view || !Array.isArray(entry.hours) || !Array.isArray(entry.days)) {
      return undefined;
    }

    return entry;
  } catch {
    return undefined;
  }
}
