// The elements on screen, kept from one frame to the next.
//
// A screen writes its elements here every frame, but the element objects are reused: a field is
// only reassigned when its value actually changes, and only the elements that changed go into the
// draw request. A frame therefore costs what moved, not what is on screen.

import type {
  AnimationElement,
  DisplayElement,
  ImageElement,
  RectangleElement,
  TextElement,
  XpmBitmapElement,
} from "@shared/device";
import type { Font } from "./font.ts";

/** How a text that does not fit scrolls. */
export interface Scroll {
  width: number;
  /** Pixels per minute. */
  rate: number;
  startDelay: number;
  repeatDelay: number;
}

export class Frame {
  /** One element per id, kept between frames. */
  private readonly live = new Map<string, DisplayElement>();

  /** The ids on screen before this frame, and the ids used so far in it. */
  private previous: string[] = [];
  private current: string[] = [];

  /** The elements whose fields changed; what the draw request carries. */
  readonly changed: DisplayElement[] = [];

  /** The ids that have left the screen; what the clear request carries. */
  readonly stale: string[] = [];

  /** Starts a frame. */
  begin(): void {
    this.changed.length = 0;
    this.stale.length = 0;
    this.current.length = 0;
  }

  invalidate(): void {
    this.live.clear();
  }

  /** Ends a frame, working out which ids have left the screen. */
  end(): void {
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
  ): void {
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

  /** A text that scrolls through its `width` when it does not fit. */
  scrollingText(id: string, value: string, font: Font, color: string, x: number, y: number, scroll: Scroll): void {
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

  image(id: string, path: string, x: number, y: number, z_index?: number): void {
    const element = this.element<ImageElement>(id, "image");
    if (element.path === path && element.x === x && element.y === y && element.z_index === z_index) return;

    element.path = path;
    element.x = x;
    element.y = y;
    element.z_index = z_index;
    this.changed.push(element);
  }

  /** A looping animation from the app's own assets. */
  animation(id: string, path: string, x: number, y: number): void {
    const element = this.element<AnimationElement>(id, "animation");
    if (element.loop === true && element.path === path && element.x === x && element.y === y) return;

    element.path = path;
    element.loop = true;
    element.x = x;
    element.y = y;
    this.changed.push(element);
  }

  /** A looping animation from the device's stock assets. */
  stockAnimation(id: string, stockPath: string, x: number, y: number): void {
    const element = this.element<AnimationElement>(id, "animation");
    if (element.loop === true && element.stock_path === stockPath && element.x === x && element.y === y) return;

    element.stock_path = stockPath;
    element.loop = true;
    element.x = x;
    element.y = y;
    this.changed.push(element);
  }

  /** A rectangle with a solid, single-colour fill and no border. */
  rectangle(id: string, x: number, y: number, width: number, height: number, fill: string, z_index?: number): void {
    const element = this.element<RectangleElement>(id, "rectangle");
    const fill_colors = element.fill_colors;

    if (
      element.x === x &&
      element.y === y &&
      element.width === width &&
      element.height === height &&
      fill_colors !== undefined &&
      fill_colors[0] === fill &&
      element.z_index === z_index
    ) {
      return;
    }

    element.x = x;
    element.y = y;
    element.width = width;
    element.height = height;
    element.fill = "solid";
    element.border_width = 0;
    // The array is kept too: only its one colour ever changes.
    if (fill_colors === undefined) element.fill_colors = [fill];
    else fill_colors[0] = fill;
    element.z_index = z_index;
    this.changed.push(element);
  }

  xpm(id: string, data: string, x: number, y: number): void {
    const element = this.element<XpmBitmapElement>(id, "xpmbitmap");
    if (element.data === data && element.x === x && element.y === y) return;

    element.data = data;
    element.x = x;
    element.y = y;
    this.changed.push(element);
  }

  /** The element for `id`, created once and marked as used by this frame. */
  private element<T extends DisplayElement>(id: string, type: DisplayElement["type"]): T {
    this.current.push(id);

    const existing = this.live.get(id);
    if (existing !== undefined && existing.type === type) return existing as T;

    const created = { type, id } as unknown as DisplayElement;
    this.live.set(id, created);
    return created as T;
  }
}
