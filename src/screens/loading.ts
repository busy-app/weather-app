// The startup screen: a spinner and what the app is waiting for.
//
//   ┌────────────────────────┐
//   │ ◐  Loading weather     │
//   └────────────────────────┘
//
// The spinner is a stock animation, played from the device's own assets rather than the app's.

import type { Frame, Scroll } from "../frame.ts";
import { textBox } from "../font.ts";
import { center, SCREEN } from "../screen.ts";

const SPINNER = { width: 8, height: 8 };

/** Space between the spinner and the text beside it. */
const GAP = 3;

const WHITE = "#FFFFFFFF";

/** What is left for the text once the spinner has taken its side. */
const TEXT_W = SCREEN.width - SPINNER.width - GAP;

/** Anything wider than TEXT_W scrolls; these set how. */
const SCROLL: Scroll = { width: TEXT_W, rate: 600, startDelay: 400, repeatDelay: 800 };

export function loadingScreen(frame: Frame, text: string): void {
  const box = textBox(text, "small");

  frame.stockAnimation("load-spinner", "shared/spinner_front_8x8.anim", 0, center(SPINNER.height, SCREEN.height));
  frame.scrollingText(
    "load-text",
    text,
    "small",
    WHITE,
    SPINNER.width + GAP,
    center(box.height, SCREEN.height) - box.top,
    SCROLL,
  );
}
