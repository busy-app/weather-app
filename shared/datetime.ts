const MINUTE_MS = 60 * 1000;

export function asLocal(ms: number): Date {
  const guess = ms + new Date(ms).getTimezoneOffset() * MINUTE_MS;
  return new Date(ms + new Date(guess).getTimezoneOffset() * MINUTE_MS);
}

export function wallClock(now: number, utcOffsetMs: number): Date {
  return asLocal(now + utcOffsetMs);
}
