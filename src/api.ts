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
  /** Whether the sun is up; some conditions are drawn differently at night. */
  daylight: boolean;
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
    /** 1 by day, 0 by night. */
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    is_day?: number[];
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
    "&current=temperature_2m,weather_code,is_day" +
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

  return { temp, code, daylight: data.current?.is_day !== 0 };
}

/** An hour of the forecast, as the API reports it. */
export type ForecastHour = {
  /** Local hour of the day, 0..23. */
  hour: number;
  /** Temperature, °C. */
  temp: number;
  code: number;
  daylight: boolean;
};

/** The forecast GRAPH_HOURS ahead of the current hour. */
export async function fetchHourly(city: City): Promise<ForecastHour[]> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${city.lat}` +
    `&longitude=${city.lon}` +
    "&hourly=temperature_2m,weather_code,is_day" +
    "&forecast_days=2" +
    `&timezone=${encodeURIComponent(city.tzName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open-meteo: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenMeteoResponse;
  const times = data.hourly?.time;
  const temps = data.hourly?.temperature_2m;
  const codes = data.hourly?.weather_code;
  const isDay = data.hourly?.is_day;
  if (!times || !temps || !codes || !isDay || times.length === 0) {
    throw new Error("open-meteo: no hourly in response");
  }

  // The first time not earlier than now.
  const nowMs = Date.now();
  let start = times.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (start < 0) start = 0;

  return times.slice(start, start + GRAPH_HOURS).map((at, i) => ({
    hour: Number(at.slice(11, 13)),
    temp: temps[start + i],
    code: codes[start + i],
    daylight: isDay[start + i] !== 0,
  }));
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

/** The next FORECAST_DAYS days, each split into its daylight and night hours. */
export async function fetchDays(city: City): Promise<DayForecast[]> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${city.lat}` +
    `&longitude=${city.lon}` +
    "&hourly=temperature_2m,weather_code,is_day" +
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
  const isDay = data.hourly?.is_day;
  if (!times || !temps || !codes || !isDay) {
    throw new Error("open-meteo: no hourly in response");
  }

  /** Each date's hours, split in two, in the order the API listed them. */
  const halves = new Map<
    string,
    { dayTemps: number[]; dayCodes: number[]; nightTemps: number[]; nightCodes: number[] }
  >();

  for (let h = 0; h < times.length; h++) {
    const date = times[h].slice(0, 10);
    let half = halves.get(date);
    if (!half) {
      half = { dayTemps: [], dayCodes: [], nightTemps: [], nightCodes: [] };
      halves.set(date, half);
    }
    const daylight = isDay[h] !== 0;
    (daylight ? half.dayTemps : half.nightTemps).push(temps[h]);
    (daylight ? half.dayCodes : half.nightCodes).push(codes[h]);
  }

  const days: DayForecast[] = [];
  for (const [date, half] of halves) {
    // A partial first day can leave one half without hours.
    if (half.dayTemps.length === 0 || half.nightTemps.length === 0) continue;

    days.push({
      date,
      day: mean(half.dayTemps),
      night: mean(half.nightTemps),
      dayCode: commonest(half.dayCodes),
      nightCode: commonest(half.nightCodes),
    });
  }

  return days;
}
