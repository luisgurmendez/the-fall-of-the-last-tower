import Renderable from "@/behaviors/renderable";
import Stepable from "@/behaviors/stepable";
import RenderElement, { NoRender } from "@/render/renderElement";
import RandomUtils from "@/utils/random";
import Vector from "@/physics/vector";
import GameContext from "@/core/gameContext";
import { PositionableMixin } from "@/mixins/positional";

const PositionalMixins = PositionableMixin(Object);

class BaseObject extends PositionalMixins implements Renderable, Stepable {
  public id: string;

  constructor(position = new Vector(), id: string = RandomUtils.generateId()) {
    super();
    this.id = id;
    this.position = position;
  }

  render(): RenderElement {
    return new NoRender();
  }

  step(gameContext: GameContext) { }
}

export default BaseObject;
