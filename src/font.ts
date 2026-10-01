// Generated from the BUSY Bar font maps (bold, small). Do not edit by hand.
// Per character code 32..176: [advance, ink top, ink height].

/** The fonts the app draws with. */
export type Font = "bold" | "small";

/** Distance from the top of the line to the baseline. */
export const ASCENT: Record<Font, number> = { bold: 9, small: 7 };

type Metric = [advance: number, top: number, height: number];

const FIRST = 32;

const BOLD: Metric[] = [[5,8,1],[4,2,7],[4,2,2],[8,2,7],[9,8,8],[9,2,7],[8,2,7],[2,2,2],[4,2,7],[4,2,7],[4,2,4],[7,3,5],[3,12,3],[4,5,1],[4,8,1],[6,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[2,3,5],[3,9,7],[5,3,5],[7,4,3],[5,3,5],[7,2,7],[10,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[6,2,7],[6,2,7],[7,2,7],[7,2,7],[5,2,7],[6,2,7],[7,2,7],[6,2,7],[10,2,7],[8,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[7,2,7],[8,2,7],[11,2,7],[7,2,7],[7,2,7],[7,2,7],[4,2,7],[6,2,7],[4,2,7],[7,2,3],[5,8,1],[5,8,1],[6,4,5],[6,2,7],[6,4,5],[6,2,7],[6,4,5],[6,2,7],[6,8,7],[6,2,7],[5,2,7],[5,6,9],[6,2,7],[5,2,7],[8,4,5],[6,4,5],[6,4,5],[6,8,7],[6,8,7],[5,4,5],[6,4,5],[6,2,7],[6,4,5],[7,4,5],[8,4,5],[7,4,5],[6,8,7],[6,4,5],[5,2,7],[4,2,7],[5,2,7],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[6,4,4],[5,8,1],[4,2,7],[4,2,7],[7,2,7],[7,2,7],[7,2,7],[4,2,7],[6,7,9],[6,7,9],[10,2,7],[10,2,7],[9,4,5],[9,4,5],[9,4,5],[10,2,7],[10,2,7],[5,2,3]];

const SMALL: Metric[] = [[2,6,1],[2,2,5],[4,2,2],[6,2,5],[4,4,6],[5,2,4],[5,2,5],[2,2,2],[3,2,5],[3,2,5],[4,2,4],[4,3,3],[2,8,2],[3,4,1],[2,6,1],[3,2,5],[4,2,5],[3,2,5],[4,2,5],[4,2,5],[4,2,5],[4,2,5],[4,2,5],[4,2,5],[4,2,5],[4,2,5],[2,3,4],[3,5,5],[4,2,5],[4,3,3],[4,2,5],[4,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[2,2,5],[4,2,5],[5,2,5],[4,2,5],[6,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[5,2,5],[4,2,5],[5,2,5],[4,2,5],[6,2,5],[4,2,5],[4,2,5],[4,2,5],[3,2,5],[3,2,5],[3,2,5],[4,2,2],[4,6,1],[4,6,1],[4,3,4],[4,2,5],[4,3,4],[4,2,5],[4,3,4],[3,2,5],[4,5,5],[4,2,5],[2,2,5],[3,2,7],[4,2,5],[2,2,5],[6,3,4],[4,3,4],[4,3,4],[4,5,5],[4,5,5],[3,3,4],[4,3,4],[3,2,5],[4,3,4],[4,3,4],[6,3,4],[4,3,4],[4,5,5],[4,3,4],[4,2,5],[2,2,5],[4,2,5],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[5,4,2],[2,6,1],[2,2,5],[2,2,5],[5,2,5],[5,2,5],[4,2,5],[2,2,5],[5,2,5],[5,2,5],[8,3,7],[8,3,7],[6,3,3],[6,3,3],[6,3,3],[8,3,7],[8,3,7],[4,2,3]];

const TABLES: Record<Font, Metric[]> = { bold: BOLD, small: SMALL };

/** Metrics for a character the tables do not cover. */
const FALLBACK: Record<Font, Metric> = {
  bold: [4, 3, 5],
  small: [3, 3, 3],
};

function metric(code: number, font: Font): Metric {
  const table = TABLES[font];
  if (code < FIRST || code > FIRST + table.length - 1) return FALLBACK[font];
  return table[code - FIRST]!;
}

/** The width of `text` in pixels. */
export function textWidth(text: string, font: Font): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) width += metric(text.charCodeAt(i), font)[0];
  return width;
}

/** Where the visible pixels sit: `top` is the offset from the line top, `height` the ink height. */
export interface InkBox {
  top: number;
  height: number;
}

/** The ink box of `text`: the top of its visible pixels and their height. */
export function textInk(text: string, font: Font): InkBox {
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < text.length; i++) {
    const m = metric(text.charCodeAt(i), font);
    if (m[2] === 0) continue;
    if (m[1] < top) top = m[1];
    if (m[1] + m[2] > bottom) bottom = m[1] + m[2];
  }
  if (top === Infinity) return { top: 0, height: 0 };
  return { top, height: bottom - top };
}

/** The ink box of a capital letter, for lines that mix text and icons. */
export function capBox(font: Font): InkBox {
  return textInk("X", font);
}

/** Boxes are asked for again and again with the same few strings, so they are kept. */
const BOXES: Record<Font, Map<string, InkBox>> = { bold: new Map(), small: new Map() };

/**
 * The layout box of `text`: the top of its visible pixels and the cap height the line occupies.
 *
 * Descenders are not counted: a line of text is as tall as its capitals, so one with a "g"
 * or a comma in it still sits on the same baseline as one without.
 */
export function textBox(text: string, font: Font): InkBox {
  const boxes = BOXES[font];
  const known = boxes.get(text);
  if (known !== undefined) return known;

  let top = Infinity;
  for (let i = 0; i < text.length; i++) {
    const m = metric(text.charCodeAt(i), font);
    if (m[2] === 0) continue;
    if (m[1] < top) top = m[1];
  }

  const box = top === Infinity ? { top: 0, height: 0 } : { top, height: Math.max(0, ASCENT[font] - top) };
  boxes.set(text, box);
  return box;
}
