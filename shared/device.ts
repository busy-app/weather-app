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

/** Requests sent but not answered yet. */
let inFlight = 0;

/** Run after every request settles, so the app can send what it held back. */
let onSettled: (() => void) | undefined;

/** Sets the callback run whenever a request settles. */
export function whenSettled(fn: () => void): void {
  onSettled = fn;
}

/** How many requests are waiting for the device to answer. */
export function outstanding(): number {
  return inFlight;
}

/**
 * Hands a request to the device without waiting for the reply.
 *
 * The device takes far longer to answer than a frame takes to build, so the app does not sit on
 * it: it hands the body over and returns. `outstanding` lets the app keep only as much in flight
 * as the device can actually work through.
 */
function send(app: string, label: string, method: string, body: string): void {
  const settled = (error: string | undefined) => {
    inFlight--;
    if (error !== undefined) console.error(`${app}: ${label} failed: ${error}`);
    if (onSettled !== undefined) onSettled();
  };

  fetch(`${API}/display/draw`, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  }).then(
    (res) => settled(res.ok ? undefined : `HTTP ${res.status}`),
    (err) => settled(err instanceof Error ? err.message : String(err)),
  );
}

/** Draws elements. Only what changed since the last frame should be sent. */
export function displayDraw(request: DrawRequest): void {
  const body = JSON.stringify(request);
  inFlight++;
  send(request.application_name, "draw", "POST", body);
}

/** Removes elements by id. */
export function displayClear(request: ClearRequest): void {
  const body = JSON.stringify(request);
  inFlight++;
  send(request.application_name ?? "?", "clear", "DELETE", body);
}

export async function getAppSettings(appId: string): Promise<AppSettingsDocument> {
  const res = await call(`/apps/settings?app_id=${encodeURIComponent(appId)}`);
  return (await res.json()) as AppSettingsDocument;
}
