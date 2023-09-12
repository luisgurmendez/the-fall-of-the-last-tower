import Vector from "@/physics/vector";
import BaseObject from "../baseObject";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";
import { Circle, Rectangle } from "../shapes";
import { CollisionableMixin } from "@/mixins/collisionable";
import Attackable from "@/behaviors/attackable";
import RandomUtils from "@/utils/random";
import GameContext from "@/core/gameContext";
import Particle from "../particle/particle";
import Color from "@/utils/color";

const castleBrickSize = 50;
export const CASTLE_ID = 'c'
const darkGray = "#555";
const lightGray = "#ddd";
const transparent = "transparent"

const CastleMixin = CollisionableMixin<Circle>()(BaseObject);


class Castle extends CastleMixin implements Attackable {
    size: Circle = new Circle(200);
    health = 999;
    maxHealth = this.health;
    side = 0;
    constructor() {
        super(new Vector(0, 0), CASTLE_ID);
        this.collisionMask = this.size;
    }
    applyDamage(damage: number): void {
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
            RenderUtils.renderCircle(ctx, position, towerRadius - castleBrickSize / 2);
            ctx.fill();

            // draw brick lines
            const brickLines = Math.round(this.size.perimeter / castleBrickSize) - 1;

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
    }

    smoke(gctx: GameContext) {
        const healthPercentage = this.health / this.maxHealth;
        if (Math.random() < 0.05 && healthPercentage < 0.8) {
            const ttl = RandomUtils.getValueInRange(0.1, 2.5);
            const particle = new Particle(ttl);
            particle.size = RandomUtils.getValueInRange(10, 40);
            particle.position = this.position.clone().add(new Vector(RandomUtils.getNumberWithVariance(0, particle.size / 2) - particle.size / 2, RandomUtils.getNumberWithVariance(0, particle.size / 2) - particle.size));
            // show more dark and red (like fire) smoke if the castle is more damaged, else light gray smoke
            const shade = 255 * healthPercentage;
            particle.color = new Color(shade, shade, shade)
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

