// The hourly forecast as XPM2 bitmaps: one hour per 3-pixel bar.
//
// A bar is a whole number of pixels tall, MAX_H for the warmest hour of the day and MIN_H for the
// coldest. Its colour comes from the day's palette and runs smoothly from one hour to the next,
// left to right. The top row of every bar is lit up, and so is the side a step of more than a
// pixel bares. Every step between two bars is softened by two pixels: one on the black beside the
// higher bar, one on the higher bar itself. The chart's two bottom corners are left dark.
//
// The device takes at most 32 colours in a bitmap, the transparent one included, and the chart
// holds several times that. Rather than merge its colours, the chart is cut into vertical strips
// that each fit, every one of them as short as its own tallest bar.

import { colorScale, mix, paintedAs, paletteColor } from "./tempColor.ts";
import { xpm2 } from "./xpm2.ts";

export const HOURS = 24;
export const BAR_W = 3;
export const GRAPH_W = HOURS * BAR_W;
export const GRAPH_H = 8;

/** A bar's height, in pixels, for the coldest and the warmest hour of the day. */
const MIN_H = 3;
const MAX_H = 8;

/** The bars are drawn at this share of their colour, over the black screen. */
const FILL = 0.8;

/** Added to the top row of every bar: white at half strength, added on rather than mixed in. */
const GLOW = 0x808080;

/** The two pixels that soften a step take this share of the colour of the top next to them. */
const SOFTEN = 0.4;

/**
 * How far the pin rises above the top row of the bar it marks. `images/pin.png` is 3 wide and 9
 * tall: a 3×3 head over a 1-pixel needle, and the head's middle row sits on the bar's top row.
 */
const HEAD_RISE = 1;

/** Colours one bitmap may use besides the transparent one. */
const MAX_COLORS = 31;

const SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyz";
const EMPTY = ".";
const NONE = -1;

// Scratch for one chart at a time, kept between builds rather than allocated on every forecast.
const pixels = new Int32Array(GRAPH_W * GRAPH_H);
const fill = new Int32Array(GRAPH_W);
const tops = new Int32Array(HOURS);

/** Where the pin's top-left corner sits for one hour, in chart pixels. */
export interface Pin {
  readonly x: number;
  readonly y: number;
}

/** One bitmap of the chart: the columns from `x` on, the rows from `y` down to the bottom. */
export interface Strip {
  readonly x: number;
  readonly y: number;
  readonly data: string;
}

/** The graph as it is drawn, built once per forecast. */
export interface Graph {
  /** The chart's bitmaps, left to right. */
  readonly strips: readonly Strip[];
  /** The pin position for each hour, indexed as the temperatures are. */
  readonly pins: readonly Pin[];
}

export const NO_GRAPH: Graph = { strips: [], pins: [] };

/** The last chart built, and the readings it was built from: a refresh that brings the same ones builds nothing. */
let built: Graph = NO_GRAPH;
const builtFrom: number[] = [];

/** Builds everything the forecast screen draws from the temperatures alone, °C. */
export function buildGraph(temps: readonly number[]): Graph {
  const count = Math.min(temps.length, HOURS);
  if (count === 0) return NO_GRAPH;
  if (sameAsBuilt(temps, count)) return built;

  let min = temps[0]!;
  let max = temps[0]!;
  for (let hour = 1; hour < count; hour++) {
    const temp = temps[hour]!;
    if (temp < min) min = temp;
    if (temp > max) max = temp;
  }

  const span = max - min;
  const scale = colorScale(min, max);
  const colors: number[] = [];

  for (let hour = 0; hour < count; hour++) {
    const temp = temps[hour]!;
    colors.push(paletteColor(paintedAs(temp, scale)));
    tops[hour] = GRAPH_H - (span === 0 ? MAX_H : Math.round(MIN_H + ((temp - min) / span) * (MAX_H - MIN_H)));
  }

  const columns = count * BAR_W;
  paint(colors, count, columns);

  const pins: Pin[] = [];
  for (let hour = 0; hour < count; hour++) {
    pins.push({ x: hour * BAR_W, y: tops[hour]! - HEAD_RISE });
  }

  built = { strips: cut(columns), pins };
  builtFrom.length = 0;
  for (let hour = 0; hour < count; hour++) builtFrom.push(temps[hour]!);

  return built;
}

function sameAsBuilt(temps: readonly number[], count: number): boolean {
  if (builtFrom.length !== count) return false;
  for (let hour = 0; hour < count; hour++) {
    if (builtFrom[hour] !== temps[hour]) return false;
  }
  return true;
}

/** Rasterises the bars, their lit tops and the softened steps into `pixels`. */
function paint(colors: number[], count: number, columns: number): void {
  pixels.fill(NONE);

  for (let x = 0; x < columns; x++) {
    // Each hour's own colour sits on the middle column of its bar; the columns between mix the two.
    const at = (x - 1) / BAR_W;
    const hour = Math.floor(x / BAR_W);
    const from = Math.min(Math.max(Math.floor(at), 0), Math.max(count - 2, 0));
    const part = Math.min(Math.max(at - from, 0), 1);
    const color = count < 2 ? colors[0]! : mix(colors[from]!, colors[from + 1]!, part);

    fill[x] = scaled(color, FILL);

    const top = tops[hour]!;
    pixels[top * GRAPH_W + x] = added(fill[x]!, GLOW);
    for (let y = top + 1; y < GRAPH_H; y++) {
      pixels[y * GRAPH_W + x] = fill[x]!;
    }
  }

  for (let hour = 0; hour + 1 < count; hour++) {
    const left = tops[hour]!;
    const right = tops[hour + 1]!;
    if (left === right) continue;

    // The columns either side of the step, the low bar's and the high bar's.
    const lowX = left > right ? hour * BAR_W + BAR_W - 1 : (hour + 1) * BAR_W;
    const highX = left > right ? lowX + 1 : lowX - 1;
    const lowTop = Math.max(left, right);
    const highTop = Math.min(left, right);

    // On the black above the low bar, against the high one: a share of the high bar's top.
    pixels[(lowTop - 1) * GRAPH_W + lowX] = scaled(pixels[highTop * GRAPH_W + highX]!, SOFTEN);

    // A step of more than a pixel bares the high bar's side: it is lit like the top, down to the
    // pixel level with the low bar's top.
    for (let y = highTop + 1; y < lowTop; y++) {
      pixels[y * GRAPH_W + highX] = added(fill[highX]!, GLOW);
    }

    // On the high bar, level with the low bar's top: a share of that top, added on.
    pixels[lowTop * GRAPH_W + highX] = added(fill[highX]!, scaled(pixels[lowTop * GRAPH_W + lowX]!, SOFTEN));
  }

  // The chart's bottom corners are left dark.
  pixels[(GRAPH_H - 1) * GRAPH_W] = NONE;
  pixels[(GRAPH_H - 1) * GRAPH_W + columns - 1] = NONE;
}

/**
 * Cuts the chart into as few strips as hold no more than `MAX_COLORS` each, left to right.
 *
 * A strip takes columns until the next would bring too many new colours; whatever it holds, it
 * holds exactly, with no colour merged into another.
 */
function cut(columns: number): Strip[] {
  const strips: Strip[] = [];
  const palette: number[] = [];
  let start = 0;

  for (let x = 0; x < columns; x++) {
    if (palette.length + newColors(x, palette) > MAX_COLORS) {
      strips.push(strip(start, x, palette));
      palette.length = 0;
      start = x;
    }

    for (let y = 0; y < GRAPH_H; y++) {
      const color = pixels[y * GRAPH_W + x]!;
      if (color !== NONE && palette.indexOf(color) === -1) palette.push(color);
    }
  }

  strips.push(strip(start, columns, palette));
  return strips;
}

/** How many colours column `x` has that `palette` does not. */
function newColors(x: number, palette: number[]): number {
  let count = 0;

  for (let y = 0; y < GRAPH_H; y++) {
    const color = pixels[y * GRAPH_W + x]!;
    if (color === NONE || palette.indexOf(color) !== -1) continue;

    // Counted once, however many rows of the column have it.
    let seen = false;
    for (let above = 0; above < y; above++) {
      if (pixels[above * GRAPH_W + x] === color) {
        seen = true;
        break;
      }
    }
    if (!seen) count++;
  }

  return count;
}

/** The XPM2 strip of columns `from` up to `to`, cut down to the rows it uses. */
function strip(from: number, to: number, palette: number[]): Strip {
  let top = GRAPH_H - 1;
  for (let x = from; x < to; x++) {
    for (let y = 0; y < top; y++) {
      if (pixels[y * GRAPH_W + x] !== NONE) {
        top = y;
        break;
      }
    }
  }

  const colors: [string, string][] = [[EMPTY, "None"]];
  for (let i = 0; i < palette.length; i++) colors.push([SYMBOLS.charAt(i), hex(palette[i]!)]);

  const rows: string[] = [];
  for (let y = top; y < GRAPH_H; y++) {
    let row = "";
    for (let x = from; x < to; x++) {
      const color = pixels[y * GRAPH_W + x]!;
      row += color === NONE ? EMPTY : SYMBOLS.charAt(palette.indexOf(color));
    }
    rows.push(row);
  }

  return { x: from, y: top, data: xpm2(colors, rows) };
}

/** `color` at `share` of its strength. */
function scaled(color: number, share: number): number {
  return (
    (Math.round(((color >> 16) & 0xff) * share) << 16) |
    (Math.round(((color >> 8) & 0xff) * share) << 8) |
    Math.round((color & 0xff) * share)
  );
}

/** Two colours added channel by channel, each held at full strength. */
function added(a: number, b: number): number {
  return (
    (Math.min(((a >> 16) & 0xff) + ((b >> 16) & 0xff), 255) << 16) |
    (Math.min(((a >> 8) & 0xff) + ((b >> 8) & 0xff), 255) << 8) |
    Math.min((a & 0xff) + (b & 0xff), 255)
  );
}

/** "#RRGGBB". */
function hex(color: number): string {
  return `#${(color | 0x1000000).toString(16).slice(1).toUpperCase()}`;
}
