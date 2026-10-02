import { displayClear, displayDraw, outstanding, whenSettled } from "@shared/device";
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
import { Frame } from "./frame.ts";

type Phase =
  | { screen: "loading"; text: string }
  | { screen: "weather" }
  | { screen: "forecast"; hour: number }
  | { screen: "days"; day: number };

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** How often the forecast is fetched again. */
const REFRESH_MS = 15 * 60 * 1000;

/** The clock on the weather screen is repainted on the minute. */
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Added to the wait so the tick lands after the minute has rolled over, not on its edge. */
const MINUTE_SKEW_MS = 50;

/** The current conditions, the hours of the graph, and the days after them. */
let weather: CurrentWeather | undefined;
let forecastHours: ForecastHour[] = [];
let hours: ForecastHour[] = [];
let days: DayForecast[] = [];
let utcOffsetMs = 0;
let localDay = 0;

let graph: Graph = { bitmap: "", pins: [] };

/** Read once at startup; a change takes effect when the app is restarted. */
let settings: Settings = DEFAULTS;

let phase: Phase = { screen: "loading", text: "Loading settings" };

/** Reads the forecast. Failures leave the last good data on screen. */
async function refresh(): Promise<void> {
  const place = settings.location;
  const forecast = await fetchForecast(place.mode === "fixed" ? place : undefined);
  const selectedDate = phase.screen === "days" ? days[phase.day]?.date : undefined;
  const now = Date.now();

  weather = forecast.current;
  days = forecast.days;
  utcOffsetMs = forecast.utcOffsetSeconds * 1000;
  forecastHours = forecast.hours;

  updateHours(now);
  updateDays(now, selectedDate);
}

function localDayOf(now: number) {
  return Math.floor((now + utcOffsetMs) / DAY_MS);
}

function updateDays(now: number, selectedDate: string | undefined) {
  localDay = localDayOf(now);
  const today = new Date(localDay * DAY_MS).toISOString().slice(0, 10);

  let first = 0;
  while (first < days.length && days[first]!.date < today) {
    first++;
  }

  if (first > 0) {
    days = days.slice(first);
  }

  if (phase.screen === "days") {
    phase = days.length > 0
      ? { screen: "days", day: Math.max(0, days.findIndex((day) => day.date === selectedDate)) }
      : { screen: "weather" };
  }
}

function updateHours(now: number) {
  const selectedTime = phase.screen === "forecast" ? hours[phase.hour]?.time : undefined;

  let first = 0;
  while (first < forecastHours.length && forecastHours[first]!.time + HOUR_MS <= now) {
    first++;
  }

  // One rounding for both, so bar heights and readings agree.
  hours = forecastHours.slice(first, first + HOURS).map((hour) => ({
    ...hour,
    temp: fromUnits(Math.round(toUnits(hour.temp))),
  }));

  graph = hours.length > 0 ? buildGraph(hours.map((hour) => hour.temp)) : { bitmap: "", pins: [] };
  if (phase.screen === "forecast") {
    phase = hours.length > 0
      ? { screen: "forecast", hour: Math.max(0, hours.findIndex((hour) => hour.time === selectedTime)) }
      : { screen: "weather" };
  }
}

/** The elements on screen, kept between frames so only what moved is rebuilt and sent. */
const frame = new Frame();

/** A frame was asked for while the device still had one; it goes out when the device answers. */
let held = false;

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let endWait: (() => void) | undefined;
let unbindInput: BusyUnbind | undefined;
let stopped = false;

function stop() {
  if (stopped) return;

  stopped = true;
  held = false;

  if (refreshTimer !== undefined) clearInterval(refreshTimer);
  if (clockTimer !== undefined) clearTimeout(clockTimer);
  if (retryTimer !== undefined) clearTimeout(retryTimer);

  endWait?.();

  if (unbindInput) setTimeout(unbindInput, 10);
}

/** The loading screen needs no data; every other one waits for the first forecast. */
function drawable(): boolean {
  return phase.screen === "loading" || weather !== undefined;
}

/**
 * Draws whichever screen is due and sends it, without waiting for the device to answer.
 *
 * Elements are addressed by id, so only what differs is sent: a step through the graph sends the
 * pin and the readings, never the bars behind them. Nothing blocks on the request: when one is
 * still outstanding the frame is held, and the newest state goes out as soon as the device is
 * free — so a fast spin skips intermediate positions instead of queueing them up.
 */
function paintNow(): void {
  if (stopped || !drawable()) return;

  // The device works through one request at a time, so queueing more only makes every frame later.
  // Hold the newest frame until it answers, then send that one and skip everything in between.
  if (outstanding() > 0) {
    held = true;
    return;
  }
  held = false;

  frame.begin();

  if (phase.screen === "loading") {
    loadingScreen(frame, phase.text);
  } else if (phase.screen === "weather") {
    weatherScreen(frame, weather!, new Date(), {
      time: settings.showTime,
      date: settings.showDate,
    });
  } else if (phase.screen === "forecast") {
    forecastScreen(frame, hours, graph, phase.hour);
  } else {
    daysScreen(frame, days, phase.day);
  }

  frame.end();

  // Both at once; neither names an element the other does, so the order they arrive in does not matter.
  if (frame.changed.length > 0) {
    displayDraw({ application_name: APP, priority: 50, elements: frame.changed });
  }
  if (frame.stale.length > 0) {
    displayClear({ application_name: APP, element_ids: frame.stale });
  }
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

function scheduleClock() {
  if (stopped) {
    return;
  }

  clockTimer = setTimeout(
    () => {
      clockTimer = undefined;
      if (stopped) return;

      const now = Date.now();
      const dayChanged = localDayOf(now) !== localDay;

      const redrawForDay = dayChanged && (phase.screen === "days" || phase.screen === "weather");

      if (dayChanged) {
        updateDays(now, phase.screen === "days" ? days[phase.day]?.date : undefined);
      }

      if (hours.length > 0 && hours[0]!.time + HOUR_MS <= now) {
        updateHours(now);
        paintNow();
      } else if (redrawForDay || (settings.showTime && phase.screen === "weather")) {
        paintNow();
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
async function firstForecast(report: (err: unknown) => void) {
  for (let attempt = 0; !stopped; attempt++) {
    try {
      await refresh();
      if (stopped) return;
      phase = { screen: "weather" };
      paintNow();
      return;
    } catch (err) {
      report(err);
    }

    await wait(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!);
  }
}

export default function run() {
  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);

  // The frame that was held back goes out the moment the device answers the one it had.
  whenSettled(() => {
    if (held && !stopped) paintNow();
  });

  // The settings decide which place is asked for and in which scale the readings are drawn, so they come before the first forecast. loadSettings() handles its own failures.
  void (async () => {
    paintNow();

    settings = await loadSettings();
    setUnits(settings.units);

    phase = { screen: "loading", text: "Loading weather" };
    paintNow();

    await firstForecast(report);
    if (stopped) return;

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
      paintNow();
      return;
    }

    if (event.action !== "press") return;

    if (event.key === "back") {
      stop();
      return;
    }

    nextScreen();
    paintNow();
  });
}
