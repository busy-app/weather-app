//   ┌────────────────────────┐
//   │ ◐ Loading weather      │
//   └────────────────────────┘
//
// The row is placed the way the firmware's own app loader places its spinner and "Loading..." (a centered LVGL flex row), so the spinner does not jump when the app takes the screen over from it.

import { SCREEN } from "@busy-app/busy-lib";
import type { Frame, Scroll } from "../frame.ts";

const SPINNER = { width: 8, height: 8 };

/** Line height of the small font (busy_regular_5): the height a firmware label takes. */
const TEXT_LINE_H = 9;

/** As in the firmware loader. */
const GAP = 2;

const WHITE = "#FFFFFFFF";

const TEXT_W = SCREEN.width - SPINNER.width - GAP;

const SCROLL: Scroll = { width: TEXT_W, rate: 600, startDelay: 400, repeatDelay: 800 };

/** LVGL flex centers an item in the track rounded up to an even height. */
const TRACK_H = (Math.max(SPINNER.height, TEXT_LINE_H) + 1) & ~1;
const SPINNER_DY = Math.floor((TRACK_H - SPINNER.height) / 2);
const TEXT_DY = Math.floor((TRACK_H - TEXT_LINE_H) / 2);

/** The row is as tall as its items reach, and LV_ALIGN_CENTER halves both heights before subtracting. */
const ROW_H = Math.max(SPINNER_DY + SPINNER.height, TEXT_DY + TEXT_LINE_H);
const ROW_Y = Math.floor(SCREEN.height / 2) - Math.floor(ROW_H / 2);

export function loadingScreen(frame: Frame, text: string) {
  frame.stockAnimation(
    "load-spinner",
    "shared/spinner_front_8x8.anim",
    0,
    ROW_Y + SPINNER_DY
  );
  frame.scrollingText(
    "load-text",
    text,
    "small",
    WHITE,
    SPINNER.width + GAP,
    ROW_Y + TEXT_DY,
    SCROLL
  );
}
