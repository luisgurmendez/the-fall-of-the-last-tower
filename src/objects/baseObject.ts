import Renderable from "../behaviors/renderable";
import Stepable from "../behaviors/stepable";
import { NoRender } from "../render/renderElement";
import GameContext from "../core/gameContext";
import { ObjectType } from "./objectType";
import RandomUtils from "../utils/random";
class BaseObject implements Renderable, Stepable {

  public id: string;
  public type: ObjectType = ObjectType.BASE_OBJECT;

  constructor(id: string = RandomUtils.generateId()) {
    this.id = id;
  }

  render() {
    return new NoRender();
  }

  step(gameContext: GameContext) { }

}

export default BaseObject;

