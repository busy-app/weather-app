import { device } from "@shared/device";
import { render } from "@shared/layout";
import manifest from "./appmeta/manifest.json";
import {
  fetchCurrent,
  fetchDays,
  fetchHourly,
  LONDON,
  type CurrentWeather,
  type DayForecast,
  type ForecastHour,
} from "./api.ts";
import { HOURS } from "./graph.ts";
import { daysScreen } from "./screens/days.ts";
import { forecastScreen } from "./screens/forecast.ts";
import { weatherScreen } from "./screens/weather.ts";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** How long the weather screen holds before the forecast takes over. */
const WEATHER_MS = 6000;

/** How long the marker rests on each hour of the forecast. */
const STEP_MS = 750;

/** How long each day of the multi-day forecast is shown. */
const DAY_MS = 1000;

/** How often the forecast is fetched again. */
const REFRESH_MS = 15 * 60 * 1000;

/** The current conditions, the hours of the graph, and the days after them. */
let weather: CurrentWeather | undefined;
let hours: ForecastHour[] = [];
let days: DayForecast[] = [];

/** Where the app is in its cycle. */
type Phase =
  | { screen: "weather" }
  | { screen: "forecast"; hour: number }
  | { screen: "days"; day: number };

let phase: Phase = { screen: "weather" };

/** Reads the forecast. Failures leave the last good data on screen. */
async function refresh(): Promise<void> {
  const [current, forecastHours, forecastDays] = await Promise.all([
    fetchCurrent(LONDON),
    fetchHourly(LONDON),
    fetchDays(LONDON),
  ]);

  weather = current;
  days = forecastDays;

  // Rounded once here, so bar heights and readings agree.
  hours = forecastHours.slice(0, HOURS).map((hour) => ({
    ...hour,
    temp: Math.round(hour.temp),
  }));
}

/** What is on screen right now, by id, as it was last sent. */
let drawn = new Map<string, string>();

/**
 * Draws whichever screen is due.
 *
 * Elements are addressed by id, so only what differs is sent. The delete comes last: an app that leaves the screen empty is closed.
 */
async function draw(): Promise<void> {
  if (!weather) return;

  let frame;
  if (phase.screen === "weather") {
    frame = weatherScreen(weather, new Date());
  } else if (phase.screen === "forecast") {
    frame = forecastScreen(hours, phase.hour);
  } else {
    frame = daysScreen(days, phase.day);
  }

  const elements = render(frame);

  const next = new Map(elements.map((element) => [element.id, JSON.stringify(element)]));
  const changed = elements.filter((element) => drawn.get(element.id) !== next.get(element.id));
  if (changed.length > 0) {
    await device.DisplayDraw({ application_name: APP, priority: 50, elements: changed });
  }

  const stale = [...drawn.keys()].filter((id) => !next.has(id));
  if (stale.length > 0) {
    await device.DisplayClear({ application_name: APP, element_ids: stale });
  }
  drawn = next;
}

/** Weather → the graph hour by hour → the days → back. Empty screens are skipped. */
function step(): void {
  if (phase.screen === "weather") {
    phase = hours.length > 0 ? { screen: "forecast", hour: 0 } : phase;
    if (phase.screen === "weather" && days.length > 0) phase = { screen: "days", day: 0 };
    return;
  }

  if (phase.screen === "forecast") {
    if (phase.hour < hours.length - 1) phase = { screen: "forecast", hour: phase.hour + 1 };
    else phase = days.length > 0 ? { screen: "days", day: 0 } : { screen: "weather" };
    return;
  }

  if (phase.day < days.length - 1) phase = { screen: "days", day: phase.day + 1 };
  else phase = { screen: "weather" };
}

/** How long the frame now on screen stays up. */
function holdMs(): number {
  switch (phase.screen) {
    case "weather":
      return WEATHER_MS;
    case "forecast":
      return STEP_MS;
    case "days":
      return DAY_MS;
  }
}

export default function run(): void {
  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);

  void refresh().then(draw).catch(report);

  // Each frame schedules the next: the screens are held for different times.
  const advance = () => {
    setTimeout(() => {
      step();
      void draw().catch(report);
      advance();
    }, holdMs());
  };
  advance();

  setInterval(() => {
    void refresh().catch(report);
  }, REFRESH_MS);
}
