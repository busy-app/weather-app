// The hourly forecast as XPM2 bitmaps: one hour per 3-pixel bar.
//
// The device takes at most 32 colours in a bitmap, the transparent one included, and the chart
// holds several times that. Rather than merge its colours, the chart is cut into vertical strips
// that each fit.

import { colorScale, mix, paintedAs, paletteColor } from "./tempColor.ts";
import { xpm2 } from "./xpm2.ts";

export const HOURS = 24;
export const BAR_W = 3;
export const GRAPH_W = HOURS * BAR_W;
export const GRAPH_H = 8;

const MIN_H = 3;
const MAX_H = 8;

// XPM has no partial transparency, so the spec's 80% fill is baked into the colour over the black
// screen.
const FILL = 0.8;

// The spec's white at 50% in plus-lighter mode: added to the colour, not blended with it.
const GLOW = 0x808080;

const SOFTEN = 0.4;

// `images/pin.png` is 3 wide and 9 tall: a 3×3 head over a 1-pixel needle, and the head's middle
// row sits on the bar's top row.
const HEAD_RISE = 1;

const MAX_COLORS = 31;

const SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyz";
const EMPTY = ".";
const NONE = -1;

// Scratch for one chart at a time, kept between builds rather than allocated on every forecast.
const pixels = new Int32Array(GRAPH_W * GRAPH_H);
const fill = new Int32Array(GRAPH_W);
const tops = new Int32Array(HOURS);

export interface Pin {
  readonly x: number;
  readonly y: number;
}

export interface Strip {
  readonly x: number;
  readonly y: number;
  readonly data: string;
}

export interface Graph {
  readonly strips: readonly Strip[];
  readonly pins: readonly Pin[];
}

export const NO_GRAPH: Graph = { strips: [], pins: [] };

// A refresh that brings the same readings builds nothing.
let built: Graph = NO_GRAPH;
const builtFrom: number[] = [];

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

function sameAsBuilt(temps: readonly number[], count: number) {
  if (builtFrom.length !== count) return false;

  for (let hour = 0; hour < count; hour++) {
    if (builtFrom[hour] !== temps[hour]) return false;
  }

  return true;
}

function paint(colors: number[], count: number, columns: number) {
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

    const lowX = left > right ? hour * BAR_W + BAR_W - 1 : (hour + 1) * BAR_W;
    const highX = left > right ? lowX + 1 : lowX - 1;
    const lowTop = Math.max(left, right);
    const highTop = Math.min(left, right);

    // The spec's step smoothing, its first pixel: on the black above the low bar.
    pixels[(lowTop - 1) * GRAPH_W + lowX] = scaled(pixels[highTop * GRAPH_W + highX]!, SOFTEN);

    // The spec's "vertical fill" on peaks: a step of more than a pixel bares the high bar's side,
    // and it glows like a top row.
    for (let y = highTop + 1; y < lowTop; y++) {
      pixels[y * GRAPH_W + highX] = added(fill[highX]!, GLOW);
    }

    // The step smoothing's second pixel: on the high bar, level with the low bar's top.
    pixels[lowTop * GRAPH_W + highX] = added(fill[highX]!, scaled(pixels[lowTop * GRAPH_W + lowX]!, SOFTEN));
  }

  // Transparent rather than the spec's #000000: the screen is black anyway, and it saves a colour.
  pixels[(GRAPH_H - 1) * GRAPH_W] = NONE;
  pixels[(GRAPH_H - 1) * GRAPH_W + columns - 1] = NONE;
}

function cut(columns: number) {
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

function newColors(x: number, palette: number[]) {
  let count = 0;

  for (let y = 0; y < GRAPH_H; y++) {
    const color = pixels[y * GRAPH_W + x]!;
    if (color === NONE || palette.indexOf(color) !== -1) continue;

    let countedAbove = false;
    for (let above = 0; above < y; above++) {
      if (pixels[above * GRAPH_W + x] === color) {
        countedAbove = true;
        break;
      }
    }

    if (!countedAbove) count++;
  }

  return count;
}

// Cropped to its own tallest bar, so a low strip sends fewer rows.
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

function scaled(color: number, share: number) {
  return (
    (Math.round(((color >> 16) & 0xff) * share) << 16) |
    (Math.round(((color >> 8) & 0xff) * share) << 8) |
    Math.round((color & 0xff) * share)
  );
}

function added(a: number, b: number) {
  return (
    (Math.min(((a >> 16) & 0xff) + ((b >> 16) & 0xff), 255) << 16) |
    (Math.min(((a >> 8) & 0xff) + ((b >> 8) & 0xff), 255) << 8) |
    Math.min((a & 0xff) + (b & 0xff), 255)
  );
}

function hex(color: number) {
  return `#${(color | 0x1000000).toString(16).slice(1).toUpperCase()}`;
}
