import Color from "@/utils/color";
import Particle from "@/objects/particle/particle";
import Vector from "@/physics/vector";
import RandomUtils from "@/utils/random";
import { callTimes } from "@/utils/fn";

export function generateBloodExplotion(position: Vector) {
  return _generateBloodParticles(position, 30, () => RandomUtils.getNumberWithVariance(10, 20));
}

export function generateBloodDrops(position: Vector) {
  return _generateBloodParticles(position, 5, () => RandomUtils.getNumberWithVariance(10, 20));
}

function _generateBloodParticles(position: Vector, amount: number, velocityScalar: () => number) {
  return callTimes(amount, () => {
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
      .scalar(velocityScalar());
    particle.direction = particle.velocity.clone().normalize();
    particle.size = RandomUtils.getValueInRange(1, 3);

    return particle;
  });
}
