// The slice of the device HTTP API this app uses, and the element types DisplayDraw accepts.

/** Fonts available in DisplayDraw. */
export type DeviceFont =
  | "tiny"
  | "small"
  | "normal"
  | "condensed"
  | "bold"
  | "large"
  | "extra_large"
  | "global"
  | "superscript";

type Align =
  | "top_left"
  | "top_mid"
  | "top_right"
  | "mid_left"
  | "center"
  | "mid_right"
  | "bottom_left"
  | "bottom_mid"
  | "bottom_right";

interface Placed {
  id: string;
  x: number;
  y: number;
  display: "front" | "back";
  align?: Align;
  /** 0–100. */
  opacity?: number;
  z_index?: number;
  /** Seconds the element stays up; mutually exclusive with display_until. */
  timeout?: number;
  display_until?: string;
}

export interface TextElement extends Placed {
  type: "text";
  text: string;
  font: DeviceFont;
  /** #RRGGBBAA. */
  color?: string;
  width?: number;
  /** Pixels per minute; the label scrolls when the text is wider than `width`. */
  scroll_rate?: number;
  scroll_start_delay?: number;
  scroll_repeat_delay?: number;
}

export interface ImageElement extends Placed {
  type: "image";
  /** Either a file in the app package, or one shipped with the firmware. */
  path?: string;
  stock_path?: string;
  width?: number;
  height?: number;
}

export interface AnimationElement extends Placed {
  type: "animation";
  /** Either a file in the app package, or one shipped with the firmware. */
  path?: string;
  stock_path?: string;
  loop?: boolean;
  await_previous_end?: boolean;
  width?: number;
  height?: number;
}

export interface RectangleElement extends Placed {
  type: "rectangle";
  width: number;
  height: number;
  fill?: "none" | "solid" | "gradient_h" | "gradient_v";
  fill_colors?: string[];
  border_width?: number;
  border_color?: string;
  color?: string;
}

export interface CountdownElement extends Placed {
  type: "countdown";
  /** Unix seconds the countdown runs to. */
  until: string;
  font: DeviceFont;
  color?: string;
}

export interface XpmBitmapElement extends Placed {
  type: "xpmbitmap";
  /** XPM2 source. */
  data: string;
  width: number;
  height: number;
}

export type DisplayElement =
  | TextElement
  | ImageElement
  | AnimationElement
  | RectangleElement
  | CountdownElement
  | XpmBitmapElement;

export interface DrawRequest {
  application_name: string;
  /** 1–100; draws at or above the running app's priority take the screen. */
  priority: number;
  elements: DisplayElement[];
}

export interface AppSettingsDocument {
  version: number;
  /** Keyed by field id. */
  values: Record<string, unknown>;
}

/** Device address; in dev from VITE_BUSY_ADDR (.env). */
const addr = import.meta.env.VITE_BUSY_ADDR ?? "localhost";
const API = `${/^https?:\/\//i.test(addr) ? addr : `http://${addr}`}/api`;

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, init);

  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  }

  return res;
}

export async function displayDraw(request: DrawRequest) {
  await call("/display/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function displayClear(applicationName: string, elementIds?: string[]) {
  await call("/display/draw", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      application_name: applicationName,
      ...(elementIds ? { element_ids: elementIds } : {}),
    }),
  });
}

export async function getAppSettings(appId: string) {
  const res = await call(`/apps/settings?app_id=${encodeURIComponent(appId)}`);
  return (await res.json()) as AppSettingsDocument;
}
