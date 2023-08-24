import Level from "../core/level";
// import generateTutorialLevel from "../levels/tutorial";
// import generateTutorial2Level from "../levels/tutorial2";
import generateTutorialLevel from "../levels/level0";
import generateTutorial2Level from "../levels/level00";
import generateLevel1 from "../levels/level1";
import generateLevel2 from "../levels/level2";
import generateLevel5 from "../levels/level5";
import generateLevel6 from "../levels/level6";
import generateLevel8 from "../levels/level8";
import generateLevel7 from "../levels/level7";
import generateLevel3 from "../levels/level3";
import generateLevel4 from '../levels/level4';
import generateBig from '../levels/superBig';
import generateEndingScreen from '../levels/endScreen';
class LevelsController {

  private level: Level;
  levelIndex: number;
  private levelGenerators: (() => Level)[];

  constructor() {
    this.levelIndex = this.getReachedLevel();
    this.levelGenerators = [
      generateTutorialLevel,
      generateTutorial2Level,
      generateLevel1,
      generateLevel3,
      generateLevel5,
      generateLevel2,
      generateLevel6,
      generateLevel7,
      generateLevel8,
      generateLevel4,
      generateBig,
      generateEndingScreen
    ];
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
    const passedLevels = Object.keys(savedLevels).map(l => parseInt(l));
    if (passedLevels.length > 0) {
      return Math.max(...passedLevels) + 1;
    }
    return 0;
  }

  getSavedLevels(): SavedLevel {
    const savedLevelsString = localStorage.getItem('savedLevels');
    if (savedLevelsString) {
      return JSON.parse(savedLevelsString)
    }
    return {};
  }

  saveLevel(savedAstronauts: number) {
    const savedLevels = this.getSavedLevels();
    savedLevels[this.levelIndex] = Math.max(savedLevels[this.levelIndex] || 0, savedAstronauts);
    localStorage.setItem('savedLevels', JSON.stringify(savedLevels));
  }

  goToLevel(i: number) {
    this.levelIndex = i;
    this.init();
  }
}

export default LevelsController;


export interface SavedLevel {
  [levelIndex: number]: number
}
