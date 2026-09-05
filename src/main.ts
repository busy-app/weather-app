import { device } from "@shared/device";
import { column, render, type Node } from "@shared/layout";
import manifest from "./appmeta/manifest.json";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** How often the screen is redrawn. */
const TICK_MS = 1000;

const WHITE = "#FFFFFFFF";
const SUBTLE_WHITE = "#FFFFFF80";

/**
 * The frame drawn on every tick. The screen is 72×16, so two short lines are about all that fits.
 */
function frame(ticks: number): Node {
  return column({ justify: "center", align: "center" }, [
    { type: "text", id: "title", text: "Hello", font: "bold", color: WHITE },
    {
      type: "text",
      id: "ticks",
      text: String(ticks),
      font: "small",
      color: SUBTLE_WHITE,
    },
  ]);
}

/** Sends one frame to the device. */
async function draw(ticks: number): Promise<void> {
  const elements = render(frame(ticks));
  await device.DisplayDraw({ application_name: APP, priority: 50, elements });
}

/**
 * Entry point. The build rewrites this default export into a call, so what matters is the shape: one function taking no arguments.
 */
export default function run(): void {
  let ticks = 0;

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);

  void draw(ticks).catch(report);

  // Tick errors are reported, not thrown: one failed request must not stop the loop.
  setInterval(() => {
    ticks += 1;
    void draw(ticks).catch(report);
  }, TICK_MS);
}
