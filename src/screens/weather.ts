// The weather screen: what it is doing outside, right now.
//
//   ┌────────────────────────┐
//   │ ☀  +15°C               │
//   │    25 Aug, 15:34       │
//   └────────────────────────┘
//
// The animation holds the left edge; everything else is text stacked beside it.

import { formatDay, formatHM, formatMonth } from "@shared/datetime";
import type { CurrentWeather } from "../api.ts";
import type { Frame } from "../frame.ts";
import { textBox } from "../font.ts";
import { center, SCREEN } from "../screen.ts";
import { formatTemp } from "../temp.ts";
import { animationFor } from "../wmo.ts";

const ANIMATION = { width: 16, height: 16 };

/** Space between the animation and the text beside it. */
const GAP = 3;

const WHITE = "#FFFFFFFF";
const DIM = "#AAAAAAFF";

const TEMP_DY = 1;
/** Lifts the descenders of "p" and "," back onto the screen. */
const SUB_DY = -2;

/** Where the text column starts: the animation's width and the gap after it. */
const TEXT_X = ANIMATION.width + GAP;

/** What the line under the temperature carries, as the settings ask for it. */
export type SubLine = {
  time: boolean;
  date: boolean;
};

/** The line under the temperature: "25 Aug, 15:34", or either half of it alone. */
function subLine(now: Date, show: SubLine): string {
  const date = show.date ? `${formatDay(now)} ${formatMonth(now)}` : "";
  const time = show.time ? formatHM(now) : "";

  if (date && time) return `${date}, ${time}`;
  return date || time;
}

/** The frame: the condition on the left, the reading and the clock beside it. */
export function weatherScreen(frame: Frame, weather: CurrentWeather, now: Date, show: SubLine): void {
  const temp = formatTemp(weather.temp);
  const sub = subLine(now, show);

  const tempBox = textBox(temp, "bold");

  // Two lines take the full height, one against each edge; the reading left alone centres itself against the animation instead.
  const tempY =
    sub === ""
      ? center(tempBox.height, SCREEN.height) + TEMP_DY - tempBox.top
      : TEMP_DY - tempBox.top;

  frame.animation("anim", animationFor(weather.code, weather.daylight), 0, 0);
  frame.text("text-temp", temp, "bold", WHITE, TEXT_X, tempY);

  if (sub !== "") {
    const box = textBox(sub, "small");
    frame.text("text-sub", sub, "small", DIM, TEXT_X, SCREEN.height - box.height + SUB_DY - box.top);
  }
}
