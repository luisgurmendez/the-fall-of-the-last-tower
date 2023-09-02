import GameContext from "@/core/gameContext";
import RandomUtils from "@/utils/random";

/// TODO(lg): This should be the canvas context no the game context
export type RenderFn = (gameContext: GameContext) => void;

export type PositionType = "overlay" | "normal";

class RenderElement {
  _render: RenderFn;
  positionType: PositionType = "normal";
  children: RenderElement[] = [];
  id = RandomUtils.generateId();
  zIndex = 1;
  saftly = false;

  constructor(render: RenderFn, saftly = false) {
    this._render = render;
    this.saftly = saftly;
  }

  render(gameContext: GameContext) {
    this._render(gameContext);
  }
}

export default RenderElement;

export class NoRender extends RenderElement {
  constructor() {
    super(() => { });
  }
}
