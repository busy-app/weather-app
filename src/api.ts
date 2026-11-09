import { errorText } from "@shared/errors";
import type { ErrorResponse, ForecastResponse, WeatherCode } from "./apiTypes.ts";
import { HOURS } from "./graph.ts";

export type City = {
  lat: number;
  lon: number;
};

export type CurrentWeather = {
  /** Temperature, °C. */
  temp: number;
  code: WeatherCode;
  daylight: boolean;
};

export type ForecastHour = {
  /** Unix milliseconds, independent of the device timezone. */
  time: number;
  /** Local hour of the day, 0..23. */
  hour: number;
  temp: number;
  code: WeatherCode;
  daylight: boolean;
};

export type DayForecast = {
  date: string;
  day: number;
  night: number;
  dayCode: WeatherCode;
  nightCode: WeatherCode;
};

export type Forecast = {
  utcOffsetSeconds: number;
  current: CurrentWeather;
  hours: ForecastHour[];
  days: DayForecast[];
};

const BASE = (import.meta.env.VITE_WEATHER_API ?? "").replace(/\/+$/, "");

const PREFIX = "/weather/v1";

const SIGNED: BusyRequestInit = {
  dispatcher: { connect: { useDeviceKey: true } },
};

/** A day of graph plus a day of slack, so the window can slide on between refreshes. */
const HOURS_AHEAD = HOURS * 2;

export const FORECAST_DAYS = 7;

export class OfflineError extends Error {}

async function get<T>(path: string) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${PREFIX}${path}`, SIGNED);
  } catch (err) {
    throw new OfflineError(`weather api: ${errorText(err)}`);
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      detail = ((await res.json()) as ErrorResponse).error?.message;
    } catch {
      // A body that is not JSON still leaves the status to report.
    }

    throw new Error(`weather api: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

/** Without a city the backend resolves the place by geoip. */
export async function fetchForecast(city?: City): Promise<Forecast> {
  const query =
    city === undefined ? "" : `?latitude=${city.lat}&longitude=${city.lon}`;
  const data = await get<ForecastResponse>(`/forecast${query}`);

  if (!data.current || !data.location) {
    throw new Error("weather api: no current in response");
  }

  const utcOffsetSeconds = data.location.utc_offset_seconds ?? 0;

  return {
    utcOffsetSeconds,
    current: {
      temp: data.current.temperature,
      code: data.current.weather_code,
      daylight: data.current.is_day,
    },
    hours: (data.hourly ?? []).slice(0, HOURS_AHEAD).map((hour) => ({
      time: /(?:Z|[+-]\d{2}:\d{2})$/.test(hour.time)
        ? Date.parse(hour.time)
        : Date.parse(`${hour.time}Z`) - utcOffsetSeconds * 1000,
      hour: Number(hour.time.slice(11, 13)),
      temp: hour.temperature,
      code: hour.weather_code,
      daylight: hour.is_day,
    })),
    days: (data.daily ?? []).slice(0, FORECAST_DAYS).map((day) => ({
      date: day.date,
      day: day.day.temperature,
      night: day.night.temperature,
      dayCode: day.day.weather_code,
      nightCode: day.night.weather_code,
    })),
  };
}
