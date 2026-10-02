// The multi-day screen: one day at a time, split into daylight and night.
//
//   ┌────────────────────────┐
//   │ DAY   ☀ +23   23 May   │
//   │ NIGHT ☾ +20   24 May   │
//   └────────────────────────┘

import { formatDay, formatMonth } from "@shared/datetime";
import type { DayForecast } from "../api.ts";
import type { Frame } from "../frame.ts";
import { textBox } from "../font.ts";
import { createList } from "../list.ts";
import { center, SCREEN } from "../screen.ts";
import { formatTemp } from "../temp.ts";
import { iconFor } from "../wmo.ts";

const ICON = { width: 7, height: 7 };

/** Space between a label, its icon and its reading. */
const GAP = 1;

/** Width of "NIGHT", so both rows line up. */
const LABEL_W = 21;

const DAY_COLOR = "#F5A623FF";
const NIGHT_COLOR = "#4A90D9FF";

const PANEL_W = 47;
const PANEL_COLOR = "#0A1A4AFF";

/** Redrawing one element alone leaves the panel on top of it unless the order is spelled out. */
const PANEL_Z = 10;
const CONTENT_Z = 50;

const WHITE = "#FFFFFFFF";
const DIM = "#808080FF";

/** The height of one half-row; the icon sets it. */
const ROW_H = ICON.height;

/** The second half-row starts here, against the bottom of the screen. */
const NIGHT_Y = SCREEN.height - ROW_H;

/** The icon and reading sit after the label. */
const ICON_X = LABEL_W + GAP;
const TEMP_X = ICON_X + ICON.width + GAP;

const LIST_W = SCREEN.width - PANEL_W - 1;

/** Clear space between the dates and the scrollbar. */
const DATE_GAP = 2;

const BAR_W = 1;
const TRACK_COLOR = "#404040FF";
const THUMB_COLOR = "#FFFFFFFF";

/** The dates as they are drawn, by ISO date. */
const dates = new Map<string, string>();

/** "23 May" */
function formatDate(date: string): string {
  const known = dates.get(date);
  if (known !== undefined) return known;

  const at = new Date(`${date}T12:00:00`);
  const text = `${formatDay(at)} ${formatMonth(at)}`;
  dates.set(date, text);
  return text;
}

interface Slot {
  label: string;
  icon: string;
  temp: string;
}

/** Ids shared with the other screens, so moving between them redraws an element instead of replacing it. */
const DAY_SLOT: Slot = { label: "text-a", icon: "image-icon", temp: "text-temp" };
const NIGHT_SLOT: Slot = { label: "text-b", icon: "image-icon2", temp: "text-sub" };

const dateList = createList({
  id: "list",
  x: PANEL_W + 1,
  y: 0,
  width: LIST_W,
  height: SCREEN.height,
  font: "small",
  gap: DATE_GAP,
  color: DIM,
  activeColor: WHITE,
  scrollbar: "right",
  trackColor: TRACK_COLOR,
  thumbColor: THUMB_COLOR,
  scrollbarGap: 1,
  scrollbarWidth: BAR_W,
  z_index: CONTENT_Z,
});

/** The labels for the forecast on show; rebuilt only when a new forecast arrives. */
let labelled: DayForecast[] | undefined;
let labels: string[] = [];

/**
 * One half of the day: its name, its condition and its mean temperature.
 *
 * @param slot - Which element ids this half draws under.
 * @param y - Where the half-row starts.
 */
function half(
  frame: Frame,
  slot: Slot,
  label: string,
  color: string,
  code: number,
  temp: number,
  y: number,
  daylight: boolean,
): void {
  const labelBox = textBox(label, "small");
  const reading = formatTemp(temp, "none");
  const readingBox = textBox(reading, "small");

  frame.text(slot.label, label, "small", color, 0, y + center(labelBox.height, ROW_H) - labelBox.top, CONTENT_Z);
  frame.image(slot.icon, iconFor(code, daylight), ICON_X, y, CONTENT_Z);
  frame.text(
    slot.temp,
    reading,
    "small",
    WHITE,
    TEMP_X,
    y + center(readingBox.height, ROW_H) - readingBox.top,
    CONTENT_Z,
  );
}

/**
 * The frame.
 *
 * @param days every day of the forecast
 * @param at index of the day on show
 */
export function daysScreen(frame: Frame, days: DayForecast[], at: number): void {
  if (labelled !== days) {
    labels = days.map((day) => formatDate(day.date));
    labelled = days;
  }

  const current = days[at]!;

  frame.rectangle("rect-panel", 0, 0, PANEL_W, SCREEN.height, PANEL_COLOR, PANEL_Z);
  half(frame, DAY_SLOT, "DAY", DAY_COLOR, current.dayCode, current.day, 0, true);
  half(frame, NIGHT_SLOT, "NIGHT", NIGHT_COLOR, current.nightCode, current.night, NIGHT_Y, false);
  dateList.draw(frame, labels, at);
}
