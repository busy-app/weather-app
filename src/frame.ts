// A screen writes its elements here every frame, but the element objects are reused: a field is
// only reassigned when its value actually changes, and only the elements that changed go into the
// draw request. A frame therefore costs what moved, not what is on screen.

import type {
  AnimationElement,
  DisplayDrawParams,
  ImageElement as AnyImageElement,
  TextElement,
  XpmBitmapElement,
} from "@busy-app/busy-lib";
import type { Font } from "./font.ts";

type DisplayElement = DisplayDrawParams["elements"][number];

/** busy-lib types an image as either an app asset or a stock one; the app draws only its own. */
type ImageElement = Extract<AnyImageElement, { path: string }>;

/** busy-lib types `path` and `stock_path` as alternatives; one element object is given whichever the screen asks for. */
type LoopElement = AnimationElement & { path?: string; stock_path?: string };

export interface Scroll {
  width: number;
  /** Pixels per minute. */
  rate: number;
  startDelay: number;
  repeatDelay: number;
}

export class Frame {
  private readonly live = new Map<string, DisplayElement>();

  private previous: string[] = [];
  private current: string[] = [];

  readonly changed: DisplayElement[] = [];

  readonly stale: string[] = [];

  begin() {
    this.changed.length = 0;
    this.stale.length = 0;
    this.current.length = 0;
  }

  invalidate() {
    this.live.clear();
  }

  end() {
    const previous = this.previous;
    const current = this.current;

    for (let i = 0; i < previous.length; i++) {
      const id = previous[i]!;
      if (current.indexOf(id) === -1) {
        this.stale.push(id);
        // A cleared element has to be drawn again if it comes back, so forget what it held.
        this.live.delete(id);
      }
    }

    // The two lists swap roles; neither is reallocated.
    previous.length = 0;
    this.previous = current;
    this.current = previous;
  }

  text(
    id: string,
    value: string,
    font: Font,
    color: string,
    x: number,
    y: number,
    z_index?: number,
    width?: number,
  ) {
    const element = this.element<TextElement>(id, "text");
    if (
      element.text === value &&
      element.font === font &&
      element.color === color &&
      element.x === x &&
      element.y === y &&
      element.z_index === z_index &&
      element.width === width
    ) {
      return;
    }

    element.text = value;
    element.font = font;
    element.color = color;
    element.x = x;
    element.y = y;
    element.z_index = z_index;
    element.width = width;
    this.changed.push(element);
  }

  scrollingText(id: string, value: string, font: Font, color: string, x: number, y: number, scroll: Scroll) {
    const element = this.element<TextElement>(id, "text");
    if (
      element.text === value &&
      element.font === font &&
      element.color === color &&
      element.x === x &&
      element.y === y &&
      element.width === scroll.width &&
      element.scroll_rate === scroll.rate &&
      element.scroll_start_delay === scroll.startDelay &&
      element.scroll_repeat_delay === scroll.repeatDelay
    ) {
      return;
    }

    element.text = value;
    element.font = font;
    element.color = color;
    element.x = x;
    element.y = y;
    element.width = scroll.width;
    element.scroll_rate = scroll.rate;
    element.scroll_start_delay = scroll.startDelay;
    element.scroll_repeat_delay = scroll.repeatDelay;
    this.changed.push(element);
  }

  image(id: string, path: string, x: number, y: number, z_index?: number) {
    const element = this.element<ImageElement>(id, "image");
    if (element.path === path && element.x === x && element.y === y && element.z_index === z_index) return;

    element.path = path;
    element.x = x;
    element.y = y;
    element.z_index = z_index;
    this.changed.push(element);
  }

  animation(id: string, path: string, x: number, y: number) {
    const element = this.element<LoopElement>(id, "animation");
    if (element.loop === true && element.path === path && element.x === x && element.y === y) return;

    element.path = path;
    element.loop = true;
    element.x = x;
    element.y = y;
    this.changed.push(element);
  }

  stockAnimation(id: string, stockPath: string, x: number, y: number) {
    const element = this.element<LoopElement>(id, "animation");
    if (element.loop === true && element.stock_path === stockPath && element.x === x && element.y === y) return;

    element.stock_path = stockPath;
    element.loop = true;
    element.x = x;
    element.y = y;
    this.changed.push(element);
  }

  xpm(id: string, data: string, x: number, y: number, z_index?: number) {
    const element = this.element<XpmBitmapElement>(id, "xpmbitmap");
    if (element.data === data && element.x === x && element.y === y && element.z_index === z_index) return;

    element.data = data;
    element.x = x;
    element.y = y;
    element.z_index = z_index;
    this.changed.push(element);
  }

  private element<T extends DisplayElement>(id: string, type: DisplayElement["type"]): T {
    this.current.push(id);

    const existing = this.live.get(id);
    if (existing !== undefined && existing.type === type) return existing as T;

    // Only the id and type are known here; the calling method fills in the rest before it is sent.
    const created = { type, id } as unknown as DisplayElement;
    this.live.set(id, created);

    return created as T;
  }
}
