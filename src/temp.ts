// Temperatures arrive from the backend in Celsius; Fahrenheit is derived here.

import type { Units } from "./settings.ts";

export type Suffix = "full" | "degree" | "none";

/** Set once at startup, before the first frame is drawn. */
let units: Units = "celsius";

const SUFFIX_INDEX: Record<Suffix, number> = { full: 0, degree: 1, none: 2 };

/** The same few readings come round again and again. */
const FORMATTED = new Map<number, string>();

export function setUnits(value: Units) {
  units = value;
}

export function toUnits(celsius: number) {
  return units === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius;
}

/** For rounding a reading to a whole displayed degree while keeping it in Celsius. */
export function fromUnits(value: number) {
  return units === "fahrenheit" ? ((value - 32) * 5) / 9 : value;
}

function suffixOf(suffix: Suffix) {
  if (suffix === "none") return "";
  if (suffix === "degree") return "°";

  return units === "fahrenheit" ? "°F" : "°C";
}

export function formatTemp(celsius: number, suffix: Suffix = "full") {
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
