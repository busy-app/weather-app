// The device's HTTP API. Everything the app sends to the BUSY Bar goes through here.

/** Fonts the display accepts. */
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

/** Fields every display element carries. */
interface Placed {
  /** Unique identifier; the device replaces an element with the same id. */
  id: string;
  /** Top-left corner, in screen pixels. */
  x: number;
  y: number;
  z_index?: number;
  display?: "front" | "back";
}

export interface TextElement extends Placed {
  type: "text";
  text: string;
  font: DeviceFont;
  /** #RRGGBBAA. */
  color?: string;
  /** Clips the text, and the box it scrolls in. */
  width?: number;
  scroll_rate?: number;
  scroll_start_delay?: number;
  scroll_repeat_delay?: number;
}

export interface ImageElement extends Placed {
  type: "image";
  /** Path to the asset, relative to the app's `images/` directory. */
  path?: string;
  stock_path?: string;
  /** 0–100. */
  opacity?: number;
}

export interface AnimationElement extends Placed {
  type: "animation";
  path?: string;
  stock_path?: string;
  loop?: boolean;
  await_previous_end?: boolean;
  section?: string;
  opacity?: number;
}

export interface RectangleElement extends Placed {
  type: "rectangle";
  width: number;
  height: number;
  radius?: number;
  fill?: "none" | "solid" | "gradient_h" | "gradient_v";
  fill_colors?: string[];
  border_width?: number;
  border_color?: string;
}

export interface XpmBitmapElement extends Placed {
  type: "xpmbitmap";
  /** XPM2 source, "! XPM2" signature line included. */
  data: string;
  opacity?: number;
}

export type DisplayElement =
  | TextElement
  | ImageElement
  | AnimationElement
  | RectangleElement
  | XpmBitmapElement;

export interface DrawRequest {
  application_name: string;
  /** 1–100; draws at or above the running app's priority take the screen. */
  priority?: number;
  elements: DisplayElement[];
}

export interface ClearRequest {
  application_name?: string;
  element_ids?: string[];
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

const TYPES = ["text", "image", "animation", "rectangle", "xpmbitmap"] as const;

/** "text:3 image:2" — the element types in a request. */
function summarize(elements: DisplayElement[]): string {
  let out = "";
  for (const type of TYPES) {
    let count = 0;
    for (const element of elements) if (element.type === type) count++;
    if (count > 0) out += `${out === "" ? "" : " "}${type}:${count}`;
  }
  return out;
}

function elapsed(started: number): number {
  return Date.now() - started;
}

/**
 * Draws elements. Only what changed since the last frame should be sent.
 *
 * Logs the element types in the request and how long the device took to accept it, which is
 * what makes a slow frame visible in the device console.
 */
export async function displayDraw(request: DrawRequest): Promise<void> {
  const before = Date.now();
  const body = JSON.stringify(request);
  const serialized = Date.now() - before;
  const started = Date.now();

  try {
    await call("/display/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } finally {
    console.log(
      `${request.application_name}: draw ${request.elements.length} [${summarize(request.elements)}] ` +
        `${body.length}B stringify ${serialized}ms request ${elapsed(started)}ms`,
    );
  }
}

/** Removes elements by id. */
export async function displayClear(request: ClearRequest): Promise<void> {
  const ids = request.element_ids ?? [];
  const started = Date.now();

  try {
    await call("/display/draw", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } finally {
    console.log(`${request.application_name ?? "?"}: clear ${ids.length} in ${elapsed(started)}ms`);
  }
}

export async function getAppSettings(appId: string): Promise<AppSettingsDocument> {
  const res = await call(`/apps/settings?app_id=${encodeURIComponent(appId)}`);
  return (await res.json()) as AppSettingsDocument;
}
