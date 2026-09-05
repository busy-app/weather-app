/** A place to ask the forecast for. */
export type City = {
  lat: number;
  lon: number;
  /** IANA name, so open-meteo returns local times. */
  tzName: string;
};

/** The city the app reports on. */
export const LONDON: City = {
  lat: 51.51,
  lon: -0.13,
  tzName: "Europe/London",
};

export type CurrentWeather = {
  /** Temperature, °C. */
  temp: number;
  /** WMO weather code. */
  code: number;
};

/** A day of the multi-day forecast, as the app shows it. */
export type DayForecast = {
  /** Local date, "2026-09-05". */
  date: string;
  /** Mean temperature between sunrise and sunset. */
  day: number;
  /** Mean temperature over the remaining hours. */
  night: number;
  /** WMO code of the daylight hours, and of the night ones. */
  dayCode: number;
  nightCode: number;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
  };
  daily?: {
    time?: string[];
    sunrise?: string[];
    sunset?: string[];
  };
};

/** Number of forecast hours in the graph window. */
export const GRAPH_HOURS = 24;

/** Fetches current weather for a city via open-meteo (no API key). */
export async function fetchCurrent(city: City): Promise<CurrentWeather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${city.lat}` +
    `&longitude=${city.lon}` +
    "&current=temperature_2m,weather_code" +
    `&timezone=${encodeURIComponent(city.tzName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open-meteo: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenMeteoResponse;
  const temp = data.current?.temperature_2m;
  const code = data.current?.weather_code;
  if (typeof temp !== "number" || typeof code !== "number") {
    throw new Error("open-meteo: no current in response");
  }

  return { temp, code };
}

/** Hourly temperatures in °C, GRAPH_HOURS ahead of the current hour. */
export async function fetchHourly(city: City): Promise<number[]> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${city.lat}` +
    `&longitude=${city.lon}` +
    "&hourly=temperature_2m" +
    "&forecast_days=2" +
    `&timezone=${encodeURIComponent(city.tzName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open-meteo: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenMeteoResponse;
  const times = data.hourly?.time;
  const temps = data.hourly?.temperature_2m;
  if (!times || !temps || times.length === 0) {
    throw new Error("open-meteo: no hourly in response");
  }

  // The first time not earlier than now.
  const nowMs = Date.now();
  let start = times.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (start < 0) start = 0;

  return temps.slice(start, start + GRAPH_HOURS);
}

/** Days the multi-day forecast covers, today first. */
export const FORECAST_DAYS = 7;

/** Mean of a list; NaN for an empty one. */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** The code that describes a stretch of hours: the one occurring most often. */
function commonest(codes: number[]): number {
  const counts = new Map<number, number>();
  let best = codes[0];
  for (const code of codes) {
    const seen = (counts.get(code) ?? 0) + 1;
    counts.set(code, seen);
    if (seen > (counts.get(best) ?? 0)) best = code;
  }
  return best;
}

/** The next FORECAST_DAYS days, each split at sunrise and sunset. */
export async function fetchDays(city: City): Promise<DayForecast[]> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${city.lat}` +
    `&longitude=${city.lon}` +
    "&hourly=temperature_2m,weather_code" +
    "&daily=sunrise,sunset" +
    `&forecast_days=${FORECAST_DAYS}` +
    `&timezone=${encodeURIComponent(city.tzName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open-meteo: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenMeteoResponse;
  const times = data.hourly?.time;
  const temps = data.hourly?.temperature_2m;
  const codes = data.hourly?.weather_code;
  const dates = data.daily?.time;
  const sunrises = data.daily?.sunrise;
  const sunsets = data.daily?.sunset;
  if (!times || !temps || !codes || !dates || !sunrises || !sunsets) {
    throw new Error("open-meteo: no daily in response");
  }

  const days: DayForecast[] = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const sunrise = sunrises[i];
    const sunset = sunsets[i];
    if (!sunrise || !sunset) continue;

    // Local timestamps sort lexically, so they compare as strings.
    const dayTemps: number[] = [];
    const dayCodes: number[] = [];
    const nightTemps: number[] = [];
    const nightCodes: number[] = [];

    for (let h = 0; h < times.length; h++) {
      const at = times[h];
      if (!at.startsWith(date)) continue;
      const daylight = at >= sunrise && at <= sunset;
      (daylight ? dayTemps : nightTemps).push(temps[h]);
      (daylight ? dayCodes : nightCodes).push(codes[h]);
    }

    // A partial first day can leave one half without hours.
    if (dayTemps.length === 0 || nightTemps.length === 0) continue;

    days.push({
      date,
      day: mean(dayTemps),
      night: mean(nightTemps),
      dayCode: commonest(dayCodes),
      nightCode: commonest(nightCodes),
    });
  }

  return days;
}
