
import Level, { LevelObjective } from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import GameContext from "../core/gameContext";
import RenderElement from "../render/renderElement";
import { PositionableMixin } from "../mixins/positional";
import Color from "../utils/color";
import LandingObjective from "./shared/LandingOnTargetPlanetObjective";
import TimedTextSequence from "../objects/timedTextSequence";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";


/**
 * Tutorial 2 - Try landing in the dark side of the moon.
 */

class LandingOnOppositeSideObjective implements LevelObjective {

  private landingObjective: LandingObjective;
  radius: number
  isInTheBottomSectionOfThePlanet = false;

  constructor(target: Planet, radius: number) {
    this.radius = radius;
    this.landingObjective = new LandingObjective(target);
  }

  step(context: GameContext): void {
    const { rocket } = context;
    this.landingObjective.step(context);
    // Rocket is in the bottom of the center of the planet
    this.isInTheBottomSectionOfThePlanet = rocket.position.y > this.landingObjective.target.position.y
  }

  completed() {
    return this.landingObjective.completed() && this.isInTheBottomSectionOfThePlanet;
  }
}


function generate() {
  const earth = new Planet(new Vector(0, 0), 3000, 140);
  earth.hasRing = false;
  earth.color = targetPlanetColor;
  const mark = new LandingMark(new Vector(earth.position.x, earth.position.y - earth.collisionMask.radius), earth.collisionMask.radius);
  const objectiveInstructions = new TimedTextSequence([
    "Lets make it a bit more challenging,",
    "can you land on the opposite side?"
  ]);
  const astronauts = generateAstronauts(new Vector(-200, 30), new Vector(-200, 230), new Vector(140, 140))
  const objects: BaseObject[] = [
    earth,
    mark,
    objectiveInstructions,
    ...astronauts
  ];

  const level = new Level(objects, new LandingOnOppositeSideObjective(earth, earth.collisionMask.radius));
  level.rocket.position = new Vector(0, -earth.collisionMask.radius - 10);
  level.camera.follow(level.rocket);

  return level;

}

const LandingMarkMixin = PositionableMixin(BaseObject);

class LandingMark extends LandingMarkMixin {

  position: Vector
  radius: number;

  constructor(position: Vector, radius: number) {
    super();
    this.position = position;
    this.radius = radius;
  }

  render() {
    const renderFn = (context: GameContext) => {
      const { canvasRenderingContext } = context;
      canvasRenderingContext.beginPath();
      canvasRenderingContext.setLineDash([5, 15]);
      canvasRenderingContext.strokeStyle = '#CCC';
      // canvasRenderingContext.moveTo(this.position.x, this.position.y);
      // canvasRenderingContext.bezierCurveTo(
      //   this.position.x - this.radius * 3,
      //   this.position.y + this.radius / 4,
      //   this.position.x - this.radius * 2,
      //   this.position.y + this.radius * 3,
      //   this.position.x,
      //   this.position.y + this.radius * 2
      // )

      // canvasRenderingContext.stroke();

      canvasRenderingContext.beginPath();
      canvasRenderingContext.arc(this.position.x, this.position.y + this.radius, this.radius, 0, Math.PI);
      canvasRenderingContext.stroke();

    }
    const renderElement = new RenderElement(renderFn);
    return renderElement;
  }

}

export default generate;
