// A minimal XPM2 writer, for the one bitmap the app sends (the forecast graph).

/**
 * Builds an XPM2 image.
 *
 * @param palette - `[symbol, color]` pairs, in the order they appear in the file. One character per symbol.
 * @param grid - One string per pixel row, each as wide as the image.
 */
export function xpm2(palette: readonly (readonly [string, string])[], grid: readonly string[]): string {
  const height = grid.length;
  const width = height > 0 ? grid[0]!.length : 0;

  const lines = ["! XPM2", `${width} ${height} ${palette.length} 1`];
  for (const [symbol, color] of palette) lines.push(`${symbol} c ${color}`);
  lines.push(...grid);

  return lines.join("\n");
}
