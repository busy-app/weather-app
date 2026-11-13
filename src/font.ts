import { registerFontMaps } from "@busy-app/busy-lib";
import { bold, small } from "@busy-app/busy-lib/fonts";

export type Font = "bold" | "small";

registerFontMaps(bold);
registerFontMaps(small);
