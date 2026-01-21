import GameContext from "@/core/gameContext";
import Disposable from "@/behaviors/disposable";
import Vector from "@/physics/vector";
import { PhysicableMixin } from "@/mixins/physics";
import { CollisionableMixin } from "@/mixins/collisionable";
import RenderElement from "@/render/renderElement";
import { isAttackable } from "@/behaviors/attackable";
import Background, { BACKGROUND_ID } from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Rectangle } from "@/objects/shapes";
import { otherSideObjectsFiltering } from "../utils";
import RenderUtils from "@/render/utils";
import { UnitConfig } from "@/config";

const { ARROW: CONFIG } = UnitConfig;
const ArrowMixin = PhysicableMixin(CollisionableMixin<Rectangle>()(BaseObject));

/**
 * Arrow projectile fired by Archers.
 *
 * Travels in a straight line until it hits an enemy or expires.
 * Damage can be configured via constructor (defaults to CONFIG.DAMAGE).
 */
class Arrow extends ArrowMixin implements Disposable {
    shouldDispose: boolean;
    readonly side: 0 | 1;
    protected ttl: number;
    protected readonly damage: number;

    /**
     * Create a new Arrow projectile.
     * @param position - Starting position
     * @param direction - Direction vector (will be normalized)
     * @param side - Team side (0 = ally, 1 = enemy)
     * @param damage - Damage dealt on hit (defaults to CONFIG.DAMAGE)
     */
    constructor(position: Vector, direction: Vector, side: 0 | 1, damage: number = CONFIG.DAMAGE) {
        super(position);
        this.direction = direction.clone().normalize();
        this.collisionMask = new Rectangle(CONFIG.LENGTH, 2);
        this.velocity = this.direction.clone().scalar(CONFIG.SPEED);
        this.acceleration = this.direction.clone().scalar(CONFIG.ACCELERATION);
        this.shouldDispose = false;
        this.side = side;
        this.friction = CONFIG.FRICTION;
        this.ttl = CONFIG.TTL;
        this.damage = damage;
    }

    step = (gameContext: GameContext) => {
        // Check for collisions with enemy units
        const collisionList = gameContext.collisions[this.id];
        if (collisionList && collisionList.length > 0) {
            const enemy = collisionList.find(otherSideObjectsFiltering(this.side));
            if (enemy) {
                if (isAttackable(enemy)) {
                    enemy.takeDamage(this.damage, 'physical');
                }
                this.shouldDispose = true;
                return; // Stop processing after hit
            }
        }

        // Update TTL
        this.ttl -= gameContext.dt;
        if (this.ttl <= 0) {
            this.shouldDispose = true;
            // Draw arrow stuck in ground when it expires
            gameContext.background.drawArrow(this.position.clone(), this.direction.clone());
            return;
        }

        // Update position
        this.position = this.calculatePosition(gameContext.dt);
    }

    render() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            canvasRenderingContext.strokeStyle = 'black';
            canvasRenderingContext.translate(this.position.x, this.position.y);
            canvasRenderingContext.rotate(new Vector(1, 0).angleTo(this.direction));

            // draws the pointing tip
            canvasRenderingContext.beginPath();
            canvasRenderingContext.moveTo(0, 0);
            canvasRenderingContext.lineTo(CONFIG.LENGTH, 0);
            canvasRenderingContext.moveTo(CONFIG.LENGTH - 2, 1.5);
            canvasRenderingContext.lineTo(CONFIG.LENGTH - 2, -1.5);
            canvasRenderingContext.stroke();
        }, true);
    }
}

export default Arrow;