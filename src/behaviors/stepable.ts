import GameContext from "../core/gameContext";

interface Stepable {
  /**
  * User for updating the state of an object, runs every time before a render method.
  */
  step(context: GameContext): void;
}

export function isStepable(object: any): object is Stepable {
  return typeof object === 'object' && object.step !== undefined;
}

export default Stepable;