import "./font.ts";
import { MINUTE_MS, wallClock } from "@shared/datetime";
import {
  displayClear,
  displayDraw,
  getWifiState,
  outstanding,
  whenSettled,
  type WifiState,
} from "@shared/device";
import { errorText } from "@shared/errors";
import manifest from "./appmeta/manifest.json";
import {
  fetchForecast,
  OfflineError,
  type CurrentWeather,
  type DayForecast,
  type ForecastHour,
} from "./api.ts";
import { buildGraph, HOURS, NO_GRAPH, type Graph } from "./graph.ts";
import { daysScreen } from "./screens/days.ts";
import { errorScreen, FAILED, OFFLINE, type ErrorText } from "./screens/error.ts";
import { forecastScreen } from "./screens/forecast.ts";
import { loadingScreen } from "./screens/loading.ts";
import { weatherScreen } from "./screens/weather.ts";
import { DEFAULTS, loadSettings, type Settings } from "./settings.ts";
import { fromUnits, setUnits, toUnits } from "./temp.ts";
import { Frame } from "./frame.ts";

type Phase =
  | { screen: "loading"; text: string }
  | { screen: "error"; text: ErrorText }
  | { screen: "weather" }
  | { screen: "forecast"; hour: number }
  | { screen: "days"; day: number };

type Screen = (typeof SCREENS)[number];

const APP = manifest.id;

const REFRESH_MS = 15 * 60 * 1000;

const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Added to the wait so the tick lands after the minute has rolled over, not on its edge. */
const MINUTE_SKEW_MS = 50;

const RESEND_MS = 1000;

let weather: CurrentWeather | undefined;
let forecastHours: ForecastHour[] = [];
let hours: ForecastHour[] = [];
let days: DayForecast[] = [];
let utcOffsetMs = 0;
let localDay = 0;

let graph: Graph = NO_GRAPH;

/** Read once at startup; a change takes effect when the app is restarted. */
let settings: Settings = DEFAULTS;

const LOADING_TEXT = "Loading weather...";

let phase: Phase = { screen: "loading", text: LOADING_TEXT };

/** False until the Wi-Fi state has picked the loader text, so the first frame never shows a text that is about to change. */
let linkChecked = false;

const RETRY_MS = [3000, 6000, 12000, 24000, 48000, 60000];

const JOINING_TEXT = "Connecting Wi-Fi";
const JOINING_RETRY_MS = 2000;
const JOINING_MAX_MS = 15000;

/** Right after boot the link reads as disconnected until the firmware starts joining, so the first checks wait whatever it says. */
const JOINING_WAITS = 5;

/** Requests right after the link comes up still fail: hold the loader instead of flashing the error. */
const SETTLE_ATTEMPTS = 3;

let joining = false;
let settleAttempts = 0;

/** The interval and the hour rollover can both ask for a forecast; one at a time keeps an older reply from landing after a newer one. */
let refreshing = false;

const frame = new Frame();

let held = false;

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let resendTimer: ReturnType<typeof setTimeout> | undefined;
let endWait: (() => void) | undefined;
let unbindInput: BusyUnbind | undefined;
let stopped = false;

/** `loading` and `error` are not among them: they are left behind for good once the forecast arrives. */
const SCREENS = ["weather", "forecast", "days"] as const;

function report(err: unknown, context?: string) {
  const text = errorText(err);
  console.error(context === undefined ? `${APP}: ${text}` : `${APP}: ${context}: ${text}`);
}

async function refresh() {
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

function windowStart(now: number) {
  let first = 0;
  while (first < forecastHours.length && forecastHours[first]!.time + HOUR_MS <= now) {
    first++;
  }

  return first;
}

function updateHours(now: number) {
  const selectedTime = phase.screen === "forecast" ? hours[phase.hour]?.time : undefined;
  const first = windowStart(now);

  // One rounding for both, so bar heights and readings agree.
  hours = forecastHours.slice(first, first + HOURS).map((hour) => ({
    ...hour,
    temp: fromUnits(Math.round(toUnits(hour.temp))),
  }));

  graph = buildGraph(hours.map((hour) => hour.temp));

  if (phase.screen === "forecast") {
    phase = hours.length > 0
      ? { screen: "forecast", hour: Math.max(0, hours.findIndex((hour) => hour.time === selectedTime)) }
      : { screen: "weather" };
  }
}

/**
 * Requests still in flight are not waited for: the runtime itself keeps the app alive until they
 * settle, and `stopped` keeps their callbacks from drawing or starting anything new.
 *
 * The unbind waits for a timer: it is the last handle, and `back` calls this from inside the input
 * handler, which is still running.
 */
function stop() {
  if (stopped) return;

  stopped = true;
  held = false;

  if (refreshTimer !== undefined) clearInterval(refreshTimer);
  if (clockTimer !== undefined) clearTimeout(clockTimer);
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  if (resendTimer !== undefined) clearTimeout(resendTimer);

  endWait?.();
  endWait = undefined;

  const unbind = unbindInput;
  unbindInput = undefined;

  if (unbind !== undefined) {
    setTimeout(unbind, 0);
  }
}

function drawable() {
  if (!linkChecked) return false;

  return phase.screen === "loading" || phase.screen === "error" || weather !== undefined;
}

function paintNow() {
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
  } else if (phase.screen === "error") {
    errorScreen(frame, phase.text);
  } else if (phase.screen === "weather") {
    weatherScreen(frame, weather!, wallClock(Date.now(), utcOffsetMs), {
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

function filled(screen: Screen) {
  if (screen === "forecast") return hours.length > 0;
  if (screen === "days") return days.length > 0;

  return weather !== undefined;
}

function nextScreen() {
  // Before the first forecast there is no current screen; -1 starts the search at the first one.
  const from = phase.screen === "loading" || phase.screen === "error" ? -1 : SCREENS.indexOf(phase.screen);

  for (let offset = 1; offset <= SCREENS.length; offset++) {
    const screen = SCREENS[(from + offset) % SCREENS.length];
    if (!filled(screen)) continue;

    if (screen === "weather") phase = { screen: "weather" };
    else if (screen === "forecast") phase = { screen: "forecast", hour: 0 };
    else phase = { screen: "days", day: 0 };

    return;
  }
}

function scroll(delta: number) {
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

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    endWait = resolve;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      endWait = undefined;
      resolve();
    }, ms);
  });
}

async function refreshAndPaint() {
  if (refreshing) return;

  refreshing = true;

  try {
    await refresh();
  } catch (err) {
    report(err);
    // The graph still slides on to the current hour with the readings already fetched.
    updateHours(Date.now());
  } finally {
    refreshing = false;
  }

  paintNow();
}

function scheduleClock() {
  if (stopped) return;

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
        if (forecastHours.length - windowStart(now) >= HOURS) {
          updateHours(now);
          paintNow();
        } else {
          refreshAndPaint();
        }
      } else if (redrawForDay || (settings.showTime && phase.screen === "weather")) {
        paintNow();
      }

      scheduleClock();
    },
    MINUTE_MS - (Date.now() % MINUTE_MS) + MINUTE_SKEW_MS,
  );
}

/** A status that cannot be read does not stop the app: the forecast request that follows decides what to show. */
async function linkState() {
  try {
    return await getWifiState();
  } catch (err) {
    report(err, "wifi status");
    return undefined;
  }
}

/** A status that could not be read is no reason to wait: it says nothing about the link joining. */
function linkPending(state: WifiState | undefined, waited: number) {
  if (state === undefined || state === "connected") return false;

  return state === "connecting" || state === "reconnecting" || waited < JOINING_WAITS;
}

/**
 * The first checks keep the boot pace, so the weather follows a join quickly. A link that never
 * joins, such as one with a wrong password, is asked about less and less often.
 */
function joiningDelay(streak: number) {
  if (streak < JOINING_WAITS) return JOINING_RETRY_MS;

  return Math.min(JOINING_RETRY_MS * 2 ** (streak - JOINING_WAITS + 1), JOINING_MAX_MS);
}

async function failure(err: unknown): Promise<Phase> {
  if (err instanceof OfflineError) {
    const state = await linkState();

    if (state === "connecting" || state === "reconnecting") {
      joining = true;
      settleAttempts = 0;
      return { screen: "loading", text: JOINING_TEXT };
    }

    if (joining && settleAttempts < SETTLE_ATTEMPTS) {
      settleAttempts++;
      return { screen: "loading", text: JOINING_TEXT };
    }
  }

  joining = false;

  return { screen: "error", text: err instanceof OfflineError ? OFFLINE : FAILED };
}

/**
 * Without this a start with no network would sit on the spinner until the refresh interval came
 * round a quarter of an hour later.
 */
async function firstForecast() {
  for (let attempt = 0, waited = 0, streak = 0; !stopped;) {
    const pending = linkPending(await linkState(), waited);
    if (stopped) return;

    if (pending) {
      waited++;
      joining = true;
      settleAttempts = 0;
      phase = { screen: "loading", text: JOINING_TEXT };
      paintNow();
      await wait(joiningDelay(streak));
      streak++;
      continue;
    }

    streak = 0;

    if (phase.screen === "loading") {
      phase = { screen: "loading", text: LOADING_TEXT };
      paintNow();
    }

    try {
      await refresh();
      if (stopped) return;

      phase = { screen: "weather" };
      paintNow();
      return;
    } catch (err) {
      report(err);
      if (stopped) return;

      phase = await failure(err);
      if (stopped) return;

      paintNow();
    }

    if (phase.screen === "loading") {
      await wait(JOINING_RETRY_MS);
    } else {
      await wait(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!);
      attempt++;
    }
  }
}

async function start() {
  try {
    // Starting on "Loading weather" and switching to "Connecting Wi-Fi" a moment later makes the screen flicker, so the link is asked for before the first frame.
    const state = await linkState();
    if (stopped) return;

    phase = { screen: "loading", text: linkPending(state, 0) ? JOINING_TEXT : LOADING_TEXT };
    linkChecked = true;
    paintNow();

    // The settings decide which place is asked for and in which scale the readings are drawn, so they come before the first forecast.
    settings = await loadSettings();
    if (stopped) return;

    setUnits(settings.units);

    await firstForecast();
    if (stopped) return;

    // Started only once the settings are in hand, so no refresh runs against the wrong place.
    refreshTimer = setInterval(refreshAndPaint, REFRESH_MS);

    scheduleClock();
  } catch (err) {
    report(err);
  }
}

/** Called at the end of the file: the device runs this script from top to bottom and starts nothing by itself. */
function main() {
  whenSettled((failed) => {
    if (stopped) return;

    if (failed) {
      frame.invalidate();

      if (resendTimer === undefined) {
        resendTimer = setTimeout(() => {
          resendTimer = undefined;
          paintNow();
        }, RESEND_MS);
      }
    }

    if (held) paintNow();
  });

  start();

  unbindInput = listen("input", (event) => {
    if (stopped) return;

    if (event.key === "encoder") {
      if (!scroll(event.delta)) return;

      paintNow();
      return;
    }

    if (event.key === "back") {
      if (event.action === "short") stop();
      return;
    }

    if (event.action !== "short") return;

    nextScreen();
    paintNow();
  });
}

main();
