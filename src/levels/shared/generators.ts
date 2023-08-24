import Astronaut from "../../objects/astronaut/astronaut";
import Planet from "../../objects/planet/planet";
import Vector from "../../physics/vector";
import Color from "../../utils/color";

export function generateMoon(position: Vector, velocity: Vector = new Vector()) {
  const moon = new Planet(position, 0, 5);
  moon.isMoon = true;
  moon.color = Color.white();
  moon.velocity = velocity;
  moon.showGravityThreshold = false;
  return moon;
}

export function generateAstronauts(pos1: Vector, pos2: Vector, pos3: Vector) {
  return [new Astronaut(pos1), new Astronaut(pos2), new Astronaut(pos3)];
}