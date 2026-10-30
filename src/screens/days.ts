// The multi-day screen: one day at a time, split into daylight and night.
//
//   ┌────────────────────────┐
//   │  9 Mon  DAY    NIGHT   │
//   │ 10 Tue  ☀ +23  ☾ +20   │
//   │ 11 Wed                 │
//   └────────────────────────┘
//
// Turning the encoder leaves the rows where they are and changes only their texts, so a step
// sends the texts that changed and nothing else.

import { formatDay, formatWeekday } from "@shared/datetime";
import type { DayForecast } from "../api.ts";
import type { Frame } from "../frame.ts";
import { textWidth } from "../font.ts";
import { formatTemp } from "../temp.ts";
import { iconFor } from "../wmo.ts";

const ROW_Y = 3;
const ROW_STEP = 7;

const DAY_RIGHT = 8;
const WEEKDAY_X = 9;

const DAY_X = 28;
const NIGHT_X = 50;
const LABEL_Y = -1;
const ICON_Y = 8;
const TEMP_Y = 7;

/** Space the icon takes before the reading: a 7×7 picture and a clear column. */
const ICON_W = 8;

const WHITE = "#FFFFFFFF";
const DIM = "#808080FF";
const DAY_COLOR = "#FFBA0EFF";
const NIGHT_COLOR = "#5098F3FF";

const ROWS = [
  { day: "text-a", weekday: "text-b" },
  { day: "text-c", weekday: "text-d" },
  { day: "text-e", weekday: "text-f" },
] as const;

interface Half {
  label: string;
  color: string;
  x: number;
  /** Ids shared with the other screens, so moving between them redraws an element instead of replacing it. */
  labelId: string;
  iconId: string;
  tempId: string;
}

const DAYLIGHT: Half = {
  label: "DAY",
  color: DAY_COLOR,
  x: DAY_X,
  labelId: "text-day",
  iconId: "image-icon",
  tempId: "text-temp",
};

const NIGHT: Half = {
  label: "NIGHT",
  color: NIGHT_COLOR,
  x: NIGHT_X,
  labelId: "text-night",
  iconId: "image-icon2",
  tempId: "text-sub",
};

/** The date labels for the forecast on show; rebuilt only when a new forecast arrives. */
let labelled: DayForecast[] | undefined;
let dayLabels: string[] = [];
let weekdayLabels: string[] = [];

function label(days: DayForecast[]) {
  if (labelled === days) return;

  dayLabels = [];
  weekdayLabels = [];

  for (const day of days) {
    // UTC noon, read back with the UTC getters of `@shared/datetime`, so the date is the same in
    // any timezone the device is set to.
    const at = new Date(`${day.date}T12:00:00Z`);
    dayLabels.push(formatDay(at));
    weekdayLabels.push(formatWeekday(at));
  }

  labelled = days;
}

function half(frame: Frame, side: Half, code: number, temp: number, daylight: boolean) {
  frame.text(side.labelId, side.label, "small", side.color, side.x, LABEL_Y);
  frame.image(side.iconId, iconFor(code, daylight), side.x, ICON_Y);
  frame.text(side.tempId, formatTemp(temp, "none"), "small", WHITE, side.x + ICON_W, TEMP_Y);
}

/**
 * The frame.
 *
 * @param days every day of the forecast
 * @param at index of the day on show
 */
export function daysScreen(frame: Frame, days: DayForecast[], at: number) {
  label(days);

  for (let row = 0; row < ROWS.length; row++) {
    const index = at + row - 1;
    // Past either end of the forecast the row is left empty, and its elements are cleared.
    if (index < 0 || index >= days.length) continue;

    const ids = ROWS[row]!;
    const color = index === at ? WHITE : DIM;
    const y = ROW_Y + (row - 1) * ROW_STEP;
    const day = dayLabels[index]!;

    frame.text(ids.day, day, "small", color, DAY_RIGHT - textWidth(day, "small"), y);
    frame.text(ids.weekday, weekdayLabels[index]!, "small", color, WEEKDAY_X, y);
  }

  const current = days[at]!;
  half(frame, DAYLIGHT, current.dayCode, current.day, true);
  half(frame, NIGHT, current.nightCode, current.night, false);
}
