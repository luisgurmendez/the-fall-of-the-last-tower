/**
 * Centralized input management for keyboard and mouse events.
 * Provides a clean interface for checking input state.
 */

import Vector from "@/physics/vector";

/**
 * Mouse button constants.
 */
export enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

export interface MouseState {
  position: Vector;
  buttons: Set<number>;
  wheelDelta: number;
}

export interface KeyboardState {
  keys: Set<string>;
  justPressed: Set<string>;
  justReleased: Set<string>;
}

export class InputManager {
  private static instance: InputManager | null = null;

  // Keyboard state
  private keysDown = new Set<string>();
  private keysJustPressed = new Set<string>();
  private keysJustReleased = new Set<string>();

  // Mouse state
  private mousePosition = new Vector(0, 0);
  private mouseButtons = new Set<number>();
  private mouseButtonsJustPressed = new Set<number>();
  private mouseButtonsJustReleased = new Set<number>();
  private mouseWheelDelta = 0;

  // Canvas reference for coordinate conversion
  private canvas: HTMLCanvasElement | null = null;

  // Event listener cleanup functions
  private cleanupFunctions: (() => void)[] = [];

  // Track if initialized
  private initialized = false;

  private constructor() {}

  /**
   * Get the singleton instance of the input manager.
   */
  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  /**
   * Initialize the input manager with event listeners.
   * @param canvas - The canvas element for mouse coordinate conversion
   */
  init(canvas: HTMLCanvasElement): void {
    if (this.initialized) {
      return;
    }

    this.canvas = canvas;
    this.initialized = true;

    // Keyboard events
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.keysDown.has(e.key)) {
        this.keysJustPressed.add(e.key);
      }
      this.keysDown.add(e.key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.key);
      this.keysJustReleased.add(e.key);
    };

    // Mouse events
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mousePosition.x = e.clientX - rect.left;
      this.mousePosition.y = e.clientY - rect.top;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!this.mouseButtons.has(e.button)) {
        this.mouseButtonsJustPressed.add(e.button);
      }
      this.mouseButtons.add(e.button);
    };

    const onMouseUp = (e: MouseEvent) => {
      this.mouseButtons.delete(e.button);
      this.mouseButtonsJustReleased.add(e.button);
    };

    const onMouseWheel = (e: WheelEvent) => {
      this.mouseWheelDelta = e.deltaY;
    };

    const onMouseLeave = () => {
      // Clear mouse buttons when mouse leaves canvas
      this.mouseButtons.clear();
    };

    const onBlur = () => {
      // Clear all input state when window loses focus
      this.keysDown.clear();
      this.mouseButtons.clear();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Add listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onMouseWheel);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);

    // Store cleanup functions
    this.cleanupFunctions = [
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => canvas.removeEventListener('mousemove', onMouseMove),
      () => canvas.removeEventListener('mousedown', onMouseDown),
      () => canvas.removeEventListener('mouseup', onMouseUp),
      () => canvas.removeEventListener('wheel', onMouseWheel),
      () => canvas.removeEventListener('mouseleave', onMouseLeave),
      () => canvas.removeEventListener('contextmenu', onContextMenu),
      () => window.removeEventListener('blur', onBlur),
    ];
  }

  /**
   * Update input state. Call this at the end of each frame.
   * Clears "just pressed" and "just released" states.
   */
  update(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();
    this.mouseWheelDelta = 0;
  }

  // Keyboard methods

  /**
   * Check if a key is currently held down.
   */
  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  /**
   * Check if a key was just pressed this frame.
   */
  isKeyJustPressed(key: string): boolean {
    return this.keysJustPressed.has(key);
  }

  /**
   * Check if a key was just released this frame.
   */
  isKeyJustReleased(key: string): boolean {
    return this.keysJustReleased.has(key);
  }

  /**
   * Check if any of the given keys are held down.
   */
  isAnyKeyDown(keys: string[]): boolean {
    return keys.some(key => this.keysDown.has(key));
  }

  /**
   * Check if all of the given keys are held down.
   */
  areAllKeysDown(keys: string[]): boolean {
    return keys.every(key => this.keysDown.has(key));
  }

  // Mouse methods

  /**
   * Get the current mouse position in canvas coordinates.
   */
  getMousePosition(): Vector {
    return this.mousePosition.clone();
  }

  /**
   * Check if a mouse button is currently held down.
   * Button 0 = left, 1 = middle, 2 = right
   */
  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  /**
   * Check if a mouse button was just pressed this frame.
   */
  isMouseButtonJustPressed(button: number): boolean {
    return this.mouseButtonsJustPressed.has(button);
  }

  /**
   * Check if a mouse button was just released this frame.
   */
  isMouseButtonJustReleased(button: number): boolean {
    return this.mouseButtonsJustReleased.has(button);
  }

  /**
   * Check if left mouse button is down.
   */
  isLeftMouseDown(): boolean {
    return this.isMouseButtonDown(0);
  }

  /**
   * Check if right mouse button is down.
   */
  isRightMouseDown(): boolean {
    return this.isMouseButtonDown(2);
  }

  /**
   * Check if left mouse button was just pressed.
   */
  isLeftMouseJustPressed(): boolean {
    return this.isMouseButtonJustPressed(0);
  }

  /**
   * Check if right mouse button was just pressed.
   */
  isRightMouseJustPressed(): boolean {
    return this.isMouseButtonJustPressed(2);
  }

  /**
   * Get the mouse wheel delta for this frame.
   * Positive = scroll down, Negative = scroll up
   */
  getMouseWheelDelta(): number {
    return this.mouseWheelDelta;
  }

  /**
   * Convert screen coordinates to world coordinates.
   * @param screenPos - Position in canvas coordinates
   * @param cameraPos - Camera position in world coordinates
   * @param zoom - Current camera zoom level
   */
  screenToWorld(screenPos: Vector, cameraPos: Vector, zoom: number): Vector {
    if (!this.canvas) {
      return screenPos.clone();
    }

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const worldX = (screenPos.x - canvasWidth / 2) / zoom + cameraPos.x;
    const worldY = (screenPos.y - canvasHeight / 2) / zoom + cameraPos.y;

    return new Vector(worldX, worldY);
  }

  /**
   * Get the current mouse position in world coordinates.
   */
  getMouseWorldPosition(cameraPos: Vector, zoom: number): Vector {
    return this.screenToWorld(this.mousePosition, cameraPos, zoom);
  }

  /**
   * Dispose of the input manager and remove all event listeners.
   */
  dispose(): void {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseButtons.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();
    this.canvas = null;
    this.initialized = false;
  }

  /**
   * Reset the singleton instance.
   */
  static reset(): void {
    if (InputManager.instance) {
      InputManager.instance.dispose();
      InputManager.instance = null;
    }
  }
}

// Convenience export
export const getInputManager = InputManager.getInstance;

export default InputManager;
