/**
 * The input manager is one for the page, but each match has its own canvas:
 * a new match's canvas takes the input over, and a match that's done lets
 * go of its own (never of the next match's).
 */

import { afterEach, describe, expect, test } from 'vitest';
import { InputManager } from './InputManager';

function rightClick(canvas: HTMLCanvasElement): { menuBlocked: boolean } {
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
  const contextMenu = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
  canvas.dispatchEvent(contextMenu);
  return { menuBlocked: contextMenu.defaultPrevented };
}

function newCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

afterEach(() => InputManager.reset());

describe('InputManager across matches', () => {
  test("a match's canvas gets the clicks, and the browser's menu doesn't open", () => {
    const input = InputManager.getInstance();
    const canvas = newCanvas();
    input.init(canvas);
    expect(rightClick(canvas).menuBlocked).toBe(true);
    expect(input.isMouseButtonJustPressed(2)).toBe(true);
  });

  test("BUG: the next match's canvas takes the input over (it was left on the first, removed, canvas)", () => {
    const input = InputManager.getInstance();
    const first = newCanvas();
    input.init(first);

    // The next match makes its canvas, then the first match stops (index.ts)
    const second = newCanvas();
    input.init(second);
    input.release(first);
    first.remove();

    input.update();
    expect(rightClick(second).menuBlocked).toBe(true);
    expect(input.isMouseButtonJustPressed(2)).toBe(true);
  });

  test('BUG: a match stopped before the next one starts leaves the input free for it', () => {
    const input = InputManager.getInstance();
    const first = newCanvas();
    input.init(first);
    input.release(first);
    first.remove();

    const second = newCanvas();
    input.init(second);
    expect(rightClick(second).menuBlocked).toBe(true);
    expect(input.isMouseButtonJustPressed(2)).toBe(true);
  });

  test("letting go of a canvas it isn't on does nothing", () => {
    const input = InputManager.getInstance();
    const canvas = newCanvas();
    input.init(canvas);
    input.release(newCanvas());
    expect(rightClick(canvas).menuBlocked).toBe(true);
  });

  test('init again with the same canvas keeps its listeners (no doubled presses)', () => {
    const input = InputManager.getInstance();
    const canvas = newCanvas();
    input.init(canvas);
    input.init(canvas);
    expect(rightClick(canvas).menuBlocked).toBe(true);
    expect(input.isMouseButtonJustPressed(2)).toBe(true);
  });

  test('after its match lets go, the old canvas no longer feeds input', () => {
    const input = InputManager.getInstance();
    const canvas = newCanvas();
    input.init(canvas);
    input.release(canvas);
    expect(rightClick(canvas).menuBlocked).toBe(false);
    expect(input.isMouseButtonJustPressed(2)).toBe(false);
  });
});
