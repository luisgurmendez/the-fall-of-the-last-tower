import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import Color from "../utils/color";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import { Rectangle } from "../objects/shapes";

function generate() {
  const earth = new Planet(new Vector(0, -2900), 3000, 100);
  earth.color = targetPlanetColor;
  const jupiter = new Planet(new Vector(0, 0), 3000, 100);
  const whiteDwarf1 = new Planet(new Vector(-400, -1000), 12500, 90);
  whiteDwarf1.color = Color.white();
  const whiteDwarf2 = new Planet(new Vector(400, -1000), 12500, 90);
  whiteDwarf2.color = Color.white();
  const whiteDwarf3 = new Planet(new Vector(0, -1800), 12500, 90);
  whiteDwarf3.color = Color.white();
  const astronauts = generateAstronauts(new Vector(0, -1000), new Vector(-30, -1300), new Vector(30, -1300))
  const objects: BaseObject[] = [
    earth,
    jupiter,
    whiteDwarf1,
    whiteDwarf2,
    whiteDwarf3,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(earth), new Rectangle(9000, 9000));
  level.rocket.position = new Vector(0, -110);
  return level;
}

export default generate;
