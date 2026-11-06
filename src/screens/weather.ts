//   ┌────────────────────────┐
//   │ ☀  +15°C               │
//   │    25 Aug, 15:34       │
//   └────────────────────────┘

import { capBox, formatDayOfMonth, formatMonth, formatTime, SCREEN, textLayoutBox, textWidth } from "@busy-app/busy-lib";
import type { CurrentWeather } from "../api.ts";
import type { Frame } from "../frame.ts";
import { center } from "../screen.ts";
import { formatTemp } from "../temp.ts";
import { animationFor } from "../wmo.ts";

export type SubLine = {
  time: boolean;
  date: boolean;
};

const ANIMATION = { width: 16, height: 16 };

const GAP = 3;

const WHITE = "#FFFFFFFF";
const DIM = "#808080FF";

const TEMP_DY = 1;

const TOP = 1;
const LINE_GAP = 2;
const DATE_GAP = 2;

/** Every glyph's advance ends in one clear column, the comma's included. */
const TRACKING = 1;

const TEXT_X = ANIMATION.width + GAP;

function dateText(now: Date, withTime: boolean) {
  return `${formatDayOfMonth(now)} ${formatMonth(now)}${withTime ? "," : ""}`;
}

/**
 * The date and the time are two elements, not one string: a space would leave three clear
 * columns after the comma, not two, and the tick on the minute then re-sends the time alone.
 */
export function weatherScreen(frame: Frame, weather: CurrentWeather, now: Date, show: SubLine) {
  const temp = formatTemp(weather.temp);
  const date = show.date ? dateText(now, show.time) : "";
  const time = show.time ? formatTime(now).time : "";

  const tempBox = textLayoutBox(temp, "bold");

  frame.animation("anim", animationFor(weather.code, weather.daylight), 0, 0);

  if (date === "" && time === "") {
    frame.text("text-temp", temp, "bold", WHITE, TEXT_X, center(tempBox.height, SCREEN.height) + TEMP_DY - tempBox.top);
    return;
  }

  // The clock is digits and a colon, which sit at cap height. Measuring it would add a new string
  // to busy-lib's measuring cache every minute, so a line without the date takes the cap box.
  const subBox = date !== "" ? textLayoutBox(date, "small") : capBox("small");
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
