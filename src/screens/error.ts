//   ┌────────────────────────┐
//   │ ⊘ No internet,         │
//   │   cannot load app      │
//   └────────────────────────┘

import { capBox, SCREEN } from "@busy-app/busy-lib";
import type { Frame } from "../frame.ts";
import { center } from "../screen.ts";

export type ErrorText = readonly [string, string];

const ICON = { width: 8, height: 8 };

const GAP = 2;
const LINE_GAP = 2;

const WHITE = "#FFFFFFFF";

const TEXT_X = ICON.width + GAP;

/** The backend could not be reached at all. */
export const OFFLINE: ErrorText = ["No internet,", "cannot load app"];

/** The backend answered, but not with a forecast. */
export const FAILED: ErrorText = ["App failed to load,", "restart app"];

export function errorScreen(frame: Frame, text: ErrorText) {
  // Both lines are placed by the cap height, so a line without capitals sits where one with them would.
  const cap = capBox("small");
  const top = center(cap.height * 2 + LINE_GAP, SCREEN.height);

  frame.image("error-icon", "images/error.png", 0, center(ICON.height, SCREEN.height));
  frame.text("error-line-1", text[0], "small", WHITE, TEXT_X, top - cap.top);
  frame.text("error-line-2", text[1], "small", WHITE, TEXT_X, top + cap.height + LINE_GAP - cap.top);
}
