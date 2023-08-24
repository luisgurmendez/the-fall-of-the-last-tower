import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";

function generate() {
  const earth = new Planet(new Vector(0, 0), 3000, 100);
  const jupiter = new Planet(new Vector(400, -480), 6500, 175);
  jupiter.color = targetPlanetColor;
  const astronauts = generateAstronauts(new Vector(0, -300), new Vector(100, -600), new Vector(800, -500))
  // const objectiveInstructions = new TimedTextSequence([
  //   "From now on, your task is to land on the blue planet",
  //   "remember to rescue as many astronauts as possible"
  // ]);
  const objects: BaseObject[] = [
    earth,
    jupiter,
    // objectiveInstructions,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(jupiter));
  level.rocket.position = new Vector(0, -110);
  level.camera.zoom = 0.6;

  return level;
}

export default generate;
