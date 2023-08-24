import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import Color from "../utils/color";

function generate() {
  const earth = new Planet(new Vector(0, -2000), 3000, 100);
  const venus = new Planet(new Vector(0, 0), 2300, 90);
  const binary1 = new Planet(new Vector(-180, -900), 8000, 100);
  binary1.color = Color.white();
  binary1.isMoon = true;
  binary1.velocity = new Vector(0, 60);

  const binary2 = new Planet(new Vector(180, -900), 8000, 100);
  binary2.color = Color.white();
  binary2.isMoon = true;
  binary2.velocity = new Vector(0, -60);

  earth.color = targetPlanetColor;
  const astronauts = generateAstronauts(new Vector(0, -900), new Vector(-50, -2140), new Vector(250, -1800))
  const objects: BaseObject[] = [
    earth,
    venus,
    binary1,
    binary2,
    ...astronauts
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(earth));
  level.rocket.position = new Vector(0, -100);
  level.camera.zoom = 0.5;

  return level;
}

export default generate;
