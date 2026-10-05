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
import { textBox, textWidth } from "../font.ts";
import { center, SCREEN } from "../screen.ts";
import { formatTemp } from "../temp.ts";
import { animationFor } from "../wmo.ts";

const ANIMATION = { width: 16, height: 16 };

/** Space between the animation and the text beside it. */
const GAP = 3;

const WHITE = "#FFFFFFFF";
const DIM = "#AAAAAAFF";

const TEMP_DY = 1;

/** Clear rows above the reading when a line sits under it. */
const TOP = 1;

/** Clear rows between the reading and the line under it. */
const LINE_GAP = 2;

/** Clear columns between the date and the time after it. */
const DATE_GAP = 2;

/** Every glyph's advance ends in one clear column, the comma's included. */
const TRACKING = 1;

/** Where the text column starts: the animation's width and the gap after it. */
const TEXT_X = ANIMATION.width + GAP;

/** What the line under the temperature carries, as the settings ask for it. */
export type SubLine = {
  time: boolean;
  date: boolean;
};

/** The date as it opens the line: "25 Aug,", the comma there only when the time follows. */
function dateText(now: Date, withTime: boolean): string {
  return `${formatDay(now)} ${formatMonth(now)}${withTime ? "," : ""}`;
}

/**
 * The frame: the condition on the left, the reading and the clock beside it.
 *
 * The date and the time are two elements, not one string: a space would leave three clear
 * columns after the comma, not two, and the tick on the minute then re-sends the time alone.
 */
export function weatherScreen(frame: Frame, weather: CurrentWeather, now: Date, show: SubLine): void {
  const temp = formatTemp(weather.temp);
  const date = show.date ? dateText(now, show.time) : "";
  const time = show.time ? formatHM(now) : "";

  const tempBox = textBox(temp, "bold");

  frame.animation("anim", animationFor(weather.code, weather.daylight), 0, 0);

  if (date === "" && time === "") {
    frame.text("text-temp", temp, "bold", WHITE, TEXT_X, center(tempBox.height, SCREEN.height) + TEMP_DY - tempBox.top);
    return;
  }

  const subBox = textBox(date || time, "small");
  const subY = TOP + tempBox.height + LINE_GAP - subBox.top;

  frame.text("text-temp", temp, "bold", WHITE, TEXT_X, TOP - tempBox.top);

  if (date !== "") {
    frame.text("text-sub", date, "small", DIM, TEXT_X, subY);
  }

  if (time !== "") {
    const x = date === "" ? TEXT_X : TEXT_X + textWidth(date, "small") - TRACKING + DATE_GAP;
    frame.text("text-time", time, "small", DIM, x, subY);
  }
}
