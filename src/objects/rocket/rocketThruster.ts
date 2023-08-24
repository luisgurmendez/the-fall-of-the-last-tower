import GameContext from "../../core/gameContext";
import { Rectangle } from "../../objects/shapes";
import Vector from "../../physics/vector";
import RenderElement from "../../render/renderElement";
import Renderable from "../../behaviors/renderable";
import Color from "../../utils/color";

export interface RocketThrusterRenderOptions {
  offset?: Vector;
  color?: Color;
}

const defaultOptions: Required<RocketThrusterRenderOptions> = {
  color: new Color(255, 10, 20),
  offset: new Vector()
}

class RocketThruster implements Renderable<RocketThrusterRenderOptions> {
  maxFuel: number;
  fuel: number;
  thrustPower: number;

  constructor(fuel: number, thrustPower: number) {
    this.fuel = fuel;
    this.thrustPower = thrustPower;
    this.maxFuel = fuel;
  }

  render(options?: RocketThrusterRenderOptions): RenderElement {
    const renderFn = (context: GameContext) => {
      const _options = { ...defaultOptions, ...options }

      const fuelBoxColor = _options.color.rgba();
      const { canvasRenderingContext } = context;
      const fuleConsumptionPercent = (this.fuel / this.maxFuel);

      canvasRenderingContext.translate(_options.offset.x, _options.offset.y);
      const fuelBoxHeight = canvasRenderingContext.canvas.height * 0.5;
      const fuelBoxPosition = new Vector(25, canvasRenderingContext.canvas.height * 0.25)
      const fuelBoxRect = new Rectangle(20, fuelBoxHeight);

      const filledFuelBoxHeight = fuelBoxHeight * fuleConsumptionPercent;
      const filledFuelBoxPosition = fuelBoxPosition.clone().add(new Vector(0, fuelBoxHeight - filledFuelBoxHeight))
      const filledFuelBoxRect = new Rectangle(20, filledFuelBoxHeight);

      canvasRenderingContext.strokeStyle = fuelBoxColor;
      canvasRenderingContext.fillStyle = fuelBoxColor;

      canvasRenderingContext.beginPath();
      canvasRenderingContext.rect(fuelBoxPosition.x, fuelBoxPosition.y, fuelBoxRect.w, fuelBoxRect.h);
      canvasRenderingContext.stroke();

      canvasRenderingContext.beginPath();
      canvasRenderingContext.rect(filledFuelBoxPosition.x, filledFuelBoxPosition.y, filledFuelBoxRect.w, filledFuelBoxRect.h);
      canvasRenderingContext.fill();

    }

    const renderElement = new RenderElement(renderFn)
    renderElement.positionType = 'overlay';
    return renderElement;
  }

  thrust(dt: number): number {
    if (!this.isEmpty()) {
      this.fuel -= dt;
      return this.thrustPower;
    }
    return 0;
  }

  isEmpty() {
    return this.fuel < 0;
  }
}

export default RocketThruster;