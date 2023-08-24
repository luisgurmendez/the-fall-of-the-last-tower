import { LevelObjective } from "../../core/level";
import GameContext from "../../core/gameContext";
import Planet from "objects/planet/planet";

class LandingOnTargetPlanetObjective implements LevelObjective {

  private _completed = false;
  target: Planet;
  constructor(target: Planet) {
    this.target = target;
  }

  completed() {
    return this._completed;
  }

  step(context: GameContext): void {
    const { rocket } = context;
    if (!rocket.hasExploded && rocket.hasLanded && rocket.landedOnPlanet === this.target) {
      this._completed = true;
    }
  }
}

export default LandingOnTargetPlanetObjective;
