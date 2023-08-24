import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import Color from "../utils/color";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import { generateMoon } from "./shared/generators";

// Moons!
function generate() {
  const earth = new Planet(new Vector(0, 0), 3000, 100);

  const mars = new Planet(new Vector(0, -780), 2000, 75);
  mars.color = targetPlanetColor;

  const moon = generateMoon(new Vector(0, 150), new Vector(55, 0))
  const moon2 = generateMoon(new Vector(0, -150), new Vector(-55, 0))
  const moon3 = generateMoon(new Vector(250, 0), new Vector(0, 60))
  const moon4 = generateMoon(new Vector(-250, 0), new Vector(0, -60))
  const moon5 = generateMoon(new Vector(300, 150), new Vector(-1, 1).normalize().scalar(30))
  const moon6 = generateMoon(new Vector(-300, -150), new Vector(1, -1).normalize().scalar(30))

  const astronauts = generateAstronauts(new Vector(0, -200), new Vector(150, 0), new Vector(-150, 0))
  const objects: BaseObject[] = [
    earth,
    mars,
    moon,
    moon3,
    moon2,
    moon4,
    moon5,
    moon6,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(mars));
  level.rocket.position = new Vector(0, -110);
  return level;
}

export default generate;

