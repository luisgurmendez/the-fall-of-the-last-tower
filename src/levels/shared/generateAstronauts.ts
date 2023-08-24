import Astronaut from "../../objects/astronaut/astronaut";
import Vector from "../../physics/vector";


function generateAstronauts(pos1: Vector, pos2: Vector, pos3: Vector) {
  return [new Astronaut(pos1), new Astronaut(pos2), new Astronaut(pos3)];
}

export default generateAstronauts;
