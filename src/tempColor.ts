// The palette is in Celsius: a Fahrenheit reading is converted back before it is painted.
//
// A day is not painted by its readings alone. Its span is stretched over the palette so a flat
// day still shows a change of colour, and a hot or frosty day still shows its cool or warm end.

const COLDEST = -45;
const STEP = 5;

const PALETTE = [
  0x421b7f, 0x461d85, 0x4a1f8b, 0x522297, 0x5e28a8, 0x6233c8, 0x4a3fd6, 0x2f55e0, 0x3b82f6, 0x2bb8f0,
  0x3ed68c, 0xa9db48, 0xf2d83a, 0xfbb42e, 0xf9832a, 0xf2522c, 0xd62937, 0xcd2338, 0xc31e39,
];

const WARMEST = COLDEST + STEP * (PALETTE.length - 1);

const NARROW = 10;
const NARROW_SHIFT = 5;

const HEAT = 30;
const HEAT_FLOOR = 15;
const FROST = -20;
const FROST_CEILING = -5;

export function paletteColor(celsius: number) {
  const at = (Math.min(Math.max(celsius, COLDEST), WARMEST) - COLDEST) / STEP;
  const lower = Math.min(Math.floor(at), PALETTE.length - 2);

  return mix(PALETTE[lower]!, PALETTE[lower + 1]!, at - lower);
}

export function mix(from: number, to: number, part: number) {
  const r = (from >> 16) & 0xff;
  const g = (from >> 8) & 0xff;
  const b = from & 0xff;

  return (
    (Math.round(r + (((to >> 16) & 0xff) - r) * part) << 16) |
    (Math.round(g + (((to >> 8) & 0xff) - g) * part) << 8) |
    Math.round(b + ((to & 0xff) - b) * part)
  );
}

export interface ColorScale {
  readonly min: number;
  readonly span: number;
  readonly paintedMin: number;
  readonly paintedMax: number;
}

export function colorScale(min: number, max: number): ColorScale {
  const span = max - min;
  let paintedMin = span >= NARROW ? min : min - NARROW_SHIFT;
  let paintedMax = max;

  if (max >= HEAT && paintedMin > HEAT_FLOOR) paintedMin = HEAT_FLOOR;
  if (min <= FROST && paintedMax < FROST_CEILING) paintedMax = FROST_CEILING;

  // Held to the palette before the hours are spread between them, not after: a day past ±45
  // would otherwise lose its coldest or warmest hours to one flat colour.
  paintedMin = Math.min(Math.max(paintedMin, COLDEST), WARMEST);
  paintedMax = Math.min(Math.max(paintedMax, COLDEST), WARMEST);

  return { min, span, paintedMin, paintedMax };
}

export function paintedAs(celsius: number, scale: ColorScale) {
  // A flat day has nothing to spread, and would divide by zero.
  if (scale.span === 0) return celsius;

  return scale.paintedMin + ((celsius - scale.min) / scale.span) * (scale.paintedMax - scale.paintedMin);
}
