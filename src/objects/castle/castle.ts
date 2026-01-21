import Vector from "@/physics/vector";
import BaseObject from "../baseObject";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";
import { Circle } from "../shapes";
import { CollisionableMixin } from "@/mixins/collisionable";
import Attackable from "@/behaviors/attackable";
import RandomUtils from "@/utils/random";
import GameContext from "@/core/gameContext";
import Particle from "../particle/particle";
import Color from "@/utils/color";
import { castleExplotion } from "../army/ParticleUtils";
import Disposable from "@/behaviors/disposable";
import { UnitConfig } from "@/config";

const { CASTLE: CONFIG } = UnitConfig;
export const CASTLE_ID = 'castle';
const darkGray = "#555";
const lightGray = "#ddd";
const transparent = "transparent";

const CastleMixin = CollisionableMixin<Circle>()(BaseObject);

class Castle extends CastleMixin implements Attackable, Disposable {
    size: Circle = new Circle(CONFIG.RADIUS);
    health = CONFIG.HEALTH;
    maxHealth = this.health;
    side = 0;
    constructor() {
        super(new Vector(CONFIG.POSITION.X, CONFIG.POSITION.Y), CASTLE_ID);
        this.collisionMask = this.size;
        this.shouldDispose = false;
    }
    shouldDispose: boolean;
    dispose?: ((g: GameContext) => void | undefined) | undefined;

    takeDamage(damage: number, _type: 'physical' | 'magic' | 'true'): void {
        // Castle takes full damage (no resistance)
        this.health -= damage;
    }

    render() {
        return new RenderElement((gctx) => {
            const ctx = gctx.canvasRenderingContext;
            const position = this.position.clone();
            const towerRadius = this.size.maxDistanceToCenter;
            ctx.strokeStyle = transparent;

            ctx.fillStyle = lightGray;
            RenderUtils.renderCircle(ctx, position, towerRadius);
            ctx.fill();

            ctx.fillStyle = darkGray;
            RenderUtils.renderCircle(ctx, position, towerRadius - CONFIG.BRICK_SIZE / 2);
            ctx.fill();

            // draw brick lines
            const brickLines = Math.round(this.size.perimeter / CONFIG.BRICK_SIZE) - 1;

            ctx.save();
            ctx.strokeStyle = darkGray;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.translate(position.x, position.y);
            ctx.moveTo(0, 0);
            for (let i = 0; i < brickLines; i++) {
                const angle = (i * 360 / brickLines) * (Math.PI / 180);
                const x = towerRadius * Math.cos(angle);
                const y = towerRadius * Math.sin(angle);
                ctx.moveTo(0, 0);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        }, true);
    }

    step(g: GameContext) {
        this.smoke(g);
        if (this.health <= 0) {
            const pos = this.position.clone();
            const particles = castleExplotion(pos);
            this.shouldDispose = true;
            g.background.drawCastleExplotion(pos);
            g.objects.push(...particles);
        }
    }

    smoke(gctx: GameContext) {
        const healthPercentage = this.health / this.maxHealth;
        if (Math.random() < CONFIG.SMOKE.SPAWN_CHANCE && healthPercentage < CONFIG.SMOKE.DAMAGE_THRESHOLD) {
            const ttl = RandomUtils.getValueInRange(CONFIG.SMOKE.TTL_MIN, CONFIG.SMOKE.TTL_MAX);
            const particle = new Particle(ttl);
            particle.size = RandomUtils.getValueInRange(CONFIG.SMOKE.SIZE_MIN, CONFIG.SMOKE.SIZE_MAX);
            particle.position = this.position.clone().add(new Vector(
                RandomUtils.getNumberWithVariance(0, particle.size / 2) - particle.size / 2,
                RandomUtils.getNumberWithVariance(0, particle.size / 2) - particle.size
            ));
            // show more dark and red (like fire) smoke if the castle is more damaged, else light gray smoke
            const shade = 255 * healthPercentage;
            particle.color = new Color(shade, shade, shade);
            particle.fade = true;
            particle.isVertical = true;
            particle.velocity = new Vector(RandomUtils.getValueInRange(0.5, 1), -100)
                .scalar(RandomUtils.getNumberWithVariance(10, 20));
            particle.direction = particle.velocity.clone().normalize();

            gctx.objects.push(particle);
        }
    }

}

export default Castle;

