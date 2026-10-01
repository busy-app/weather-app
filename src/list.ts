// A scrolling list of text rows with a scrollbar: one visible window onto `items`.
//
// The device draws no list of its own, so the visible rows are placed here. The geometry is
// worked out once; drawing only re-texts the rows and moves the thumb.

import { capBox, type Font } from "./font.ts";
import type { Frame } from "./frame.ts";

export interface ListOptions {
  /** Prefix for every element id, so several lists can share a screen. */
  id: string;
  /** Where the list starts, from the screen's top-left. */
  x: number;
  y: number;
  /** How much room the list has, scrollbar included. */
  width: number;
  height: number;
  font: Font;
  /** Blank pixels between one entry and the next. */
  gap?: number;
  /** Colours of the entries. */
  color: string;
  activeColor: string;
  scrollbar?: "left" | "right" | "none";
  trackColor?: string;
  thumbColor?: string;
  scrollbarGap?: number;
  scrollbarWidth?: number;
  z_index?: number;
}

export interface List {
  /** Draws the window of `items` centred on `selected`. */
  draw(frame: Frame, items: readonly string[], selected: number): void;
}

/** Builds a list whose fixed geometry is worked out once, up front. */
export function createList(options: ListOptions): List {
  const {
    id,
    x,
    y,
    width,
    height,
    font,
    gap = 0,
    color,
    activeColor,
    scrollbar = "right",
    trackColor,
    thumbColor,
    scrollbarGap = 0,
    scrollbarWidth = 1,
    z_index,
  } = options;

  if (scrollbar !== "none" && (trackColor === undefined || thumbColor === undefined)) {
    throw new Error('createList: trackColor and thumbColor are required unless scrollbar is "none"');
  }

  const barW = scrollbar === "none" ? 0 : scrollbarWidth;
  const barGap = scrollbar === "none" ? 0 : scrollbarGap;
  const textW = width - barW - barGap;
  const onLeft = scrollbar === "left";
  const textX = onLeft ? x + barW + barGap : x;
  const barX = onLeft ? x : x + width - barW;

  const { top: capTop, height: textH } = capBox(font);

  const step = textH + gap;
  const middle = y + Math.floor((height - textH) / 2);
  const above = step > 0 ? Math.ceil((middle - y) / step) : 0;
  const below = step > 0 ? Math.ceil((y + height - middle - textH) / step) : 0;
  const visible = above + below + 1;

  const rowIds: string[] = [];
  for (let i = 0; i < visible; i++) rowIds.push(`${id}-row-${i}`);

  const trackId = `${id}-track`;
  const thumbId = `${id}-thumb`;
  const thumbZ = z_index === undefined ? undefined : z_index + 1;

  return {
    draw(frame, items, selected) {
      for (let offset = -above; offset <= below; offset++) {
        const index = selected + offset;
        const value = index >= 0 && index < items.length ? items[index]! : "";
        frame.text(
          rowIds[offset + above]!,
          value,
          font,
          index === selected ? activeColor : color,
          textX,
          middle + offset * step - capTop,
          z_index,
          // The firmware clips the entry to this width.
          textW,
        );
      }

      if (scrollbar === "none") return;

      // The thumb shrinks with the list and travels down the track with the selection.
      let thumbTop = 0;
      let thumbHeight = height;
      if (items.length > visible) {
        thumbHeight = Math.max(1, Math.round((visible / items.length) * height));
        const travel = height - thumbHeight;
        thumbTop = travel <= 0 ? 0 : Math.round((selected / (items.length - 1)) * travel);
      }

      frame.rectangle(trackId, barX, y, barW, height, trackColor!, z_index);
      frame.rectangle(thumbId, barX, y + thumbTop, barW, thumbHeight, thumbColor!, thumbZ);
    },
  };
}
