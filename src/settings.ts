import { appsSettingsGet } from "@busy-app/busy-lib";
import { client } from "@shared/device";
import { errorText } from "@shared/errors";
import manifest from "./appmeta/manifest.json";

export type Units = "celsius" | "fahrenheit";

/** In auto mode the backend resolves the place itself. */
export type Location = { mode: "auto" } | { mode: "fixed"; lat: number; lon: number };

/** The geolocation field as the firmware stores it. */
type GeoValue = {
  mode: "auto" | "fixed";
  name: string;
  lat?: number;
  lon?: number;
};

export type Settings = {
  location: Location;
  units: Units;
  showTime: boolean;
  showDate: boolean;
};

/** Must match "version" in appmeta/settings.json. */
const VERSION = 1;

/** Must mirror the "default" of every field in appmeta/settings.json. */
export const DEFAULTS: Settings = {
  location: { mode: "auto" },
  units: "celsius",
  showTime: true,
  showDate: true,
};

function readBoolean(values: Record<string, unknown>, key: string, fallback: boolean) {
  const value = values[key];
  return typeof value === "boolean" ? value : fallback;
}

function readUnits(values: Record<string, unknown>): Units {
  return values["units"] === "fahrenheit" ? "fahrenheit" : "celsius";
}

function readLocation(values: Record<string, unknown>): Location {
  const geo = values["location"] as GeoValue | undefined;
  if (!geo || geo.mode !== "fixed") return { mode: "auto" };

  // Fixed without coordinates is a broken setting, not a request for auto.
  const { lat, lon } = geo;
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.warn(`${manifest.id}: location "${geo.name}" has no coordinates, falling back to auto`);
    return { mode: "auto" };
  }

  return { mode: "fixed", lat, lon };
}

/** A failure or a version mismatch falls back to the defaults, so the app still draws. */
export async function loadSettings(): Promise<Settings> {
  try {
    const { version, values } = await appsSettingsGet(client, { app_id: manifest.id });

    if (version !== VERSION) {
      console.warn(`${manifest.id}: settings version ${version} != ${VERSION}, using defaults`);
      return DEFAULTS;
    }

    return {
      location: readLocation(values),
      units: readUnits(values),
      showTime: readBoolean(values, "show_time", DEFAULTS.showTime),
      showDate: readBoolean(values, "show_date", DEFAULTS.showDate),
    };
  } catch (err) {
    console.error(`${manifest.id}: settings unavailable (${errorText(err)}), using defaults`);
    return DEFAULTS;
  }
}
