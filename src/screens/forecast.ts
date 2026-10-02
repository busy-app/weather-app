// The forecast screen: the day ahead, one hour at a time.
//
//   ┌────────────────────────┐
//   │ ☀ +23°          12:00  │
//   │ ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇  │
//   └────────────────────────┘
//
// Everything on it describes the hour the pin stands on, not the present one.
//
// The bars are one XPM2 bitmap, built once per forecast. The pin is a static PNG that is
// moved across the graph, so stepping through the hours re-texts the readings and moves the
// pin, and sends nothing that did not change.

import type { ForecastHour } from "../api.ts";
import { GRAPH_W, type Graph } from "../graph.ts";
import type { Frame } from "../frame.ts";
import { textBox, textWidth } from "../font.ts";
import { center } from "../screen.ts";
import { formatTemp } from "../temp.ts";
import { iconFor } from "../wmo.ts";

const ICON = { width: 7, height: 7 };

/** Space between the icon and the temperature. */
const GAP = 2;

/** Height of the line above the graph; the icon sets it. */
const ROW_H = ICON.height;

/** The graph starts right below that line. */
const GRAPH_Y = ROW_H;

const WHITE = "#FFFFFFFF";
/** The clock is dimmed: it labels the hour rather than telling the time. */
const DIM = "#AAAAAAFF";

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

/**
 * The frame.
 *
 * @param hours every hour the graph draws
 * @param graph the bars and the pin position for each hour
 * @param at index into `hours` of the one the pin sits on
 */
export function forecastScreen(frame: Frame, hours: ForecastHour[], graph: Graph, at: number): void {
  const current = hours[at]!;
  const pin = graph.pins[at]!;

  const temp = formatTemp(current.temp, "degree");
  const tempBox = textBox(temp, "small");
  const sub = formatHour(current.hour);
  const subBox = textBox(sub, "small");

  frame.image("image-icon", iconFor(current.code, current.daylight), 0, 0);
  frame.text("text-temp", temp, "small", WHITE, ICON.width + GAP, center(tempBox.height, ROW_H) - tempBox.top);
  frame.text(
    "text-sub",
    sub,
    "small",
    DIM,
    GRAPH_W - textWidth(sub, "small"),
    center(subBox.height, ROW_H) - subBox.top,
  );
  frame.xpm("xpm-graph", graph.bitmap, 0, GRAPH_Y);
  frame.image("pin", "images/pin.png", pin.x, GRAPH_Y + pin.y, PIN_Z);
}
