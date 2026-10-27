// Temperature → colour for the forecast graph: 19 anchors every 5 °C from −45 to +45, mixed
// linearly between them. Celsius only: a Fahrenheit reading is converted back before it is painted.
//
// A day is not painted by its readings alone. The day's span is stretched over the palette so a
// flat day still shows a change of colour, and a day that is hot or frosty all through still
// shows its coldest or warmest hour apart from the rest.

/** The coldest anchor; below it everything takes its colour. */
const COLDEST = -45;

/** Degrees between two anchors. */
const STEP = 5;

/** Anchors, coldest first, as 0xRRGGBB. */
const PALETTE = [
  0x421b7f, 0x461d85, 0x4a1f8b, 0x522297, 0x5e28a8, 0x6233c8, 0x4a3fd6, 0x2f55e0, 0x3b82f6, 0x2bb8f0,
  0x3ed68c, 0xa9db48, 0xf2d83a, 0xfbb42e, 0xf9832a, 0xf2522c, 0xd62937, 0xcd2338, 0xc31e39,
];

/** The warmest anchor, +45 °C; above it everything takes its colour. */
const WARMEST = COLDEST + STEP * (PALETTE.length - 1);

/** A day that spans less than this has its coldest hour painted colder, by `NARROW_SHIFT`. */
const NARROW = 10;
const NARROW_SHIFT = 5;

/** A day whose warmest hour reaches this is hot: its coldest hour is painted no warmer than `HEAT_FLOOR`, so the day keeps its cool end. */
const HEAT = 30;
const HEAT_FLOOR = 15;

/** A day whose coldest hour falls to this is frosty: its warmest hour is painted no colder than `FROST_CEILING`, so the day keeps its warm end. */
const FROST = -30;
const FROST_CEILING = -5;

/** The colour of `celsius` on the palette, as 0xRRGGBB. */
export function paletteColor(celsius: number): number {
  const at = (Math.min(Math.max(celsius, COLDEST), WARMEST) - COLDEST) / STEP;
  const lower = Math.min(Math.floor(at), PALETTE.length - 2);
  return mix(PALETTE[lower]!, PALETTE[lower + 1]!, at - lower);
}

/** `from` moved `part` of the way to `to`, channel by channel, as 0xRRGGBB. */
export function mix(from: number, to: number, part: number): number {
  const r = (from >> 16) & 0xff;
  const g = (from >> 8) & 0xff;
  const b = from & 0xff;

  return (
    (Math.round(r + (((to >> 16) & 0xff) - r) * part) << 16) |
    (Math.round(g + (((to >> 8) & 0xff) - g) * part) << 8) |
    Math.round(b + ((to & 0xff) - b) * part)
  );
}

/** How one day's readings are spread over the palette. */
export interface ColorScale {
  /** The day's coldest reading, and how far its warmest is above it. */
  readonly min: number;
  readonly span: number;
  /** What the coldest and the warmest reading are painted as. */
  readonly from: number;
  readonly to: number;
}

/** The scale for a day whose readings run from `min` to `max`, °C. */
export function colorScale(min: number, max: number): ColorScale {
  const span = max - min;
  let from = span >= NARROW ? min : min - NARROW_SHIFT;
  let to = max;

  if (max >= HEAT && from > HEAT_FLOOR) from = HEAT_FLOOR;
  if (min <= FROST && to < FROST_CEILING) to = FROST_CEILING;

  // The palette ends at ±45: both ends are held to it before the hours between are spread out.
  from = Math.min(Math.max(from, COLDEST), WARMEST);
  to = Math.min(Math.max(to, COLDEST), WARMEST);

  return { min, span, from, to };
}

/** The temperature `celsius` is painted as on a day with this scale. */
export function paintedAs(celsius: number, scale: ColorScale): number {
  // Every hour alike: nothing to spread, so the reading is painted as itself.
  if (scale.span === 0) return celsius;
  return scale.from + ((celsius - scale.min) / scale.span) * (scale.to - scale.from);
}
