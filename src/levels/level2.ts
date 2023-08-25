import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";

function generate() {
  const jupiter = new Planet(new Vector(0, -1000), 3400, 110);
  const venus = new Planet(new Vector(0, 0), 3000, 100);
  const earth = new Planet(new Vector(300, -580), 3200, 70);
  const mars = new Planet(new Vector(-150, -600), 3800, 120);
  earth.color = targetPlanetColor;
  const astronauts = generateAstronauts(
    new Vector(20, -1120),
    new Vector(100, -600),
    new Vector(250, -800)
  );
  const objects: BaseObject[] = [earth, venus, mars, jupiter, ...astronauts];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(earth));
  level.rocket.position = new Vector(0, -110);
  level.camera.zoom = 0.5;

  return level;
}

export default generate;
