// The error screen: why the app has nothing to show.
//
//   ┌────────────────────────┐
//   │ ⊘ No internet,         │
//   │   cannot load app      │
//   └────────────────────────┘

import type { Frame } from "../frame.ts";
import { capBox } from "../font.ts";
import { center, SCREEN } from "../screen.ts";

const ICON = { width: 8, height: 8 };

/** Space between the icon and the text beside it. */
const GAP = 2;

/** Clear rows between the two lines. */
const LINE_GAP = 2;

const WHITE = "#FFFFFFFF";

const TEXT_X = ICON.width + GAP;

/** The two lines the screen says. */
export type ErrorText = readonly [string, string];

/** The backend could not be reached at all. */
export const OFFLINE: ErrorText = ["No internet,", "cannot load app"];

/** The backend answered, but not with a forecast. */
export const FAILED: ErrorText = ["App failed to load,", "restart app"];

export function errorScreen(frame: Frame, text: ErrorText): void {
  // Both lines are placed by the cap height, so a line without capitals sits where one with them would.
  const cap = capBox("small");
  const top = center(cap.height * 2 + LINE_GAP, SCREEN.height);

  frame.image("error-icon", "images/error.png", 0, center(ICON.height, SCREEN.height));
  frame.text("error-line-1", text[0], "small", WHITE, TEXT_X, top - cap.top);
  frame.text("error-line-2", text[1], "small", WHITE, TEXT_X, top + cap.height + LINE_GAP - cap.top);
}
