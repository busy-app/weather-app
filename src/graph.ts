// The hourly forecast as an XPM2 bitmap: one hour per 3-pixel bar.
//
// The tops of the bars are one curve rather than a step per hour, and each column also lights the
// pixel the curve cuts through, held back to how much of it the curve covers.

import { tempChannels } from "./tempColor.ts";
import { quantize, zeros } from "./quantize.ts";

export const HOURS = 24;
export const BAR_W = 3;
export const GRAPH_W = HOURS * BAR_W;
export const GRAPH_H = 9;

/**
 * How far the pin rises above the topmost lit row of the bar it marks. `images/pin.png` is 3 wide
 * and 9 tall: a 3×3 head over a 1-pixel needle, and the head's middle row sits on the bar's top.
 *
 * Any higher and the tallest bar's pin comes within a pixel of the reading above the graph.
 */
const HEAD_RISE = 1;

/** A bar's height, in pixels, for the coldest and the warmest hour of the day. */
const MIN_H = 2;
const MAX_H = 7;

/** The outline is placed on eighths of a pixel, and its cut-through pixel held back to the
 * coverage the curve gives it. */
const OUTLINE_STEPS = 8;

/** The bottom row of the chart, which every bar reaches. */
const BOTTOM = GRAPH_H - 1;

/** How bright a bar is at the pixel the outline cuts through, and at the bottom of the chart. */
const TOP_LIGHT = 255;
const FOOT_LIGHT = 215;

// Scratch for one chart at a time, kept between builds rather than allocated on every forecast.
const solid = zeros(GRAPH_W);
const cut = zeros(GRAPH_W);
const pixels = zeros(GRAPH_W * GRAPH_H);

/** Where the pin's top-left corner sits for one hour. */
export interface Pin {
  readonly x: number;
  readonly y: number;
}

/**
 * The graph as it is drawn: one bitmap, and where the pin goes on each hour, built once per
 * forecast. The bitmap carries only the rows the chart uses, because the device composites a whole
 * rectangle every refresh it draws, ink or no ink.
 */
export interface Graph {
  /** The chart's pixels, one line per row, the first of them drawn on row `bitmapY` of the chart. */
  readonly bitmap: string;
  /** The chart row the first line of `bitmap` belongs on. */
  readonly bitmapY: number;
  /** The pin position for each hour, indexed as `temps` is. */
  readonly pins: readonly Pin[];
}

/** Builds everything the forecast screen draws from the temperatures alone. */
export function buildGraph(temps: number[]): Graph {
  const hours = temps.slice(0, HOURS);
  if (hours.length === 0) return { bitmap: "", bitmapY: 0, pins: [] };

  const { min, max } = span(hours);
  const width = max - min;
  const heights = hours.map((temp) => heightOf(temp, min, width));

  return draw(hours, outline(heights, OUTLINE_STEPS), OUTLINE_STEPS);
}

/** The day's coldest and warmest hour. */
function span(temps: number[]): { min: number; max: number } {
  let min = temps[0]!;
  let max = temps[0]!;
  for (const t of temps) {
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return { min, max };
}

/** A bar's height in pixels for one hour. */
function heightOf(temp: number, min: number, width: number): number {
  return width === 0 ? MAX_H : MIN_H + ((temp - min) / width) * (MAX_H - MIN_H);
}

/** The top of the chart, column by column, counted in `resolution`ths of a pixel. */
function outline(heights: number[], resolution: number): number[] {
  const tops = heights.map((height) => GRAPH_H - height);
  const columns = tops.length * BAR_W;
  const placed: number[] = [];

  for (let x = 0; x < columns; x++) {
    placed.push(Math.round(topAt(tops, (x + 0.5) / BAR_W - 0.5) * resolution));
  }

  return placed;
}

/** The graph as one plan draws it: rasterised into pixels, then handed to `quantize`. */
function draw(hours: number[], placed: number[], resolution: number): Graph {
  const columns = placed.length;
  const colors = hours.map((temp) => tempChannels(temp));
  let top = BOTTOM;

  // Each column's own two rows: where its bar starts, and the pixel above that which the outline
  // cuts through.
  for (let x = 0; x < columns; x++) {
    const at = placed[x]!;
    solid[x] = Math.ceil(at / resolution);
    cut[x] = Math.floor(at / resolution);
    if (cut[x]! < top) top = cut[x]!;
  }

  const rows = GRAPH_H - top;
  pixels.fill(-1, 0, rows * columns);

  for (let x = 0; x < columns; x++) {
    const color = colors[Math.floor(x / BAR_W)]!;
    const from = cut[x]!;

    // The pixel the outline cuts through: the hour's colour held back to the coverage it gets.
    const covers = 1 - (placed[x]! % resolution) / resolution;
    pixels[(from - top) * columns + x] = shade(color, (covers * TOP_LIGHT) / 255);

    // The bar below it, shaded from its top down to the foot of the chart.
    const drop = from < BOTTOM ? (TOP_LIGHT - FOOT_LIGHT) / (BOTTOM - from) : 0;
    for (let y = solid[x]!; y <= BOTTOM; y++) {
      pixels[(y - top) * columns + x] = shade(color, (TOP_LIGHT - (y - from) * drop) / 255);
    }
  }

  return {
    bitmap: quantize(pixels, columns, rows),
    bitmapY: top,
    pins: pinsFor(placed, resolution),
  };
}

/** One pixel's colour, held back to `lit` of its strength. */
function shade(color: readonly [number, number, number], lit: number): number {
  return (Math.round(color[0] * lit) << 16) | (Math.round(color[1] * lit) << 8) | Math.round(color[2] * lit);
}

/** The pin's corner for each hour: its head across the topmost lit row of the bar it marks. */
function pinsFor(placed: number[], resolution: number): Pin[] {
  const pins: Pin[] = [];

  for (let hour = 0; hour < placed.length / BAR_W; hour++) {
    // The pin is three wide, so its needle runs down the middle column of the bar.
    const top = Math.floor(placed[hour * BAR_W + 1]! / resolution);
    pins.push({ x: hour * BAR_W, y: top - HEAD_RISE });
  }

  return pins;
}

/**
 * The top of the chart at one column, interpolated between the hours around it.
 *
 * The curve passes exactly through each hour's own top — the middle column of its three — so the
 * pin still lands on the hour it marks.
 *
 * It never leaves the two hours it runs between: a cubic drawn through a step can climb above the
 * higher reading, and having climbed it must come back down, drawing a peak on a slope that only
 * ever fell. Held between the two, a monotone day stays monotone.
 */
function topAt(tops: number[], at: number): number {
  const last = tops.length - 1;
  if (last < 1) return tops[0]!;

  const from = Math.min(Math.max(Math.floor(at), 0), last - 1);
  const part = Math.min(Math.max(at - from, 0), 1);

  const before = tops[Math.max(from - 1, 0)]!;
  const here = tops[from]!;
  const next = tops[from + 1]!;
  const after = tops[Math.min(from + 2, last)]!;

  // Catmull-Rom: a cubic through `here` and `next`, bent by the hours either side of them.
  const part2 = part * part;
  const part3 = part2 * part;
  const value =
    0.5 *
    (2 * here +
      (next - before) * part +
      (2 * before - 5 * here + 4 * next - after) * part2 +
      (3 * here - before - 3 * next + after) * part3);

  return Math.min(Math.max(value, Math.min(here, next)), Math.max(here, next));
}
