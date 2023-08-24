import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import { Rectangle } from "../objects/shapes";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import Color from "../utils/color";
import generateAstronauts from "./shared/generateAstronauts";

//TODO win this level...
function generate() {
  const sun = new Planet(new Vector(0, 0), 53000, 1500)
  sun.color = new Color(200, 225, 25);
  const mars = new Planet(new Vector(0, -7400), 16000, 870)
  mars.color = targetPlanetColor;
  const astronaurs = generateAstronauts(new Vector(85, -1515), new Vector(270, -1510), new Vector(-1415, 1145));
  const objects: BaseObject[] = [
    sun,
    mars,
    ...astronaurs
  ];

  const level = new Level(objects, new LandingOnTargetPlanetObjective(mars), new Rectangle(20000, 20000));
  level.rocket.position = new Vector(0, -1510);
  return level;
}


export default generate;
