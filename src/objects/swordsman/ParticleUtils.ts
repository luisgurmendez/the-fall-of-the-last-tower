import Color from "../../utils/color";
import Particle from "../../objects/particle/particle";
import Vector from "../../physics/vector";
import RandomUtils from "../../utils/random";
import { callTimes } from "../../utils/fn";
import { Rectangle } from "objects/shapes";

export function generateThrusterParticle(
  position: Vector,
  thrustDirection: Vector
) {
  const isBlueParticle = RandomUtils.getRandomBoolean(0.3);

  const ttl = isBlueParticle ? 0.4 : RandomUtils.getValueInRange(0.7, 1.8);
  const particle = new Particle(ttl);

  particle.position = position;
  particle.color = isBlueParticle
    ? new Color(20, RandomUtils.getIntegerInRange(0, 255), 255)
    : new Color(255, RandomUtils.getIntegerInRange(0, 255), 12);
  particle.fade = true;
  const velocityAngleVariation = RandomUtils.getValueInRange(-45, 45);
  particle.velocity = thrustDirection
    .clone()
    .scalar(-1)
    .rotate(velocityAngleVariation)
    .scalar(RandomUtils.getNumberWithVariance(10, 20));
  particle.direction = particle.velocity.clone().normalize();
  particle.size = RandomUtils.getValueInRange(1, 4);

  return particle;
}

export function generateSecondaryThrusterParticle(
  position: Vector,
  thrustDirection: Vector
) {
  const particle = generateThrusterParticle(position, thrustDirection);
  particle.color = new Color(255, RandomUtils.getIntegerInRange(200, 255), 255);
  particle.size = RandomUtils.getValueInRange(1, 2);
  particle.velocity.scalar(2);
  return particle;
}

export function generateSwordsmanBloodBath(position: Vector) {
  return callTimes(120, () => {
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
