import Keyboard from "./keyboard";
import Clock from "./clock";
import CanvasGenerator from "./canvas";
import { createMenu, disposeMenu } from "../menu/menu";
import LevelsController from "../levels/levels";

const pressedKeys = Keyboard.getInstance();
class Game {

  private clock: Clock;
  private isPaused: boolean = false;
  private canvasRenderingContext: CanvasRenderingContext2D;

  private levelsController: LevelsController;
  private gameSpeed: number = 1;
  private showingMenu = false;

  constructor() {
    // Inits canvas rendering context
    this.canvasRenderingContext = CanvasGenerator.generateCanvas();
    this.clock = new Clock();
    this.levelsController = new LevelsController();
  }

  init() {
    this.levelsController.init();
    window.addEventListener('blur', () => {
      pressedKeys.clearPressedKeys();
      this.pause();
    });
    // window.addEventListener('focus', this.unPause);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'x') {
        this.gameSpeed += 1;
        this.gameSpeed = Math.min(this.gameSpeed, 5);
      }

      if (e.key === 'z') {
        this.gameSpeed -= 1;
        this.gameSpeed = Math.max(this.gameSpeed, 1);
      }

      if (e.key === 'm') {
        if (this.showingMenu) {
          this.hideMenu()
        } else {
          this.showMenu()
        }
      }

      if (e.key === 'r') {
        this.levelsController.restart();
      }

      if (e.key === ' ') {
        const level = this.levelsController.getLevel();
        level.camera.follow(level.rocket);
      }

      if (e.key === 'p' && !this.showingMenu) {
        if (this.isPaused) {
          this.unPause()
        } else {
          this.pause()
        }
      }
    })

    this.showMenu();
  }

  unPause = () => {
    this.isPaused = false;
    this.clock.start();
  }

  pause = () => {
    this.isPaused = true;
    this.clock.stop();
  }

  loop = () => {
    return () => {
      // this.stats.begin()
      this.update();
      requestAnimationFrame(this.loop());
      this.afterUpdate()
    }
  }

  private update() {
    try {
      const level = this.levelsController.getLevel();
      const gameApi = this.generateGameApi();
      level.update(gameApi);
    } catch (e) {
      console.log(e);
    }

  }

  private afterUpdate() {
    // this.stats.end()
  }

  private levelPassed = (withNumOfAstronautsSaved: number) => {
    // save to local storage withNumOfAstronautsSaved
    this.levelsController.saveLevel(withNumOfAstronautsSaved);
    this.levelsController.next();
  }

  private generateGameApi(): GameApi {
    const dt = this.clock.getDelta() * this.gameSpeed;
    return new GameApi(dt, this.canvasRenderingContext, this.isPaused, this.levelPassed, this.pause, this.unPause);
  }

  private showMenu() {
    this.pause();
    createMenu(
      this.hideMenu,
      this.levelsController.getNumOfLevels(),
      this.levelsController.levelIndex,
      this.levelsController.getSavedLevels(),
      (i: number) => this.levelsController.goToLevel(i)
    );
    this.showingMenu = true;
  }

  private hideMenu = () => {
    disposeMenu();
    this.showingMenu = false;
    this.unPause();
  }
}

export default Game;


export class GameApi {

  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly dt: number;

  levelPassed: (a: number) => void;

  readonly isPaused: boolean;
  pause: () => void;
  unPause: () => void;

  constructor(
    dt: number,
    canvasRenderingContext: CanvasRenderingContext2D,
    isPaused: boolean,
    levelPassed: (a: number) => void,
    pause: () => void,
    unPause: () => void
  ) {
    this.dt = dt;
    this.canvasRenderingContext = canvasRenderingContext;
    this.isPaused = isPaused;
    this.levelPassed = levelPassed;
    this.pause = pause;
    this.unPause = unPause;
  }
}