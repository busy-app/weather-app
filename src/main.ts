import { device } from "@shared/device";
import { render } from "@busy-app/busy-lib";
import manifest from "./appmeta/manifest.json";
import {
  fetchForecast,
  type CurrentWeather,
  type DayForecast,
  type ForecastHour,
} from "./api.ts";
import { buildGraph, HOURS, type Graph } from "./graph.ts";
import { daysScreen } from "./screens/days.ts";
import { forecastScreen } from "./screens/forecast.ts";
import { loadingScreen } from "./screens/loading.ts";
import { weatherScreen } from "./screens/weather.ts";
import { DEFAULTS, loadSettings, type Settings } from "./settings.ts";
import { fromUnits, setUnits, toUnits } from "./temp.ts";
import type { Drawn } from "./types.ts";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** How often the forecast is fetched again. */
const REFRESH_MS = 15 * 60 * 1000;

/** The current conditions, the hours of the graph, and the days after them. */
let weather: CurrentWeather | undefined;
let hours: ForecastHour[] = [];
let days: DayForecast[] = [];

let graph: Graph = { bitmap: "", markers: [] };

/** Read once at startup; a change takes effect when the app is restarted. */
let settings: Settings = DEFAULTS;

/** Where the app is in its cycle. */
type Phase =
  | { screen: "loading"; text: string }
  | { screen: "weather" }
  | { screen: "forecast"; hour: number }
  | { screen: "days"; day: number };

let phase: Phase = { screen: "loading", text: "Loading settings" };

/** Reads the forecast. Failures leave the last good data on screen. */
async function refresh(): Promise<void> {
  const place = settings.location;
  const forecast = await fetchForecast(place.mode === "fixed" ? place : undefined);

  weather = forecast.current;
  days = forecast.days;

  // One rounding for both, so bar heights and readings agree.
  hours = forecast.hours.slice(0, HOURS).map((hour) => ({
    ...hour,
    temp: fromUnits(Math.round(toUnits(hour.temp))),
  }));

  graph = buildGraph(hours.map((hour) => hour.temp));
}

/** Every field a screen may change. One left out here is one that never reaches the screen again. */
const FIELDS = [
  "text",
  "path",
  "data",
  "x",
  "y",
  "width",
  "height",
  "color",
  "font",
  "opacity",
  "z_index",
  "fill_colors",
] as const;

function differs(before: Drawn | undefined, now: Drawn): boolean {
  if (!before) return true;

  const was = before as Record<string, unknown>;
  const is = now as Record<string, unknown>;

  for (let i = 0; i < FIELDS.length; i++) {
    const key = FIELDS[i]!;
    const a = was[key];
    const b = is[key];
    if (a === b) continue;

    // Only `fill_colors` is an array, and only ever a short one.
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return true;
      for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return true;
      continue;
    }

    return true;
  }

  return false;
}

/** What is on screen right now, by id, as it was last sent. */
let drawn = new Map<string, Drawn>();

/** A draw is in flight; a request made while it runs is coalesced into one frame after it. */
let drawing = false;
let pending = false;

/** How long the app waits for the encoder to settle. A frame costs far more than the gap between two ticks. */
const SETTLE_MS = 60;

let settling: ReturnType<typeof setTimeout> | undefined;

/** The loading screen needs no data; every other one waits for the first forecast. */
function drawable(): boolean {
  return phase.screen === "loading" || weather !== undefined;
}

/**
 * Draws whichever screen is due, once the input has settled.
 *
 * Elements are addressed by id, so only what differs is sent: a step through the graph sends the marker and the readings, never the bars behind them.
 */
function draw(): void {
  if (!drawable()) return;

  // Each tick pushes the frame back, so a turn of the knob costs one frame rather than one per tick.
  if (settling !== undefined) clearTimeout(settling);
  settling = setTimeout(() => {
    settling = undefined;
    void paintNow();
  }, SETTLE_MS);
}

async function paintNow(): Promise<void> {
  if (!drawable()) return;

  // A frame is already in flight; it will pick the new position up when it ends.
  if (drawing) {
    pending = true;
    return;
  }
  drawing = true;

  try {
    do {
      pending = false;
      await paint();
    } while (pending);
  } finally {
    drawing = false;
  }
}

/** Sends one frame: what changed, then what is no longer on it. */
async function paint(): Promise<void> {
  // The day screen places itself; the others still go through the layout engine.
  let elements: Drawn[];
  if (phase.screen === "loading") {
    elements = render(loadingScreen(phase.text));
  } else if (phase.screen === "weather") {
    elements = render(
      weatherScreen(weather!, new Date(), {
        time: settings.showTime,
        date: settings.showDate,
      }),
    );
  } else if (phase.screen === "forecast") {
    elements = render(forecastScreen(hours, graph, phase.hour));
  } else {
    elements = daysScreen(days, phase.day);
  }

  const next = new Map<string, Drawn>();
  const changed: typeof elements = [];
  for (const element of elements) {
    next.set(element.id, element);
    if (differs(drawn.get(element.id), element)) changed.push(element);
  }

  const stale: string[] = [];
  for (const id of drawn.keys()) if (!next.has(id)) stale.push(id);

  drawn = next;

  // Both at once; neither names an element the other does, so the order they arrive in does not matter.
  const sent: Promise<unknown>[] = [];
  if (changed.length > 0) {
    sent.push(device.DisplayDraw({ application_name: APP, priority: 50, elements: changed }));
  }
  if (stale.length > 0) {
    sent.push(device.DisplayClear({ application_name: APP, element_ids: stale }));
  }
  await Promise.all(sent);
}

/** The screens in the order the ok and start keys cycle through them. `loading` is not among them: it is left behind for good once the forecast arrives. */
const SCREENS = ["weather", "forecast", "days"] as const;

type Screen = (typeof SCREENS)[number];

function filled(screen: Screen): boolean {
  if (screen === "forecast") return hours.length > 0;
  if (screen === "days") return days.length > 0;
  return weather !== undefined;
}

/** Advances to the next non-empty screen, wrapping around. The cursor restarts at the first entry. */
function nextScreen(): void {
  // While loading there is no current screen; -1 starts the search at the first one.
  const from = phase.screen === "loading" ? -1 : SCREENS.indexOf(phase.screen);

  for (let offset = 1; offset <= SCREENS.length; offset++) {
    const screen = SCREENS[(from + offset) % SCREENS.length];
    if (!filled(screen)) continue;

    if (screen === "weather") phase = { screen: "weather" };
    else if (screen === "forecast") phase = { screen: "forecast", hour: 0 };
    else phase = { screen: "days", day: 0 };
    return;
  }
}

/**
 * Moves the cursor of the current list screen. It stops at both ends instead of wrapping.
 * @returns Whether the cursor actually moved; at either end there is nothing to redraw.
 */
function scroll(delta: number): boolean {
  if (phase.screen === "forecast") {
    const hour = Math.min(Math.max(phase.hour + delta, 0), hours.length - 1);
    if (hour === phase.hour) return false;
    phase = { screen: "forecast", hour };
    return true;
  }

  if (phase.screen === "days") {
    const day = Math.min(Math.max(phase.day + delta, 0), days.length - 1);
    if (day === phase.day) return false;
    phase = { screen: "days", day };
    return true;
  }

  return false;
}

/** How long the first forecast waits before trying again, doubling until the last entry. */
const RETRY_MS = [3000, 6000, 12000, 24000, 48000, 60000];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps asking for the first forecast until one arrives, leaving the spinner up in between.
 *
 * Without this a start with no network would sit on the spinner until the refresh interval came round a quarter of an hour later.
 */
async function firstForecast(report: (err: unknown) => void): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await refresh();
      phase = { screen: "weather" };
      await paintNow();
      return;
    } catch (err) {
      report(err);
    }

    await wait(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!);
  }
}

export default function run(): void {
  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);

  // The settings decide which place is asked for and in which scale the readings are drawn, so they come before the first forecast. loadSettings() handles its own failures.
  void (async () => {
    void paintNow();

    settings = await loadSettings();
    setUnits(settings.units);

    phase = { screen: "loading", text: "Loading weather" };
    void paintNow();

    await firstForecast(report);

    // Started only once the settings are in hand, so no refresh runs against the wrong place.
    setInterval(() => {
      void refresh()
        .then(() => paintNow())
        .catch(report);
    }, REFRESH_MS);
  })();

  // `back` is left alone: the firmware hangs when the app tears itself down under it.
  listen("input", (event) => {
    if (event.key === "encoder") {
      if (!scroll(event.delta)) return;
      draw();
      return;
    }

    if (event.key === "back" || event.action !== "press") return;

    nextScreen();
    void paintNow().catch(report);
  });
}
