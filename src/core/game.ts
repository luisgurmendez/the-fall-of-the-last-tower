import Clock from "./clock";
import CanvasGenerator from "./canvas";
import { generateDefault as mobaLevel } from "@/levels/mobaLevel";
import { generateCustomMapLevel } from "@/levels/customMapLevel";
import { InputManager } from "./input/InputManager";
import { getShopUI } from "@/ui/shop/ShopUI";
import { profiler } from "@/debug/PerformanceProfiler";
import { getCursorManager } from "./CursorManager";

// Profiler runs silently in dev mode by default
// Press F3 to toggle verbose mode with debug panel
// Press F4 to log detailed breakdown to console

class Game {
  private clock: Clock;
  private isPaused = false;
  private canvasRenderingContext: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  private level;
  private gameSpeed = 1;
  private customMapKey?: string;

  constructor(customMapKey?: string) {
    this.customMapKey = customMapKey;

    // Initialize level based on mode
    if (customMapKey) {
      const customLevel = generateCustomMapLevel(customMapKey);
      if (customLevel) {
        this.level = customLevel;
      } else {
        console.warn('Failed to load custom map, falling back to default');
        this.level = mobaLevel();
      }
    } else {
      this.level = mobaLevel();
    }
    // Inits canvas rendering context
    const { canvas, context } = CanvasGenerator.generateCanvas();
    this.canvas = canvas;
    this.canvasRenderingContext = context;
    this.clock = new Clock();

    // Initialize input manager with canvas for mouse/keyboard events
    InputManager.getInstance().init(canvas);

    // Initialize cursor manager with canvas
    getCursorManager().init(canvas);
  }

  init() {
    // stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    // document.body.appendChild(stats.dom);
    window.addEventListener("blur", () => {
      this.pause();
    });

    window.addEventListener('focus', this.unPause);

    window.addEventListener("keydown", (e) => {
      if (e.key === "x") {
        this.gameSpeed += 1;
        this.gameSpeed = Math.min(this.gameSpeed, 3);
      }

      if (e.key === "z") {
        this.gameSpeed -= 0.5;
        this.gameSpeed = Math.max(this.gameSpeed, 0.1);
      }

      if (e.key === "b") {
        document.body.requestFullscreen();
      }

      // 'P' key to toggle shop (works even when paused)
      if (e.key === "p" || e.key === "P") {
        const shopUI = getShopUI();
        shopUI.toggle();
      }

      // Use 'Escape' to pause when shop is not open, or close shop if open
      if (e.key === "Escape") {
        const shopUI = getShopUI();
        if (shopUI.isOpen()) {
          shopUI.close();
        } else {
          this.isPaused ? this.unPause() : this.pause();
        }
      }

      // Restart with Shift+R (not just R, to avoid conflicts with abilities)
      if (e.key === "r" && e.shiftKey) {
        if (this.customMapKey) {
          const customLevel = generateCustomMapLevel(this.customMapKey);
          if (customLevel) {
            this.level = customLevel;
          }
        } else {
          this.level = mobaLevel();
        }
      }
    });
  }

  unPause = () => {
    this.isPaused = false;
    this.clock.start();
  };

  pause = () => {
    this.isPaused = true;
    this.clock.stop();
  };

  loop = () => {
    return () => {
      profiler.beginFrame();
      this.update();
      profiler.endFrame();
      requestAnimationFrame(this.loop());
    };
  };

  private update() {
    try {
      const gameApi = this.generateGameApi();
      this.level.update(gameApi);

      // Clear "just pressed" input states at end of frame
      InputManager.getInstance().update();
    } catch (e) {
      console.log(e);
    }
  }

  private generateGameApi(): GameApi {
    const dt = this.clock.getDelta() * this.gameSpeed;
    return {
      dt,
      canvasRenderingContext: this.canvasRenderingContext,
      isPaused: this.isPaused,
      pause: this.pause,
      unPause: this.unPause
    }
  }
};

export default Game;


export interface GameApi { }

export interface GameApi {
  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly dt: number;
  readonly isPaused: boolean;
  pause: () => void;
  unPause: () => void;
}

