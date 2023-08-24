import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";

function generate() {
  const mars = new Planet(new Vector(0, 0), 3000, 90);
  const earth = new Planet(new Vector(0, 680), 3000, 120);
  earth.color = targetPlanetColor;

  const astronauts = generateAstronauts(new Vector(0, -200), new Vector(50, 820), new Vector(-50, 820))

  astronauts[0].velocity = new Vector(0, -20);
  astronauts[1].velocity = new Vector(5, 10);
  astronauts[2].velocity = new Vector(-5, 10);
  const objects: BaseObject[] = [
    earth,
    mars,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(earth));
  level.rocket.position = new Vector(0, -100);
  return level;
}

export default generate;
