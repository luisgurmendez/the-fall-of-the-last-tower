import GameContext from '../../core/gameContext';
import { Circle, Rectangle } from '../shapes';
import Vector from '../../physics/vector';
import { ObjectType } from '../objectType';
import RenderUtils from '../../render/utils';
import RocketThruster from './rocketThruster';
import { PhysicableMixin } from '../../mixins/physics';
import { CollisionableMixin } from '../../mixins/collisionable';
import { PositionableMixin } from '../../mixins/positional';
import BaseObject from '../../objects/baseObject';
import { AffectedByGravitationableMixin } from '../../mixins/affectedByGravitational';
import { Gravitationable, isGravitationable } from '../../mixins/gravitational';
import Renderable from '../../behaviors/renderable';
import Stepable from '../../behaviors/stepable';
import RenderElement from '../../render/renderElement';
import Disposable from '../../behaviors/disposable';
import { adjustParticlePositionToMatchRocketPerimeter, generateRocketExplotionParticles, generateSecondaryThrusterParticle, generateThrusterParticle, ParticlePerimetralPositioning } from './rocketParticlesUtils';
import Particle from '../particle/particle';
import Color from '../../utils/color';
import Planet from '../planet/planet';
import RocketRenderUtils from './rocketRenderUtils';


const RocketMixins = AffectedByGravitationableMixin(
  PhysicableMixin(
    CollisionableMixin<Rectangle>()(
      PositionableMixin(BaseObject)
    )
  )
);


class Rocket extends RocketMixins implements Renderable, Stepable, Disposable {

  private thruster: RocketThruster;
  private secondaryThruster: RocketThruster;

  hasLaunched: boolean = false;
  hasLanded = false;
  hasExploded = false;
  landedOnPlanet: Planet | null = null;

  shouldDispose: boolean = false;

  constructor(position: Vector) {
    super('rocket');
    this.position = position;
    this.type = ObjectType.ROCKET;
    this.collisionMask = new Rectangle(13, 16)
    this.direction = new Vector(0, -1);
    this.thruster = new RocketThruster(16.5, 40);
    this.secondaryThruster = new RocketThruster(5, 30);

  }

  step(context: GameContext): void {
    if (!this.hasLanded) {
      this.angularAcceleration = this.calculateAngularAcceleration(context);
      this.angularVelocity = this.calculateAngularVelocity(context.dt);
      this.direction = this.calculateDirection(context.dt);
      this.acceleration = this.calculateAcceleration(context);
      this.position = this.calculatePosition(context.dt);
      this.velocity = this.calculateVelocity(context.dt);

      this.direction = this.preLaunchingCalculateDirection(context);
    }
  }

  render() {
    const renderElement = new RenderElement(RocketRenderUtils.renderRocket);
    const thrusterRenderElement = this.thruster.render();
    const secondaryThrusterRenderElement = this.secondaryThruster.render({ color: new Color(255, 255, 255), offset: new Vector(45, 0) });

    const rocketPhysicsRenderElement = new RenderElement(RocketRenderUtils.renderInfo);
    rocketPhysicsRenderElement.positionType = 'overlay';

    // const accelerationVectorRenderElement = new RenderElement(RocketRenderUtils.renderAcceleration);
    // accelerationVectorRenderElement.positionType = 'overlay';

    renderElement.children = [secondaryThrusterRenderElement, thrusterRenderElement, rocketPhysicsRenderElement]

    if (!this.hasLaunched) {
      const rocketLauncherRenderElement = new RenderElement(RocketRenderUtils.renderLaunchDirectional);
      renderElement.children.push(...[rocketLauncherRenderElement])
    }
    return renderElement;
  }

  preLaunchingCalculateDirection(context: GameContext) {
    const newDirection = this.direction.clone()

    if (!this.hasLaunched) {
      if (context.pressedKeys.isKeyPressed('a')) {
        newDirection.rotate(-0.5).normalize()
      }

      if (context.pressedKeys.isKeyPressed('d')) {
        newDirection.rotate(0.5).normalize()
      }
    }

    return newDirection;
  }

  calculateAngularAcceleration(context: GameContext) {
    const isKeyPressed = context.pressedKeys.isKeyPressed;
    let angularAcceleration = 0;

    if (isKeyPressed('d') && this.hasLaunched) {
      const thrustAcceleration = this.direction.clone().rotate(90).scalar(this.secondaryThruster.thrust(context.dt))
      const particle = this.generateParticle(thrustAcceleration, 'top-left');
      if (particle) {
        context.objects.push(particle);
      } angularAcceleration = thrustAcceleration.length() * 5;
    }

    if (isKeyPressed('a') && this.hasLaunched) {
      const thrustAcceleration = this.direction.clone().rotate(-90).scalar(this.secondaryThruster.thrust(context.dt))
      const particle = this.generateParticle(thrustAcceleration, 'top-right');
      if (particle) {
        context.objects.push(particle);
      }
      angularAcceleration = thrustAcceleration.length() * -5;
    }

    return angularAcceleration
  }

  calculateAcceleration(context: GameContext) {
    const thrustAcceleration = this.getThrustAcceleration(context);
    const appliedAcceleration = this.hasLaunched ? this.calculateGravitationalAcceleration(context) : new Vector();
    const acceleration = thrustAcceleration.clone().add(appliedAcceleration)
    return acceleration;
  }

  explode(context: GameContext) {
    this.shouldDispose = true;
    context.objects.push(...generateRocketExplotionParticles(this.position.clone()));
    this.hasExploded = true;
  }

  land(planet: Planet) {
    this.hasLanded = true;
    this.stopRocketPhysics();
    this.landedOnPlanet = planet;
  }

  private stopRocketPhysics() {
    this.acceleration = new Vector();
    this.velocity = new Vector();
    this.angularVelocity = 0;
    this.angularAcceleration = 0;
  }

  private generateParticle = (thrustAcc: Vector, toPosition: ParticlePerimetralPositioning, isPrimaryThruster = false): Particle | null => {
    const particleGenerator = isPrimaryThruster ? generateThrusterParticle : generateSecondaryThrusterParticle;
    if (thrustAcc.length() > 0) {
      const particle = particleGenerator(this.position.clone(), thrustAcc.clone().normalize());
      adjustParticlePositionToMatchRocketPerimeter(particle, toPosition, this.direction, this.collisionMask);
      return particle
    }
    return null;
  }

  private getThrustAcceleration(context: GameContext) {
    let primaryThrustAcc = new Vector();;
    let secondaryThrustAcc = new Vector();
    const isKeyPressed = context.pressedKeys.isKeyPressed;

    if (isKeyPressed('w')) {
      this.hasLaunched = true;
      primaryThrustAcc = this.direction.clone().scalar(this.thruster.thrust(context.dt));
      const particle = this.generateParticle(primaryThrustAcc, 'bottom', true)
      if (particle) {
        context.objects.push(particle);
      }
    }

    if (isKeyPressed('s')) {
      secondaryThrustAcc = this.direction.clone().scalar(-this.secondaryThruster.thrust(context.dt));
      const particle = this.generateParticle(secondaryThrustAcc, 'top');
      if (particle) {
        context.objects.push(particle);
      }

    }

    return primaryThrustAcc.add(secondaryThrustAcc)
  }
}

export default Rocket;
