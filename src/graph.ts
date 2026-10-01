// The hourly forecast as an XPM2 bitmap: one hour per 3-pixel bar.

import { tempColor } from "./tempColor.ts";
import { xpm2 } from "./xpm2.ts";

export const HOURS = 24;
export const BAR_W = 3;
export const GRAPH_W = HOURS * BAR_W;
export const GRAPH_H = 9;

/**
 * The pin's head, in pixels. `images/pin.png` is 3 wide and 9 tall: a 3×3 head over a
 * 1-pixel needle. Only the head decides where the pin is placed.
 */
const HEAD_H = 3;

const EMPTY = ".";
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

const MIN_H = 2;
const MAX_H = 7;

/** Bar heights in pixels, scaled between the day's coldest and warmest hours. */
function heights(temps: number[]): number[] {
  let min = temps[0]!;
  let max = temps[0]!;
  for (const t of temps) {
    if (t < min) min = t;
    if (t > max) max = t;
  }

  const span = max - min;
  return temps.map((t) => {
    if (span === 0) return MAX_H;
    const norm = (t - min) / span;
    return MIN_H + Math.round(norm * (MAX_H - MIN_H));
  });
}

/** Where the pin's top-left corner sits for one hour. */
export interface Pin {
  readonly x: number;
  readonly y: number;
}

/**
 * The graph as it is drawn: the bars as one bitmap, and where the pin goes on each hour.
 *
 * Neither depends on the hour the pin is on, so both are built once per forecast.
 */
export interface Graph {
  /** The bars as an XPM2 bitmap. */
  readonly bitmap: string;
  /** The pin position for each hour, indexed as `temps` is. */
  readonly pins: readonly Pin[];
}

/** Builds everything the forecast screen draws from the temperatures alone. */
export function buildGraph(temps: number[]): Graph {
  const hours = temps.slice(0, HOURS);
  const bars = heights(hours);

  // The head sits above the bar, its bottom edge on the bar's top row; the needle hangs down
  // over the bar from there, and off the bottom of the screen when the bar is short.
  const pins = bars.map((bar, hour) => ({
    x: hour * BAR_W,
    y: GRAPH_H - bar - HEAD_H + 1,
  }));

  return { bitmap: renderBars(hours, bars), pins };
}

/** The bars alone; the pin is a separate image drawn over them. */
function renderBars(hours: number[], bars: number[]): string {
  // One symbol per distinct color; the palette holds at most 32.
  const colors: string[] = [];
  const byColor = new Map<string, string>();

  const columns = hours.map((temp, hour) => {
    const color = tempColor(temp);
    let symbol = byColor.get(color);
    if (symbol === undefined) {
      symbol = ALPHABET.charAt(colors.length);
      byColor.set(color, symbol);
      colors.push(color);
    }
    return { symbol, height: bars[hour]! };
  });

  const palette: [string, string][] = [[EMPTY, "None"]];
  for (let i = 0; i < colors.length; i++) palette.push([ALPHABET.charAt(i)!, colors[i]!]);

  const grid: string[] = [];
  for (let y = 0; y < GRAPH_H; y++) {
    // Bars grow from the bottom.
    const depth = GRAPH_H - y;
    let row = "";
    for (const column of columns) {
      const symbol = column.height >= depth ? column.symbol : EMPTY;
      for (let i = 0; i < BAR_W; i++) row += symbol;
    }
    grid.push(row);
  }

  return xpm2(palette, grid);
}
