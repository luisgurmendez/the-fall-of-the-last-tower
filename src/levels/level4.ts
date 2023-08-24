import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import Color from "../utils/color";
import { targetPlanetColor } from "./shared/targetPlanetColor";

function generate() {
  const earth = new Planet(new Vector(0, 100), 3000, 100);
  const mars = new Planet(new Vector(0, 480), 2000, 75);
  mars.color = targetPlanetColor;
  const whiteDwarf = new Planet(new Vector(240, 0), 10500, 45)
  whiteDwarf.color = Color.white();
  const whiteDwarf2 = new Planet(new Vector(-240, 0), 10500, 45)
  whiteDwarf2.color = Color.white();

  whiteDwarf2.hasRing = false;
  whiteDwarf.hasRing = false;

  const astronauts = generateAstronauts(new Vector(0, -200), new Vector(150, 600), new Vector(-150, 600))
  const objects: BaseObject[] = [
    earth,
    mars,
    whiteDwarf,
    whiteDwarf2,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(mars));
  level.rocket.position = new Vector(0, -10);
  level.camera.zoom = 0.57;
  return level;
}

export default generate;
