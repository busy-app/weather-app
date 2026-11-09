import {
  BusyBarAppClient,
  displayClear as clearRequest,
  displayDraw as drawRequest,
  wifiStatusGet,
  type DisplayClearParams,
  type DisplayDrawParams,
  type WifiStatusResponse,
} from "@busy-app/busy-lib";
import { errorText } from "./errors.ts";

export type WifiState = WifiStatusResponse["state"];

export const client = new BusyBarAppClient({ addr: __BUSY_ADDR__ });

let inFlight = 0;

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
 *
 * No timeout of its own: the firmware fails a request that gets no data for 5 s, and an earlier
 * give-up here would only let a second request start while the first still runs.
 */
async function track(app: string, label: string, request: Promise<unknown>) {
  inFlight++;

  let failed = false;
  try {
    await request;
  } catch (err) {
    failed = true;
    console.error(`${app}: ${label} failed: ${errorText(err)}`);
  }

  inFlight--;
  onSettled?.(failed);
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

export function displayClear(request: DisplayClearParams & { application_name: string }) {
  track(request.application_name, "clear", clearRequest(client, request));
}

export async function getWifiState() {
  const status = await wifiStatusGet(client);
  return status.state;
}
