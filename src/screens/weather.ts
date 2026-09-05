// The weather screen: what it is doing outside, right now.
//
//   ┌────────────────────────┐
//   │ ☀  +15°C               │
//   │    25 Aug, 15:34       │
//   └────────────────────────┘
//
// The animation holds the left edge; everything else is text stacked beside it.

import { formatDay, formatHM, formatMonth } from "@shared/datetime";
import { column, row, SCREEN, type Node } from "@shared/layout";
import type { CurrentWeather } from "../api.ts";
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

/** The line under the temperature: "25 Aug, 15:34". */
function subLine(now: Date): string {
  return `${formatDay(now)} ${formatMonth(now)}, ${formatHM(now)}`;
}

/** The frame: the condition on the left, the reading and the clock beside it. */
export function weatherScreen(weather: CurrentWeather, now: Date): Node {
  return row({ align: "center", gap: GAP, height: SCREEN.height }, [
    {
      type: "animation",
      id: "condition-anim",
      path: `animations/${animationFor(weather.code)}`,
      loop: true,
      await_previous_end: false,
      opacity: 100,
      ...ANIMATION,
    },
    // The two lines take the full height, one against each edge.
    column({ justify: "between", height: SCREEN.height }, [
      {
        type: "text",
        id: "temp",
        text: formatTemp(weather.temp),
        font: "bold",
        color: WHITE,
        dy: TEMP_DY,
      },
      {
        type: "text",
        id: "sub",
        text: subLine(now),
        font: "small",
        color: DIM,
        dy: SUB_DY,
      },
    ]),
  ]);
}
