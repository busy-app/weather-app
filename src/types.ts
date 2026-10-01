import type { render } from "@shared/layout/index.ts";

/** A drawn element, as `render` and `list` return them. `Element` alone is the DOM one. */
export type Drawn = ReturnType<typeof render>[number];
