// WMO weather codes → the assets that depict them. Several codes share one condition: the list is finer than what ships in animations/ and images/.

/** A weather condition, as far as this app draws it. */
export type Condition =
  | "clear"
  | "pcloudy"
  | "mcloudy"
  | "cloudy"
  | "foggy"
  | "lightrain"
  | "rain"
  | "oshower"
  | "ishower"
  | "snow";

/** WMO code → condition. Anything unlisted is drawn as cloudy. */
const CONDITIONS = new Map<number, Condition>([
  [0, "clear"],
  [1, "pcloudy"],
  [2, "mcloudy"],
  [3, "cloudy"],
  [45, "foggy"],
  [48, "foggy"],
  [51, "lightrain"],
  [53, "lightrain"],
  [56, "lightrain"],
  [61, "lightrain"],
  [66, "lightrain"],
  [55, "rain"],
  [57, "rain"],
  [63, "rain"],
  [65, "rain"],
  [67, "rain"],
  [82, "rain"],
  [71, "snow"],
  [73, "snow"],
  [75, "snow"],
  [77, "snow"],
  [85, "snow"],
  [86, "snow"],
  [80, "oshower"],
  [81, "ishower"],
  // Thunderstorms: no dedicated asset, drawn as rain.
  [95, "rain"],
  [96, "rain"],
  [99, "rain"],
]);

/** The condition a code stands for. */
export function conditionOf(wmo: number): Condition {
  return CONDITIONS.get(wmo) ?? "cloudy";
}

/** Every condition has an icon of its own. */
export function iconFor(wmo: number): string {
  return `ic_${conditionOf(wmo)}.png`;
}

/** Animations lack a snow loop, so snow plays the rain one. */
export function animationFor(wmo: number): string {
  const condition = conditionOf(wmo);
  return `w_${condition === "snow" ? "rain" : condition}.anim`;
}
