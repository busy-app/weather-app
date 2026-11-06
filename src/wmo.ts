// Several WMO codes share one condition: the list is finer than what ships in animations/ and images/.

export type Condition =
  | "clear"
  | "mclear"
  | "pcloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy_rain"
  | "sun_showers"
  | "flurries"
  | "snow"
  | "heavy_snow"
  | "blizzard"
  | "thunderstorms"
  | "windy";

/** Their assets carry a `_day`/`_night` suffix. */
const DIURNAL = new Set<Condition>(["clear", "mclear", "pcloudy"]);

/**
 * Night assets for conditions that have none of their own: an overcast night still shows the moon,
 * behind the cloud of the partly cloudy one. The rest — rain, snow, fog — look the same either way.
 */
const NIGHT_STAND_INS = new Map<Condition, string>([["cloudy", "pcloudy_night"]]);

const CONDITIONS = new Map<number, Condition>([
  [0, "clear"],
  [1, "mclear"],
  [2, "pcloudy"],
  [3, "cloudy"],
  [45, "fog"],
  [48, "fog"],
  // Drizzle, freezing drizzle.
  [51, "drizzle"],
  [53, "drizzle"],
  [55, "drizzle"],
  [56, "drizzle"],
  [57, "drizzle"],
  // Rain, freezing rain.
  [61, "rain"],
  [63, "rain"],
  [65, "heavy_rain"],
  [66, "rain"],
  [67, "heavy_rain"],
  // Snowfall, snow grains.
  [71, "flurries"],
  [73, "snow"],
  [75, "heavy_snow"],
  [77, "flurries"],
  // Rain showers.
  [80, "sun_showers"],
  [81, "rain"],
  [82, "heavy_rain"],
  // Snow showers.
  [85, "snow"],
  [86, "blizzard"],
  // Thunderstorms, with and without hail.
  [95, "thunderstorms"],
  [96, "thunderstorms"],
  [99, "thunderstorms"],
]);

/**
 * The names are built once per code and kept: a frame asks for the same few again and again,
 * and a stable string also makes the "did this change?" test an identity check.
 */
const ASSETS = new Map<number, string>();
const ICONS = new Map<number, string>();
const ANIMATIONS = new Map<number, string>();

export function conditionOf(wmo: number) {
  return CONDITIONS.get(wmo) ?? "cloudy";
}

function assetFor(wmo: number, daylight: boolean) {
  const key = wmo * 2 + (daylight ? 1 : 0);

  let name = ASSETS.get(key);
  if (name === undefined) {
    const condition = conditionOf(wmo);
    const stand = daylight ? undefined : NIGHT_STAND_INS.get(condition);
    name = stand ?? (DIURNAL.has(condition) ? `${condition}_${daylight ? "day" : "night"}` : condition);
    ASSETS.set(key, name);
  }

  return name;
}

export function iconFor(wmo: number, daylight: boolean) {
  const key = wmo * 2 + (daylight ? 1 : 0);

  let path = ICONS.get(key);
  if (path === undefined) {
    path = `images/${assetFor(wmo, daylight)}.png`;
    ICONS.set(key, path);
  }

  return path;
}

export function animationFor(wmo: number, daylight: boolean) {
  const key = wmo * 2 + (daylight ? 1 : 0);

  let path = ANIMATIONS.get(key);
  if (path === undefined) {
    path = `animations/${assetFor(wmo, daylight)}.anim`;
    ANIMATIONS.set(key, path);
  }

  return path;
}
