// Choosing the colours a bitmap is drawn with: the pixels are bucketed on a coarse brightness
// scale, and the buckets merged down a ladder of coarser scales until they fit a bitmap.

import { xpm2 } from "./xpm2.ts";

/** Colours a bitmap holds, the transparent pixel included. */
const MAX_COLORS = 32;

/** The scale the pixels are bucketed on first: this many steps per channel. */
const FINE_LEVELS = 16;

/** The scales tried in turn when the fine one leaves more buckets than there are colours. */
const COARSER_LEVELS = [12, 10, 8, 6, 5, 4, 3];

/** Buckets the first pass may make; any pixels past that join the last bucket. */
const MAX_FINE_BINS = 256;

const SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyz";
const EMPTY = ".";

/** The level each of the 256 channel values falls in, squared so the dark end keeps its steps. */
function levelTable(levels: number): Uint8Array {
  const table = new Uint8Array(256);

  for (let level = 0; level < levels; level++) {
    const from = Math.ceil(((level * level) / (levels * levels)) * 255);
    const to = level + 1 < levels ? Math.ceil((((level + 1) * (level + 1)) / (levels * levels)) * 255) : 256;
    table.fill(level, from, to);
  }

  return table;
}

const FINE = levelTable(FINE_LEVELS);

/** The coarse level each fine level falls in, so a coarser pass moves the same pixels. */
function coarseTable(levels: number): Uint8Array {
  const coarse = levelTable(levels);
  const map = new Uint8Array(FINE_LEVELS);
  const per = FINE_LEVELS * FINE_LEVELS;

  for (let level = 0; level < FINE_LEVELS; level++) {
    const from = Math.ceil(((level * level) / per) * 255);
    const to = level + 1 < FINE_LEVELS ? Math.ceil((((level + 1) * (level + 1)) / per) * 255) : 256;
    map[level] = coarse[(from + to - 1) >> 1]!;
  }

  return map;
}

const COARSE = COARSER_LEVELS.map(coarseTable);

// Scratch, kept between builds: one chart is quantised at a time, and on the device these buffers
// would otherwise be allocated and abandoned on every forecast. Buckets fit a 16-bit slot; the
// colour sums, which reach the hundreds of thousands, do not.
const binOfKey = new Int16Array(1 << 12);
const binOfColor = new Int16Array(MAX_FINE_BINS);
const fineKey = new Int16Array(MAX_FINE_BINS);
const fineR = new Int32Array(MAX_FINE_BINS);
const fineG = new Int32Array(MAX_FINE_BINS);
const fineB = new Int32Array(MAX_FINE_BINS);
const fineCount = new Int16Array(MAX_FINE_BINS);
const colorR = new Int32Array(MAX_COLORS);
const colorG = new Int32Array(MAX_COLORS);
const colorB = new Int32Array(MAX_COLORS);
const colorCount = new Int16Array(MAX_COLORS);
let binOfPixel = new Int16Array(0);

/** One bucket's key on a `levels`-step scale, from its key on the fine one. */
function coarser(key: number, map: Uint8Array, levels: number): number {
  const r = map[(key >> 8) & 0xf]!;
  const g = map[(key >> 4) & 0xf]!;
  const b = map[key & 0xf]!;
  return (r * levels + g) * levels + b;
}

/** "#RRGGBB" for a colour that has already been rounded to a byte. */
function hex(r: number, g: number, b: number): string {
  const pair = (channel: number) => channel.toString(16).padStart(2, "0").toUpperCase();
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

/** Buckets what the pixels came out as until they fit a bitmap, and writes the XPM2. */
export function quantize(pixels: Int32Array, width: number, height: number): string {
  const size = width * height;
  if (binOfPixel.length < size) binOfPixel = new Int16Array(size);
  binOfPixel.fill(-1, 0, size);

  // First pass: bucket every pixel on the fine scale, keeping the colours that fall in each bucket.
  binOfKey.fill(-1);
  let bins = 0;

  for (let i = 0; i < size; i++) {
    const color = pixels[i]!;
    if (color < 0) continue;

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const key = ((FINE[r]! << 4) | FINE[g]!) << 4 | FINE[b]!;

    let bin = binOfKey[key]!;
    if (bin < 0) {
      if (bins === MAX_FINE_BINS) {
        bin = bins - 1;
      } else {
        bin = bins++;
        binOfKey[key] = bin;
        fineKey[bin] = key;
        fineR[bin] = 0;
        fineG[bin] = 0;
        fineB[bin] = 0;
        fineCount[bin] = 0;
      }
    }

    fineR[bin] += r;
    fineG[bin] += g;
    fineB[bin] += b;
    fineCount[bin] += 1;
    binOfPixel[i] = bin;
  }

  // Merge them down the ladder of scales until they fit, stopping at the first that does.
  let colors = 0;
  let done = 0;

  for (let pass = 0; pass <= COARSER_LEVELS.length; pass++) {
    const levels = pass === 0 ? 0 : COARSER_LEVELS[pass - 1]!;
    const map = pass === 0 ? null : COARSE[pass - 1]!;

    binOfKey.fill(-1);
    colors = 0;
    done = 0;

    for (; done < bins; done++) {
      const key = map === null ? fineKey[done]! : coarser(fineKey[done]!, map, levels);

      let color = binOfKey[key]!;
      if (color < 0) {
        // The transparent pixel takes one of the bitmap's colours as well.
        if (colors === MAX_COLORS - 1) break;
        color = colors++;
        binOfKey[key] = color;
        colorR[color] = 0;
        colorG[color] = 0;
        colorB[color] = 0;
        colorCount[color] = 0;
      }

      binOfColor[done] = color;
      colorR[color] += fineR[done]!;
      colorG[color] += fineG[done]!;
      colorB[color] += fineB[done]!;
      colorCount[color] += fineCount[done]!;
    }

    if (done === bins) break;
  }

  // Whatever the last merge could not fit goes to the colour it looks most like.
  for (; done < bins; done++) {
    const r = fineR[done]! / fineCount[done]!;
    const g = fineG[done]! / fineCount[done]!;
    const b = fineB[done]! / fineCount[done]!;
    let best = 0;
    let bestDistance = Infinity;

    for (let color = 0; color < colors; color++) {
      const dr = colorR[color]! / colorCount[color]! - r;
      const dg = colorG[color]! / colorCount[color]! - g;
      const db = colorB[color]! / colorCount[color]! - b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color;
      }
    }

    binOfColor[done] = best;
  }

  const palette: [string, string][] = [[EMPTY, "None"]];
  for (let color = 0; color < colors; color++) {
    const count = colorCount[color]!;
    palette.push([
      SYMBOLS.charAt(color)!,
      hex((colorR[color]! / count) | 0, (colorG[color]! / count) | 0, (colorB[color]! / count) | 0),
    ]);
  }

  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      const bin = binOfPixel[y * width + x]!;
      row += bin < 0 ? EMPTY : SYMBOLS.charAt(binOfColor[bin]!)!;
    }
    rows.push(row);
  }

  return xpm2(palette, rows);
}
