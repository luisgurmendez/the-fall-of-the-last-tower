import GameContext from "../core/gameContext";
import RandomUtils from "../utils/random";

export type RenderFn = (gameContext: GameContext) => void;

export type PositionType = 'overlay' | 'normal';
class RenderElement {
  _render: RenderFn;
  positionType: PositionType = 'normal';
  children: RenderElement[] = [];
  id = RandomUtils.generateId()

  zIndex: number = 1;

  constructor(render: RenderFn) {
    this._render = render;
  }

  render(gameContext: GameContext) {
    this._render(gameContext);
  }
}

export default RenderElement;

export class NoRender extends RenderElement {
  constructor() {
    super(() => { })
  }
}
