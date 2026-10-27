// The forecast screen: the day ahead, one hour at a time.
//
//   ┌────────────────────────┐
//   │ 12:00           ☀ +23° │
//   │ ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇  │
//   └────────────────────────┘
//
// Everything on it describes the hour the pin stands on, not the present one.
//
// The chart is a few XPM2 strips, built once per forecast. The pin is a static PNG that is moved
// across them, so stepping through the hours re-texts the readings and moves the pin, and sends
// nothing that did not change.

import type { ForecastHour } from "../api.ts";
import { GRAPH_W, type Graph } from "../graph.ts";
import type { Frame } from "../frame.ts";
import { textBox, textWidth } from "../font.ts";
import { center, SCREEN } from "../screen.ts";
import { formatTemp } from "../temp.ts";
import { iconFor } from "../wmo.ts";

/** The icon asset: a 7×7 picture with a clear column and row after it. */
const ICON = { width: 8, height: 8 };

/** Height of the line above the graph; the picture in the icon sets it. */
const ROW_H = 7;

/** The graph takes the rest of the screen, below that line. */
const GRAPH_Y = SCREEN.height - 8;

/** The clock opens the line. */
const TIME_X = 1;

/** Where the icon stands, unless a wide reading pushes it to the left. */
const ICON_X = 48;

const WHITE = "#FFFFFFFF";
/** The clock is dimmed: it labels the hour rather than telling the time. */
const DIM = "#808080FF";

const PIN_Z = 60;

/** "12:00" for an hour, built once per hour of the day. */
const HOUR_LABELS: string[] = [];

function formatHour(hour: number): string {
  let label = HOUR_LABELS[hour];
  if (label === undefined) {
    label = `${String(hour).padStart(2, "0")}:00`;
    HOUR_LABELS[hour] = label;
  }
  return label;
}

/** One id per strip of the chart, made once; a forecast that needs fewer clears the rest. */
const STRIP_IDS: string[] = [];

function stripId(index: number): string {
  let id = STRIP_IDS[index];
  if (id === undefined) {
    id = `xpm-graph-${index}`;
    STRIP_IDS[index] = id;
  }
  return id;
}

/**
 * The frame.
 *
 * @param hours every hour the graph draws
 * @param graph the chart and the pin position for each hour
 * @param at index into `hours` of the one the pin sits on
 */
export function forecastScreen(frame: Frame, hours: ForecastHour[], graph: Graph, at: number): void {
  const current = hours[at]!;
  const pin = graph.pins[at]!;

  const time = formatHour(current.hour);
  const timeBox = textBox(time, "small");
  const temp = formatTemp(current.temp, "degree");
  const tempBox = textBox(temp, "small");

  // The reading is held against the right edge; the icon goes before it, moving left only when a
  // wide one, "+104°", would run into it.
  const tempX = GRAPH_W - textWidth(temp, "small");

  frame.text("text-sub", time, "small", DIM, TIME_X, center(timeBox.height, ROW_H) - timeBox.top);
  frame.image("image-icon", iconFor(current.code, current.daylight), Math.min(ICON_X, tempX - ICON.width), 0);
  frame.text("text-temp", temp, "small", WHITE, tempX, center(tempBox.height, ROW_H) - tempBox.top);

  for (let i = 0; i < graph.strips.length; i++) {
    const strip = graph.strips[i]!;
    frame.xpm(stripId(i), strip.data, strip.x, GRAPH_Y + strip.y);
  }

  frame.image("pin", "images/pin.png", pin.x, GRAPH_Y + pin.y, PIN_Z);
}
