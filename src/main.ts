import { displayClear, displayDraw } from "@shared/device";
import { render } from "@shared/layout/index.ts";
import manifest from "./appmeta/manifest.json";
import {
  fetchForecast,
  type CurrentWeather,
  type DayForecast,
  type ForecastHour,
} from "./api.ts";
import { loadForecast, saveForecast } from "./cache.ts";
import { buildGraph, HOURS, type Graph } from "./graph.ts";
import { dropPastDays, hoursPassed, isoDate, shiftedSelection, windowOf } from "./sliding.ts";
import { daysScreen } from "./screens/days.ts";
import { forecastScreen } from "./screens/forecast.ts";
import { loadingScreen } from "./screens/loading.ts";
import { weatherScreen } from "./screens/weather.ts";
import { DEFAULTS, loadSettings, type Settings } from "./settings.ts";
import { fromUnits, setUnits, toUnits } from "./temp.ts";
import type { Drawn } from "./types.ts";

type Phase =
  | { screen: "loading"; text: string }
  | { screen: "weather" }
  | { screen: "forecast"; hour: number }
  | { screen: "days"; day: number };

const APP = manifest.id;

const REFRESH_MS = 15 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

/** Added to the wait so the tick lands after the minute has rolled over, not on its edge. */
const MINUTE_SKEW_MS = 50;

const HOUR_MS = 60 * MINUTE_MS;

let weather: CurrentWeather | undefined;
/** Every hour the forecast returned; the graph shows a window into it. */
let forecastHours: ForecastHour[] = [];
/** Hours since the forecast arrived: the graph's left edge. */
let elapsed = 0;
/** When the forecast on screen was fetched, so an hour is never dropped twice. */
let refreshedAt = 0;
let hours: ForecastHour[] = [];
let days: DayForecast[] = [];

/** Built on demand: only the forecast screen needs it, and it costs a full XPM2 render. */
let graph: Graph | undefined;

/** Read once at startup; a change takes effect when the app is restarted. */
let settings: Settings = DEFAULTS;

let phase: Phase = { screen: "loading", text: "Loading weather" };

function report(err: unknown) {
  console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
}

/** The graph itself is rebuilt when it is next drawn. */
function applyWindow(): void {
  hours = windowOf(forecastHours, elapsed, HOURS);
  graph = undefined;

  // The window is short of a full day once the forecast runs out; keep the marker inside it.
  if (phase.screen === "forecast" && phase.hour >= hours.length) {
    phase = { screen: "forecast", hour: Math.max(0, hours.length - 1) };
  }
}

function shiftSelection(by: number) {
  if (by <= 0 || phase.screen !== "forecast") return;

  phase = { screen: "forecast", hour: shiftedSelection(phase.hour, by) };
}

/** A failure leaves the last good data on screen. */
async function refresh() {
  const place = settings.location;
  const forecast = await fetchForecast(place.mode === "fixed" ? place : undefined);

  const selectedDay = phase.screen === "days" ? days[phase.day]?.date : undefined;
  const passed = hoursPassed(hours[0], forecast.hours[0]);

  weather = forecast.current;
  days = forecast.days;
  saveForecast({
    fetchedAt: Date.now(),
    current: forecast.current,
    hours: forecast.hours,
    days: forecast.days,
    view: { units: settings.units, showTime: settings.showTime, showDate: settings.showDate },
  });

  // One rounding for both, so bar heights and readings agree.
  forecastHours = forecast.hours.map((hour) => ({
    ...hour,
    temp: fromUnits(Math.round(toUnits(hour.temp))),
  }));

  // A fresh forecast starts at the current hour again.
  elapsed = 0;
  refreshedAt = Date.now();
  applyWindow();
  shiftSelection(passed);
  keepSelectedDay(selectedDay);
}

/** The cursor follows the date it was on, wherever that day has moved to. */
function keepSelectedDay(date: string | undefined) {
  if (date === undefined || phase.screen !== "days") return;

  const at = days.findIndex((day) => day.date === date);
  phase = { screen: "days", day: at >= 0 ? at : 0 };
}

/**
 * Puts the last forecast back on screen. It is stale by definition, so the fetch that follows
 * replaces it, but the app has something to show before the network answers.
 */
function restoreCached(now: number) {
  const cached = loadForecast(now);
  if (!cached) return false;

  const passed = Math.floor((now - cached.fetchedAt) / HOUR_MS);
  if (passed >= cached.hours.length) return false;

  // Rounded in whatever scale was on screen last time; the settings confirm it in a moment.
  settings = { ...settings, ...cached.view };
  setUnits(settings.units);

  weather = cached.current;
  days = cached.days;
  forecastHours = cached.hours.map((hour) => ({
    ...hour,
    temp: fromUnits(Math.round(toUnits(hour.temp))),
  }));

  elapsed = passed;
  refreshedAt = cached.fetchedAt;
  applyWindow();
  dropDays(new Date(now));

  return weather !== undefined;
}

function viewChanged(before: Settings, after: Settings) {
  return (
    before.units !== after.units ||
    before.showTime !== after.showTime ||
    before.showDate !== after.showDate
  );
}

function dropDays(now: Date) {
  const selected = phase.screen === "days" ? days[phase.day]?.date : undefined;
  const result = dropPastDays(days, isoDate(now));
  if (result.dropped === 0) return;

  days = result.days;

  // Only reachable after days offline.
  if (days.length === 0) {
    if (phase.screen === "days") phase = { screen: "weather" };
    return;
  }

  keepSelectedDay(selected);
}

function advanceHour(now: number) {
  // A forecast fetched this hour already starts on it.
  if (Math.floor(refreshedAt / HOUR_MS) === Math.floor(now / HOUR_MS)) return;

  if (elapsed + 1 >= forecastHours.length) return;

  elapsed += 1;
  applyWindow();
  shiftSelection(1);
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

  const was = before as unknown as Record<string, unknown>;
  const is = now as unknown as Record<string, unknown>;

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

/** Ticks that arrive while a frame is in flight are coalesced anyway. */
const SETTLE_MS = 1;

let settling: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let endWait: (() => void) | undefined;
let unbindInput: BusyUnbind | undefined;
let stopped = false;
/** The hour the last tick ran in, to spot the roll-over. */
let tickHour = new Date().getHours();

function stop() {
  if (stopped) return;

  stopped = true;

  if (refreshTimer !== undefined) clearInterval(refreshTimer);
  if (clockTimer !== undefined) clearTimeout(clockTimer);
  if (settling !== undefined) clearTimeout(settling);
  if (retryTimer !== undefined) clearTimeout(retryTimer);

  endWait?.();

  if (unbindInput) setTimeout(unbindInput, 10);
}

/** The loading screen needs no data; every other one waits for the first forecast. */
function drawable(): boolean {
  return phase.screen === "loading" || weather !== undefined;
}

/**
 * Draws whichever screen is due, once the input has settled. Elements are addressed by id, so only
 * what differs is sent: a step through the graph sends the marker and the readings, never the bars.
 */
function draw(): void {
  if (stopped || !drawable()) return;

  if (settling !== undefined) clearTimeout(settling);
  settling = setTimeout(() => {
    settling = undefined;
    void paintNow();
  }, SETTLE_MS);
}

async function paintNow(): Promise<void> {
  if (stopped || !drawable()) return;

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
    } while (pending && !stopped);
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
    if (!graph) graph = buildGraph(hours.map((hour) => hour.temp));
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
    sent.push(displayDraw({ application_name: APP, priority: 50, elements: changed }));
  }
  if (stale.length > 0) {
    sent.push(displayClear(APP, stale));
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
  return new Promise((resolve) => {
    endWait = resolve;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      endWait = undefined;
      resolve();
    }, ms);
  });
}

/**
 * The minute tick: repaints the clock, and on the hour moves the graph along and asks for a fresh
 * forecast, which is also what brings a new day to the day screen at midnight.
 */
function scheduleClock() {
  if (stopped) return;

  clockTimer = setTimeout(
    () => {
      clockTimer = undefined;
      if (stopped) return;

      const now = new Date();
      const hourRolled = now.getHours() !== tickHour;
      tickHour = now.getHours();

      if (hourRolled) {
        advanceHour(now.getTime());
        dropDays(now);
        void refresh()
          .then(() => paintNow())
          .catch(report);
      }

      if (hourRolled || (settings.showTime && phase.screen === "weather")) {
        paintNow().catch(report);
      }

      scheduleClock();
    },
    MINUTE_MS - (Date.now() % MINUTE_MS) + MINUTE_SKEW_MS,
  );
}

/**
 * Keeps asking for the first forecast until one arrives, leaving the spinner up in between.
 *
 * Without this a start with no network would sit on the spinner until the refresh interval came round a quarter of an hour later.
 */
async function firstForecast() {
  for (let attempt = 0; !stopped; attempt++) {
    try {
      await refresh();
      if (stopped) return;

      // Only the spinner is left behind; a screen the cache already put up stays where it is.
      if (phase.screen === "loading") phase = { screen: "weather" };
      await paintNow();
      return;
    } catch (err) {
      report(err);
    }

    await wait(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!);
  }
}

export default function run() {
  // Startup timings, to see where the wait before the first screen goes.
  const startedAt = Date.now();
  const mark = (what: string) => console.log(`${APP}: ${what} +${Date.now() - startedAt}ms`);

  mark("script evaluated");

  void (async () => {
    void paintNow();

    // The cache carries the scale it was drawn in, so this frame waits for neither the settings nor the network.
    const restored = restoreCached(Date.now());
    if (restored) {
      phase = { screen: "weather" };
      void paintNow();
      mark("cached forecast on screen");
    }

    const stored = settings;
    settings = await loadSettings();
    setUnits(settings.units);
    mark("settings read");

    // Settings changed since that frame: redraw it in the right scale.
    if (restored && viewChanged(stored, settings)) {
      forecastHours = forecastHours.map((hour) => ({
        ...hour,
        temp: fromUnits(Math.round(toUnits(hour.temp))),
      }));
      applyWindow();
      void paintNow();
    }

    if (!restored) mark("no usable cache, waiting on the network");

    await firstForecast();
    if (stopped) return;
    mark("forecast fetched");

    // Started only once the settings are in hand, so no refresh runs against the wrong place.
    refreshTimer = setInterval(() => {
      void refresh()
        .then(() => paintNow())
        .catch(report);
    }, REFRESH_MS);

    scheduleClock();
  })();

  unbindInput = listen("input", (event) => {
    if (stopped) return;

    if (event.key === "encoder") {
      if (!scroll(event.delta)) return;
      draw();
      return;
    }

    if (event.action !== "press") return;

    if (event.key === "back") {
      stop();
      return;
    }

    nextScreen();
    void paintNow().catch(report);
  });
}
