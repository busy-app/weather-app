// Temperatures arrive from the backend in Celsius; Fahrenheit is derived here.

import type { Units } from "./settings.ts";

/** The scale every reading is shown in. Set once at startup, before the first frame is drawn. */
let units: Units = "celsius";

export function setUnits(value: Units): void {
  units = value;
}

export function toUnits(celsius: number): number {
  return units === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius;
}

/** The inverse of toUnits(), for rounding a reading to a whole displayed degree while keeping it in Celsius. */
export function fromUnits(value: number): number {
  return units === "fahrenheit" ? ((value - 32) * 5) / 9 : value;
}

/** How much of the unit follows the reading: "°C"/"°F", a bare "°", or nothing. */
export type Suffix = "full" | "degree" | "none";

function suffixOf(suffix: Suffix): string {
  if (suffix === "none") return "";
  if (suffix === "degree") return "°";
  return units === "fahrenheit" ? "°F" : "°C";
}

const SUFFIX_INDEX: Record<Suffix, number> = { full: 0, degree: 1, none: 2 };

/** Formatted readings, by rounded value and suffix. The same few come round again and again. */
const FORMATTED = new Map<number, string>();

/** Temperature as it is shown: converted, rounded, always signed — "+23°C", "-7°", "0". */
export function formatTemp(celsius: number, suffix: Suffix = "full"): string {
  const rounded = Math.round(toUnits(celsius));
  const key = rounded * 3 + SUFFIX_INDEX[suffix];

  let text = FORMATTED.get(key);
  if (text === undefined) {
    const sign = rounded > 0 ? "+" : "";
    text = `${sign}${rounded}${suffixOf(suffix)}`;
    FORMATTED.set(key, text);
  }
  return text;
}
