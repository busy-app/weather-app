export function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
