export const MINUTE_MS = 60 * 1000;

/**
 * The device's offset is read twice, the second time at the shifted moment, so a daylight-saving
 * change between the two moments is still accounted for.
 */
export function asLocal(ms: number) {
  const guess = ms + new Date(ms).getTimezoneOffset() * MINUTE_MS;
  return new Date(ms + new Date(guess).getTimezoneOffset() * MINUTE_MS);
}

export function wallClock(now: number, utcOffsetMs: number) {
  return asLocal(now + utcOffsetMs);
}
