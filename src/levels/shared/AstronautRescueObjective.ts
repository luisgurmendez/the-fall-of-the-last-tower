import GameContext from "../../core/gameContext";
import { LevelObjective } from "../../core/level";
import { ObjectType } from "../../objects/objectType";


class AstronautRescueObjective implements LevelObjective {

  private numOfAstronauts: number;

  constructor(numOfAstronauts: number) {
    this.numOfAstronauts = numOfAstronauts;
  }

  step(context: GameContext) {
    const { rocket } = context;
    const astronauts = rocket.collisions.filter(obj => obj.type === ObjectType.ASTRONAUT);
    this.numOfAstronauts -= astronauts.length;
  }

  completed() {
    return this.numOfAstronauts === 0;
  }
}

export default AstronautRescueObjective;
