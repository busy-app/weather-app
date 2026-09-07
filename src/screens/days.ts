// The multi-day screen: one day at a time, split into daylight and night.
//
//   ┌────────────────────────┐
//   │ DAY   ☀ +23   23 May   │
//   │ NIGHT ☾ +20   24 May   │
//   └────────────────────────┘

import { formatDay, formatMonth } from "@shared/datetime";
import { column, row, SCREEN, stack, type Node } from "@shared/layout";
import { generateXpm2 } from "@shared/xpm2";
import type { DayForecast } from "../api.ts";
import { formatTemp } from "../temp.ts";
import { iconFor } from "../wmo.ts";

const ICON = { width: 7, height: 7 };

/** Space between a label, its icon and its reading. */
const GAP = 1;

/** Width of "NIGHT", so both rows line up. */
const LABEL_W = 21;

const DAY_COLOR = "#F5A623FF";
const NIGHT_COLOR = "#4A90D9FF";

const PANEL_W = 48;
const PANEL_COLOR = "#0A1A4AFF";

/** Redrawing one element alone leaves the panel on top of it unless the order is spelled out. */
const PANEL_Z = 10;
const CONTENT_Z = 50;

/** Rows of the date list; the neighbours fall off the edges. */
const DATE_STEP = 7;
const DATE_MIDDLE = 5;

const WHITE = "#FFFFFFFF";
const DIM = "#808080FF";

const TOP_DY = 0;
const BOTTOM_DY = 0;

/** Clear space between the dates and the scrollbar. */
const DATE_GAP = 1;

const BAR_W = 1;
const TRACK_COLOR = "#404040";
const THUMB_COLOR = "#FFFFFF";

/** A full-height track with a thumb marking the selected day. */
function scrollbar(count: number, at: number): string {
  const track = ".";
  const thumb = "#";
  const size = Math.max(2, Math.round(SCREEN.height / count));
  const top = Math.min(
    SCREEN.height - size,
    Math.round((at / Math.max(1, count - 1)) * (SCREEN.height - size)),
  );

  const rows: string[] = [];
  for (let y = 0; y < SCREEN.height; y++) {
    rows.push(y >= top && y < top + size ? thumb : track);
  }

  return generateXpm2({
    palette: { [track]: TRACK_COLOR, [thumb]: THUMB_COLOR },
    grid: rows,
  });
}

/** "23 May" */
function formatDate(date: string): string {
  const at = new Date(`${date}T12:00:00`);
  return `${formatDay(at)} ${formatMonth(at)}`;
}

/** One half of the day: its name, its condition and its mean temperature. */
function half(
  name: string,
  label: string,
  color: string,
  code: number,
  temp: number,
  dy: number,
  daylight: boolean,
): Node {
  return row({ align: "center", gap: GAP }, [
    row({ width: LABEL_W }, [
      {
        type: "text",
        id: `${name}-label`,
        text: label,
        font: "small",
        color,
        dy,
        z_index: CONTENT_Z,
      },
    ]),
    {
      type: "image",
      id: `${name}-icon`,
      path: `images/${iconFor(code, daylight)}`,
      opacity: 100,
      dy,
      z_index: CONTENT_Z,
      ...ICON,
    },
    {
      type: "text",
      id: `${name}-temp`,
      text: formatTemp(temp, ""),
      font: "small",
      color: WHITE,
      dy,
      z_index: CONTENT_Z,
    },
  ]);
}

/**
 * The frame.
 *
 * @param days every day of the forecast
 * @param at index of the day on show
 */
export function daysScreen(days: DayForecast[], at: number): Node {
  const current = days[at];

  return stack({}, [
    {
      type: "rectangle",
      id: "panel",
      width: PANEL_W,
      height: SCREEN.height,
      // Without these a rectangle is a white outline and nothing else.
      fill: "solid",
      fill_colors: [PANEL_COLOR],
      border_width: 0,
      z_index: PANEL_Z,
    },
    row({ height: SCREEN.height }, [
      column({ justify: "between", width: PANEL_W, height: SCREEN.height }, [
        half("day", "DAY", DAY_COLOR, current.dayCode, current.day, TOP_DY, true),
        half("night", "NIGHT", NIGHT_COLOR, current.nightCode, current.night, BOTTOM_DY, false),
      ]),
      stack(
        {
          width: SCREEN.width - PANEL_W - BAR_W,
          // In a stack `justify` is the horizontal placement.
          justify: "end",
          padding: { right: DATE_GAP },
        },
        [
          {
            type: "text",
            id: "date-prev",
            text: at > 0 ? formatDate(days[at - 1].date) : "",
            font: "small",
            color: DIM,
            dy: DATE_MIDDLE - DATE_STEP,
            z_index: CONTENT_Z,
          },
          {
            type: "text",
            id: "date",
            text: formatDate(current.date),
            font: "small",
            color: WHITE,
            dy: DATE_MIDDLE,
            z_index: CONTENT_Z,
          },
          {
            type: "text",
            id: "date-next",
            text: at + 1 < days.length ? formatDate(days[at + 1].date) : "",
            font: "small",
            color: DIM,
            dy: DATE_STEP + DATE_MIDDLE,
            z_index: CONTENT_Z,
          },
        ],
      ),
      {
        type: "xpmbitmap",
        id: "scrollbar",
        data: scrollbar(days.length, at),
        opacity: 100,
        width: BAR_W,
        height: SCREEN.height,
        z_index: CONTENT_Z,
      },
    ]),
  ]);
}
