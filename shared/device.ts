import {
  BusyBarAppClient,
  displayClear as clearRequest,
  displayDraw as drawRequest,
  wifiStatusGet,
  type DisplayClearParams,
  type DisplayDrawParams,
  type WifiStatusResponse,
} from "@busy-app/busy-lib";

export type WifiState = WifiStatusResponse["state"];

export const client = new BusyBarAppClient({ addr: __BUSY_ADDR__ });

let inFlight = 0;

const REPLY_TIMEOUT_MS = 5000;

/** Run after every request settles, so the app can send what it held back. */
let onSettled: ((failed: boolean) => void) | undefined;

export function whenSettled(fn: (failed: boolean) => void) {
  onSettled = fn;
}

export function outstanding() {
  return inFlight;
}

/**
 * The device takes far longer to answer than a frame takes to build, so the app does not sit on
 * it. `outstanding` lets the app keep only as much in flight as the device can actually work through.
 */
async function track(app: string, label: string, request: Promise<unknown>) {
  let done = false;
  inFlight++;

  const timer = setTimeout(() => settled(`no reply in ${REPLY_TIMEOUT_MS} ms`), REPLY_TIMEOUT_MS);

  let error: string | undefined;
  try {
    await request;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  settled(error);

  function settled(error: string | undefined) {
    if (done) return;

    done = true;
    clearTimeout(timer);

    inFlight--;
    if (error !== undefined) console.error(`${app}: ${label} failed: ${error}`);
    if (onSettled !== undefined) onSettled(error !== undefined);
  }
}

/**
 * Only what changed since the last frame should be sent.
 *
 * busy-lib serializes the body before the call returns, so the caller may reuse the element
 * objects for the next frame straight away.
 */
export function displayDraw(request: DisplayDrawParams) {
  track(request.application_name, "draw", drawRequest(client, request));
}

export function displayClear(request: DisplayClearParams) {
  track(request.application_name ?? "?", "clear", clearRequest(client, request));
}

export async function getWifiState() {
  const status = await wifiStatusGet(client);
  return status.state ?? "unknown";
}
