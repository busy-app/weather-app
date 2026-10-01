export const SCREEN = { width: 72, height: 16 } as const;

/** Centers `size` inside `space`, hard against the near edge when it does not fit. */
export function center(size: number, space: number): number {
  return Math.max(0, Math.floor((space - size) / 2));
}
