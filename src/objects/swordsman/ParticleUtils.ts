import Color from "../../utils/color";
import Particle from "../../objects/particle/particle";
import Vector from "../../physics/vector";
import RandomUtils from "../../utils/random";
import { callTimes } from "../../utils/fn";

export function generateSwordsmanBloodBath(position: Vector) {
  return callTimes(30, () => {
    const ttl = RandomUtils.getValueInRange(0.5, 1.3);
    const particle = new Particle(ttl);
    particle.position = position;
    particle.color = new Color(
      RandomUtils.getIntegerInRange(150, 255),
      RandomUtils.getIntegerInRange(0, 70),
      RandomUtils.getIntegerInRange(0, 70)
    );
    particle.fade = true;
    const velocityAngleVariation = RandomUtils.getValueInRange(0, 360);
    particle.velocity = new Vector(RandomUtils.getValueInRange(0.5, 1), 0)
      .rotate(velocityAngleVariation)
      .scalar(RandomUtils.getNumberWithVariance(10, 20));
    particle.direction = particle.velocity.clone().normalize();
    particle.size = RandomUtils.getValueInRange(1, 3);

    return particle;
  });
}
