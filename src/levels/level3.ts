import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import { generateMoon } from "./shared/generators";

function generate() {
  const earth = new Planet(new Vector(0, 100), 3000, 100);
  const jupiter = new Planet(new Vector(0, -780), 6500, 175);
  jupiter.color = targetPlanetColor;
  const moon = generateMoon(new Vector(0, -430), new Vector(70, 0));
  const moon2 = generateMoon(new Vector(0, -1100), new Vector(70, 0));
  const astronauts = generateAstronauts(new Vector(0, -300), new Vector(100, -600), new Vector(250, -800))
  const objects: BaseObject[] = [
    earth,
    jupiter,
    moon,
    moon2,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(jupiter));
  level.rocket.position = new Vector(0, -10);
  return level;
}

export default generate;
