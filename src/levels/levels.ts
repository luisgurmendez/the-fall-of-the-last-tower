import Level from "../core/level";
import playgroundLevel from "../levels/playground";

class LevelsController {
  private level: Level;
  levelIndex: number;
  private levelGenerators: (() => Level)[];

  constructor() {
    this.levelIndex = this.getReachedLevel();
    this.levelGenerators = [playgroundLevel];
    this.level = this.levelGenerators[this.levelIndex]();
  }

  init() {
    if (this.levelIndex < this.levelGenerators.length) {
      this.level = this.levelGenerators[this.levelIndex]();
      this.level.init();
    }
  }

  next() {
    this.levelIndex++;
    this.init();
  }

  restart() {
    this.init();
  }

  getLevel() {
    return this.level;
  }

  getNumOfLevels() {
    // TODO: The last "level" is the thanks for playing screen...
    return this.levelGenerators.length - 1;
  }

  getReachedLevel() {
    const savedLevels = this.getSavedLevels();
    const passedLevels = Object.keys(savedLevels).map((l) => parseInt(l));
    if (passedLevels.length > 0) {
      return Math.max(...passedLevels) + 1;
    }
    return 0;
  }

  getSavedLevels(): SavedLevel {
    const savedLevelsString = localStorage.getItem("savedLevels");
    if (savedLevelsString) {
      return JSON.parse(savedLevelsString);
    }
    return {};
  }

  saveLevel(savedAstronauts: number) {
    const savedLevels = this.getSavedLevels();
    savedLevels[this.levelIndex] = Math.max(
      savedLevels[this.levelIndex] || 0,
      savedAstronauts
    );
    localStorage.setItem("savedLevels", JSON.stringify(savedLevels));
  }

  goToLevel(i: number) {
    this.levelIndex = i;
    this.init();
  }
}

export default LevelsController;

export interface SavedLevel {
  [levelIndex: number]: number;
}
