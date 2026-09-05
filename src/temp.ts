/** Temperature as it is shown: rounded, always signed — "+23°C", "-7°C", "0°C". */
export function formatTemp(temp: number, unit = "°C"): string {
  const rounded = Math.round(temp);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}${unit}`;
}
