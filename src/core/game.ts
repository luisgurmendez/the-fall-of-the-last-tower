import Clock from "./clock";
import CanvasGenerator from "./canvas";
import battlefieldLevel from "@/levels/battlefield";
import CustomKeyboard from "./keyboard";
// import Stats from "stats.js";

export const keyboard = CustomKeyboard.getInstance();

class Game {
  private clock: Clock;
  private isPaused = false;
  private canvasRenderingContext: CanvasRenderingContext2D;

  private level = battlefieldLevel();
  private gameSpeed = 1;
  private showingMenu = false;

  constructor() {
    // Inits canvas rendering context
    this.canvasRenderingContext = CanvasGenerator.generateCanvas();
    this.clock = new Clock();
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

      if (e.key === "p") {
        this.isPaused ? this.unPause() : this.pause();
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
      // stats.begin();
      this.update();
      // stats.end();
      requestAnimationFrame(this.loop());
      this.afterUpdate();
    };
  };

  private update() {
    try {
      const gameApi = this.generateGameApi();
      this.level.update(gameApi);
    } catch (e) {
      console.log(e);
    }
  }

  private afterUpdate() {
    // this.stats.end()
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

